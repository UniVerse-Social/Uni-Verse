// server/routes/users.js
const router = require('express').Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Post = require('../models/Post');

// ---------- GET USER BY USERNAME ----------
router.get('/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json('User not found');
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

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true }
    );

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
    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.body.userId);
    if (!userToFollow || !currentUser) {
      return res.status(404).json('User not found');
    }
    if (!Array.isArray(userToFollow.followers)) userToFollow.followers = [];
    if (!Array.isArray(currentUser.following)) currentUser.following = [];

    if (!userToFollow.followers.includes(req.body.userId)) {
      await userToFollow.updateOne({ $push: { followers: req.body.userId } });
      await currentUser.updateOne({ $push: { following: req.params.id } });
      res.status(200).json('User has been followed');
    } else {
      await userToFollow.updateOne({ $pull: { followers: req.body.userId } });
      await currentUser.updateOne({ $pull: { following: req.params.id } });
      res.status(200).json('User has been unfollowed');
    }
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

    // Optional safety check: ensure new hash matches newPassword if changed
    if (wantsPwChange) {
      const fresh = await User.findById(id).select('+password');
      const okNew = await bcrypt.compare(String(newPassword), String(fresh.password));
      if (!okNew) {
        return res.status(500).json({ message: 'Password update failed to persist correctly. Please try again.' });
      }
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
    const q = (req.query.q || '').trim();
    const me = req.query.userId ? new mongoose.Types.ObjectId(req.query.userId) : null;

    if (!q) return res.status(200).json([]);

    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const match = {
      $or: [{ username: rx }, { department: rx }, { hobbies: rx }],
    };
    if (me) match._id = { $ne: me };

    const users = await User.find(match).select('-password -email').limit(30).lean();

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
      { $match: { _id: { $ne: meId } } },
      {
        $addFields: {
          followersSafe: { $ifNull: ['$followers', []] },
          hobbiesSafe: { $ifNull: ['$hobbies', []] },
          clubsSafe: { $ifNull: ['$clubs', []] },
        },
      },
      {
        $addFields: {
          isFollower: { $in: [meId, '$followersSafe'] },
          iFollow: { $in: ['_id', meFollowing] },
          isMutual: {
            $and: [{ $in: [meId, '$followersSafe'] }, { $in: ['$_id', meFollowing] }],
          },
          deptMatch: { $cond: [{ $eq: ['$department', me.department || null] }, 1, 0] },
          sharedClubsCount: { $size: { $setIntersection: ['$clubsSafe', meClubs] } },
          sharedHobbiesCount: { $size: { $setIntersection: ['$hobbiesSafe', meHobbies] } },
          rand: { $rand: {} },
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

module.exports = router;
