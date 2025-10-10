// server/routes/users.js
const router = require('express').Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Post = require('../models/Post');
const GameProfile = require('../models/GameProfile');
const {
  BADGE_CATALOG,
  checkAndUnlock,
  recomputeAllBadges,
} = require('../services/badges'); // badge engine + catalog + retroactive

const BADGE_NAMES = new Set(BADGE_CATALOG.map(b => b.name));

function normalizeEquipped(equipped) {
  const arr = Array.isArray(equipped) ? equipped.slice(0, 5) : [];
  while (arr.length < 5) arr.push(''); // empty slot = ''
  return arr;
}

/* --------------------------- EXISTING ROUTES --------------------------- */

// ---------- GET USER BY USERNAME ----------
router.get('/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json('User not found');

    // Retroactively ensure badges based on existing activity
    try { await recomputeAllBadges(user._id); } catch {}

    const { password, ...other } = user._doc;
    res.status(200).json(other);
  } catch (err) {
    res.status(500).json(err);
  }
});

// ---------- GENERAL UPDATE (avatar/banner/bio/etc.) ----------
// NOTE: Do NOT hash here; let the model pre('findOneAndUpdate') handle hashing if a password is ever passed.
router.put('/:id', async (req, res) => {
  if (req.body.userId !== req.params.id) {
    return res.status(403).json('You can update only your account!');
  }
  try {
    const body = { ...req.body };

    // Normalize email if present
    if (typeof body.email === 'string') {
      body.email = body.email.trim().toLowerCase();
    }

    // Optional: reject too-short password if someone uses this generic route
    if (body.password && String(body.password).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Capture "before" for badge transitions
    const before = await User.findById(req.params.id)
      .select('bio profilePicture department isAdmin')
      .lean();

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true }
    );

    // Badge hook: profile_updated (bio/avatar/department, etc.)
    try {
      await checkAndUnlock(user._id, {
        type: 'profile_updated',
        before,
        after: {
          bio: user.bio,
          profilePicture: user.profilePicture,
          department: user.department,
          isAdmin: user.isAdmin,
        },
      });
    } catch (e) {
      console.warn('Badge profile_updated check failed:', e?.message || e);
    }

    const { password, ...other } = user._doc;
    res.status(200).json(other);
  } catch (err) {
    return res.status(500).json(err);
  }
});

// ---------- FOLLOW / UNFOLLOW ----------
router.put('/:id/follow', async (req, res) => {
  if (req.body.userId === req.params.id) {
    return res.status(403).json("You can't follow yourself");
  }
  try {
    const targetId = req.params.id;
    const actorId = req.body.userId;

    const userToFollow = await User.findById(targetId);
    const currentUser = await User.findById(actorId);
    if (!userToFollow || !currentUser) {
      return res.status(404).json('User not found');
    }
    if (!Array.isArray(userToFollow.followers)) userToFollow.followers = [];
    if (!Array.isArray(currentUser.following)) currentUser.following = [];

    const followerSet = new Set(userToFollow.followers.map(f => String(f)));
    const followingSet = new Set(currentUser.following.map(f => String(f)));

    const actorObjectId = new mongoose.Types.ObjectId(actorId);
    const targetObjectId = new mongoose.Types.ObjectId(targetId);

    let msg;
    if (!followerSet.has(String(actorId))) {
      await Promise.all([
        userToFollow.updateOne({ $addToSet: { followers: actorObjectId } }),
        currentUser.updateOne({ $addToSet: { following: targetObjectId } }),
      ]);
      msg = 'User has been followed';
    } else {
      await Promise.all([
        userToFollow.updateOne({ $pull: { followers: actorObjectId } }),
        currentUser.updateOne({ $pull: { following: targetObjectId } }),
      ]);
      msg = 'User has been unfollowed';
    }

    // Badge hook: 'followed' (unlocks Connector on thresholds)
    checkAndUnlock(userToFollow._id, { type: 'followed', targetUserId: userToFollow._id }).catch(() => {});

    const [updatedTarget, updatedActor] = await Promise.all([
      User.findById(targetId).select('followers').lean(),
      User.findById(actorId).select('following').lean(),
    ]);

    res.status(200).json({
      message: msg,
      followersCount: updatedTarget?.followers?.length || 0,
      followingCount: updatedActor?.following?.length || 0,
    });
  } catch (err) {
    res.status(500).json(err);
  }
});

// ---------- ACCOUNT (PROFILE) UPDATE, INCLUDING PASSWORD ----------
router.put('/:id/account', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      userId,       // actor; must match id
      username,
      email,
      bio,
      oldPassword,
      oldPassword2,
      newPassword,
    } = req.body || {};

    if (!userId || String(userId) !== String(id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // include password for compare
    const user = await User.findById(id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // snapshot "before" for badge transitions
    const before = {
      bio: user.bio,
      profilePicture: user.profilePicture,
      department: user.department,
      isAdmin: user.isAdmin,
    };

    // Username change
    if (typeof username === 'string' && username.trim() && username !== user.username) {
      const taken = await User.findOne({ username: username.trim() });
      if (taken) return res.status(409).json({ message: 'Username is already taken' });
      user.username = username.trim();
    }

    // Email change (normalized)
    if (typeof email === 'string' && email.trim() && email.trim().toLowerCase() !== user.email) {
      const norm = email.trim().toLowerCase();
      const taken = await User.findOne({ email: norm });
      if (taken) return res.status(409).json({ message: 'Email is already in use' });
      user.email = norm;
    }

    // Bio
    if (typeof bio === 'string') {
      user.bio = bio;
    }

    // Password change (optional)
    const wantsPwChange = !!(oldPassword || oldPassword2 || newPassword);
    if (wantsPwChange) {
      if (!oldPassword || !oldPassword2 || !newPassword) {
        return res.status(400).json({ message: 'Fill all password fields' });
      }
      if (oldPassword !== oldPassword2) {
        return res.status(400).json({ message: 'Old passwords do not match' });
      }
      if (!user.password) {
        return res.status(400).json({ message: 'Password not available for this account. Please use password reset.' });
      }
      const ok = await bcrypt.compare(String(oldPassword), String(user.password));
      if (!ok) {
        return res.status(400).json({ message: 'Old password is incorrect' });
      }
      if (String(newPassword).length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
      }
      // Do NOT hash here; model pre('save') will hash exactly once
      user.password = String(newPassword);
    }

    await user.save();

    if (wantsPwChange) {
      const fresh = await User.findById(id).select('+password');
      const okNew = await bcrypt.compare(String(newPassword), String(fresh.password));
      if (!okNew) {
        return res.status(500).json({ message: 'Password update failed to persist correctly. Please try again.' });
      }
    }

    // Badge hook: profile_updated (covers bio/dept/avatar/admin)
    try {
      await checkAndUnlock(user._id, {
        type: 'profile_updated',
        before,
        after: {
          bio: user.bio,
          profilePicture: user.profilePicture,
          department: user.department,
          isAdmin: user.isAdmin,
        },
      });
    } catch (e) {
      console.warn('Badge profile_updated check failed:', e?.message || e);
    }

    const obj = user.toObject();
    delete obj.password;
    res.json(obj);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Followers list (robust) ---
router.get("/:id/followers", async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select("followers").lean();
    if (!u) return res.status(404).json("User not found");

    // Safely coerce to ObjectIds (handles string ids too)
    const followerIds = (u.followers || [])
      .map(x => {
        try { return new mongoose.Types.ObjectId(String(x)); } catch { return null; }
      })
      .filter(Boolean);

    if (followerIds.length === 0) return res.json([]);

    const people = await User.find({ _id: { $in: followerIds } })
      .select("_id username profilePicture department")
      .lean();

    res.json(people);
  } catch (e) {
    console.error("Followers list error:", e);
    res.status(500).json({ message: "Failed to load followers" });
  }
});

// --- Following list (robust) ---
router.get("/:id/following", async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select("following").lean();
    if (!u) return res.status(404).json("User not found");

    const followingIds = (u.following || [])
      .map(x => {
        try { return new mongoose.Types.ObjectId(String(x)); } catch { return null; }
      })
      .filter(Boolean);

    if (followingIds.length === 0) return res.json([]);

    const people = await User.find({ _id: { $in: followingIds } })
      .select("_id username profilePicture department")
      .lean();

    res.json(people);
  } catch (e) {
    console.error("Following list error:", e);
    res.status(500).json({ message: "Failed to load following" });
  }
});

// --- NEW: combined relations (followers + following) ---
router.get("/:id/relations", async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select("followers following").lean();
    if (!u) return res.status(404).json("User not found");

    const toObjectIds = (arr) =>
      (arr || [])
        .map(x => { try { return new mongoose.Types.ObjectId(String(x)); } catch { return null; } })
        .filter(Boolean);

    const followerIds  = toObjectIds(u.followers);
    const followingIds = toObjectIds(u.following);

    const [followers, following] = await Promise.all([
      followerIds.length
        ? User.find({ _id: { $in: followerIds } })
            .select("_id username profilePicture department").lean()
        : Promise.resolve([]),
      followingIds.length
        ? User.find({ _id: { $in: followingIds } })
            .select("_id username profilePicture department").lean()
        : Promise.resolve([]),
    ]);

    res.json({ followers, following });
  } catch (e) {
    console.error("Relations error:", e);
    res.status(500).json({ message: "Failed to load relations" });
  }
});

// ---------- USER SEARCH ----------
/**
 * GET /api/users/search?q=...&userId=...
 * - Matches username, department, or hobbies (case-insensitive)
 * - Excludes current user if userId is provided
 * - Marks 'isFollowing' if userId is provided (for UI state)
 */
router.get('/search', async (req, res) => {
  try {
    const qRaw = (req.query.q || '').trim();
    const tagsRaw = String(req.query.tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const hasQuery = qRaw.length > 0;
    const hasTags = tagsRaw.length > 0;

    if (!hasQuery && !hasTags) return res.status(200).json([]);

    const me = req.query.userId && mongoose.isValidObjectId(req.query.userId)
      ? new mongoose.Types.ObjectId(req.query.userId)
      : null;

    const conditions = [];
    if (hasQuery) {
      const rx = new RegExp(qRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      conditions.push({ $or: [{ username: rx }, { department: rx }, { hobbies: rx }] });
    }
    if (me) {
      conditions.push({ _id: { $ne: me } });
    }

    const GAME_KEYS = ['chess', 'checkers', 'fishing', 'poker', 'reversi', 'jump', 'oddeven'];
    let leaderboardIds = null;

    for (const tag of tagsRaw) {
      if (tag === 'leaderboardTop3') {
        if (leaderboardIds === null) {
          const idSet = new Set();
          await Promise.all(GAME_KEYS.map(async (key) => {
            const rows = await GameProfile.aggregate([
              { $project: { userId: 1, score: { $ifNull: [`$trophiesByGame.${key}`, 0] } } },
              { $match: { score: { $gt: 0 } } },
              { $sort: { score: -1, _id: 1 } },
              { $limit: 3 },
            ]);
            rows.forEach((row) => {
              if (row?.userId) idSet.add(String(row.userId));
            });
          }));
          leaderboardIds = Array.from(idSet)
            .filter((id) => mongoose.isValidObjectId(id))
            .map((id) => new mongoose.Types.ObjectId(id));
        }
        if (!leaderboardIds.length) return res.status(200).json([]);
        conditions.push({ _id: { $in: leaderboardIds } });
        continue;
      }
      if (tag.startsWith('hobby:')) {
        const value = tag.slice('hobby:'.length);
        if (value) conditions.push({ hobbies: value });
        continue;
      }
      if (tag.startsWith('department:')) {
        const value = tag.slice('department:'.length);
        if (value) conditions.push({ department: value });
        continue;
      }
      if (tag === 'club:any') {
        conditions.push({ clubs: { $exists: true, $not: { $size: 0 } } });
        continue;
      }
      if (tag.startsWith('club:')) {
        const value = tag.slice('club:'.length);
        if (mongoose.isValidObjectId(value)) {
          conditions.push({ clubs: new mongoose.Types.ObjectId(value) });
        }
        continue;
      }
    }

    const match = conditions.length ? { $and: conditions } : {};
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    const users = await User.find(match).select('-password -email').limit(limit).lean();

    if (me) {
      const mine = await User.findById(me).select('following').lean();
      const followingSet = new Set((mine?.following || []).map((id) => id.toString()));
      users.forEach((u) => (u.isFollowing = followingSet.has(u._id.toString())));
    }

    res.status(200).json(users);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: 'Search failed' });
  }
});

// Basic lookup by IDs (used by DMs to show sender names/avatars)
// GET /api/users/basic?ids=ID1,ID2,ID3
router.get('/basic', async (req, res) => {
  try {
    const raw = String(req.query.ids || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (!raw.length) return res.json([]);

    const ids = raw.map(s => {
      try { return new mongoose.Types.ObjectId(s); } catch { return null; }
    }).filter(Boolean);

    if (!ids.length) return res.json([]);

    const users = await User.find({ _id: { $in: ids } })
      .select('_id username profilePicture badgesEquipped') // keep it lightweight
      .lean();

    res.json(users);
  } catch (e) {
    console.error('basic users lookup error:', e);
    res.status(500).json({ message: 'Failed to load users' });
  }
});

// ---------- IMPROVED SUGGESTIONS ----------
/**
 * GET /api/users/suggestions/:userId
 * - Excludes self and already-following
 * - Ranks by department (x3), mutuals (x2), and shared hobbies (x1)
 * - Returns up to 20 users (you can change via ?limit=)
 */
router.get('/suggestions/:userId', async (req, res) => {
  try {
    const meId = new mongoose.Types.ObjectId(req.params.userId);
    const me = await User.findById(meId).select('department hobbies following').lean();
    if (!me) return res.status(404).json('User not found');

    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const pipeline = [
      { $match: { _id: { $ne: meId, $nin: me.following || [] } } },
      {
        $addFields: {
          sharedHobbiesCount: { $size: { $setIntersection: ['$hobbies', me.hobbies || []] } },
          deptMatch: { $cond: [{ $eq: ['$department', me.department || null] }, 1, 0] },
          mutualCount: { $size: { $setIntersection: ['$following', me.following || []] } },
        },
      },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ['$deptMatch', 3] },
              { $multiply: ['$mutualCount', 2] },
              '$sharedHobbiesCount',
            ],
          },
        },
      },
      { $sort: { score: -1, createdAt: -1 } },
      { $project: { password: 0, email: 0 } },
      { $limit: limit },
    ];

    const users = await User.aggregate(pipeline);
    res.status(200).json(users);
  } catch (err) {
    console.error('Suggestions error:', err);
    res.status(500).json(err);
  }
});

// ---------- TITANTAP ORDERED SUGGESTIONS ----------
/**
 * Ordered: followers (who you don't follow back) → mutuals → dept → clubs → hobbies → random
 */
router.get('/titantap/:userId', async (req, res) => {
  try {
    const meId = new mongoose.Types.ObjectId(req.params.userId);

    const me = await User.findById(meId)
      .select('department hobbies clubs followers following')
      .lean();
    if (!me) return res.status(404).json('User not found');

    const meFollowing = Array.isArray(me.following) ? me.following : [];
    const meClubs = Array.isArray(me.clubs) ? me.clubs : [];
    const meHobbies = Array.isArray(me.hobbies) ? me.hobbies : [];

    const pipeline = [
      { $match: { _id: { $ne: meId, $nin: meFollowing } } },
      {
        $addFields: {
          followersSafe: { $ifNull: ['$followers', []] },
          hobbiesSafe:   { $ifNull: ['$hobbies',  []] },
          clubsSafe:     { $ifNull: ['$clubs',    []] },
        },
      },
      {
        $addFields: {
          isFollower:         { $in: [meId, '$followersSafe'] },
          iFollow:            { $in: ['$_id', meFollowing] },
          isMutual:           { $and: [{ $in: [meId, '$followersSafe'] }, { $in: ['$_id', meFollowing] }] },
          deptMatch:          { $cond: [{ $eq: ['$department', me.department || null] }, 1, 0] },
          sharedClubsCount:   { $size: { $setIntersection: ['$clubsSafe',   meClubs] } },
          sharedHobbiesCount: { $size: { $setIntersection: ['$hobbiesSafe', meHobbies] } },
          rand:               { $rand: {} },
        },
      },
      {
        $sort: {
          isFollower: -1,
          iFollow: 1,
          isMutual: -1,
          deptMatch: -1,
          sharedClubsCount: -1,
          sharedHobbiesCount: -1,
          rand: 1,
        },
      },
      { $project: { password: 0, email: 0 } },
      { $limit: Math.min(parseInt(req.query.limit) || 50, 100) },
    ];

    const users = await User.aggregate(pipeline);
    res.json(users);
  } catch (e) {
    console.error('TitanTap error:', e);
    res.status(500).json({ message: e.message || 'Failed to load TitanTap suggestions' });
  }
});

// ---------- DELETE ACCOUNT ----------
router.delete('/:id', async (req, res) => {
  try {
    if (req.body.userId !== req.params.id) {
      return res.status(403).json('You can delete only your account!');
    }
    await Post.deleteMany({ userId: req.params.id });
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

/* --------------------------- BADGE ROUTES --------------------------- */

/** GET unlocked/equipped + catalog (retroactive recompute first) */
router.get('/:id/badges', async (req, res) => {
  try {
    try { await recomputeAllBadges(req.params.id); } catch {}

    const u = await User.findById(req.params.id)
      .select('badgesUnlocked badgesEquipped')
      .lean();

    if (!u) return res.status(404).json('User not found');

    const unlocked = Array.isArray(u.badgesUnlocked) ? u.badgesUnlocked : [];
    const equipped = normalizeEquipped(u.badgesEquipped);

    res.json({ unlocked, equipped, catalog: BADGE_CATALOG });
  } catch (e) {
    console.error('Get badges error:', e);
    res.status(500).json({ message: 'Failed to load badges' });
  }
});

/** Equip a badge to a slot (0-4). Body: { userId, slot, badgeName|null } */
router.post('/:id/badges/equip', async (req, res) => {
  try {
    const { userId, slot, badgeName } = req.body || {};
    const { id } = req.params;

    if (!userId || String(userId) !== String(id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const s = Number(slot);
    if (!Number.isInteger(s) || s < 0 || s > 4) {
      return res.status(400).json({ message: 'Slot must be an integer between 0 and 4' });
    }

    const user = await User.findById(id).select('badgesUnlocked badgesEquipped');
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.badgesUnlocked = Array.isArray(user.badgesUnlocked) ? user.badgesUnlocked : [];
    user.badgesEquipped = normalizeEquipped(user.badgesEquipped);

    if (badgeName === null || badgeName === '') {
      // unequip slot
      user.badgesEquipped[s] = '';
    } else {
      if (!BADGE_NAMES.has(badgeName)) {
        return res.status(400).json({ message: 'Unknown badge' });
      }
      if (!user.badgesUnlocked.includes(badgeName)) {
        return res.status(400).json({ message: 'Badge not unlocked' });
      }
      user.badgesEquipped[s] = badgeName;
    }

    await user.save();
    res.json({
      unlocked: user.badgesUnlocked,
      equipped: normalizeEquipped(user.badgesEquipped),
    });
  } catch (e) {
    console.error('Equip badge error:', e);
    res.status(500).json({ message: 'Failed to equip badge' });
  }
});

/** Set title badge (convenience for slot 0). Body: { userId, badgeName|null } */
router.post('/:id/badges/set-title', async (req, res) => {
  try {
    const { userId, badgeName } = req.body || {};
    const { id } = req.params;

    if (!userId || String(userId) !== String(id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const user = await User.findById(id).select('badgesUnlocked badgesEquipped');
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.badgesUnlocked = Array.isArray(user.badgesUnlocked) ? user.badgesUnlocked : [];
    user.badgesEquipped = normalizeEquipped(user.badgesEquipped);

    if (badgeName === null || badgeName === '') {
      user.badgesEquipped[0] = '';
    } else {
      if (!BADGE_NAMES.has(badgeName)) {
        return res.status(400).json({ message: 'Unknown badge' });
      }
      if (!user.badgesUnlocked.includes(badgeName)) {
        return res.status(400).json({ message: 'Badge not unlocked' });
      }
      user.badgesEquipped[0] = badgeName;
    }

    await user.save();
    res.json({
      unlocked: user.badgesUnlocked,
      equipped: normalizeEquipped(user.badgesEquipped),
    });
  } catch (e) {
    console.error('Set title badge error:', e);
    res.status(500).json({ message: 'Failed to set title badge' });
  }
});

/** Admin/testing helper to unlock a badge. Body: { adminId, badgeName } */
router.post('/:id/badges/unlock', async (req, res) => {
  try {
    const { adminId, badgeName } = req.body || {};
    const { id } = req.params;

    if (!badgeName || !BADGE_NAMES.has(badgeName)) {
      return res.status(400).json({ message: 'Unknown or missing badgeName' });
    }

    // require admin
    const admin = await User.findById(adminId).select('isAdmin');
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ message: 'Admin privileges required' });
    }

    const user = await User.findById(id).select('badgesUnlocked');
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.badgesUnlocked = Array.isArray(user.badgesUnlocked) ? user.badgesUnlocked : [];
    if (!user.badgesUnlocked.includes(badgeName)) user.badgesUnlocked.push(badgeName);

    await user.save();
    res.json({ unlocked: user.badgesUnlocked });
  } catch (e) {
    console.error('Unlock badge error:', e);
    res.status(500).json({ message: 'Failed to unlock badge' });
  }
});

module.exports = router;
