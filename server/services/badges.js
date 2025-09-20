// server/services/badges.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');

/* --------------------------- BADGE CATALOG --------------------------- */
const BADGE_CATALOG = [
  { key: 'Beginner', name: 'Beginner', icon: '🌱', unlock: { type: 'first_post' } },
  { key: 'Chatter', name: 'Chatter', icon: '💬', unlock: { type: 'posts', count: 10 } },
  { key: 'Connector', name: 'Connector', icon: '🔗', unlock: { type: 'followers', count: 10 } },
  { key: 'Club Member', name: 'Club Member', icon: '👥', unlock: { type: 'join_club' } },
  { key: 'Scholar', name: 'Scholar', icon: '🎓', unlock: { type: 'department_set' } },
  { key: 'Photogenic', name: 'Photogenic', icon: '📸', unlock: { type: 'upload_avatar' } },
  { key: 'Artist', name: 'Artist', icon: '🎨', unlock: { type: 'posts_with_images', count: 3 } },
  { key: 'Helpful', name: 'Helpful', icon: '🤝', unlock: { type: 'likes_given', count: 50 } },
  { key: 'Popular', name: 'Popular', icon: '🔥', unlock: { type: 'likes_received', count: 100 } },
  { key: 'Early Bird', name: 'Early Bird', icon: '🌅', unlock: { type: 'posted_morning' } },
  { key: 'Night Owl', name: 'Night Owl', icon: '🌙', unlock: { type: 'posted_night' } },
  { key: 'Librarian', name: 'Librarian', icon: '📚', unlock: { type: 'bio_filled' } },
  { key: 'Explorer', name: 'Explorer', icon: '🧭', unlock: { type: 'titantap_swipes', count: 30 } },
  { key: 'Gamer', name: 'Gamer', icon: '🎮', unlock: { type: 'played_game' } },
  { key: 'Champion', name: 'Champion', icon: '🏆', unlock: { type: 'games_rank', rank: 'Champion' } },
  { key: 'Silver', name: 'Silver', icon: '🥈', unlock: { type: 'games_rank', rank: 'Silver' } },
  { key: 'Gold', name: 'Gold', icon: '🥇', unlock: { type: 'games_rank', rank: 'Gold' } },
  { key: 'Veteran', name: 'Veteran', icon: '🛡️', unlock: { type: 'account_age_days', count: 180 } },
  { key: 'Trendsetter', name: 'Trendsetter', icon: '✨', unlock: { type: 'streak_days', count: 7 } },
  { key: 'Admin', name: 'Admin', icon: '🛠️', unlock: { type: 'admin' } },
];

const ObjectId = mongoose.Types.ObjectId;

/* --------------------------- helpers --------------------------- */
async function awardBadge(userId, key) {
  if (!key) return false;
  const user = await User.findById(userId).select('badgesUnlocked');
  if (!user) return false;
  const set = new Set(user.badgesUnlocked || []);
  if (set.has(key)) return false;
  set.add(key);
  user.badgesUnlocked = Array.from(set);
  await user.save();
  return true;
}

/** Atomic multi-add (idempotent) */
async function addBadges(userId, names = []) {
  const list = [...new Set((names || []).filter(Boolean))];
  if (list.length === 0) return { added: [] };
  await User.updateOne(
    { _id: userId },
    { $addToSet: { badgesUnlocked: { $each: list } } }
  );
  return { added: list };
}

function hourOf(date) {
  const d = new Date(date);
  return d.getHours(); // server local time is OK for simple rule
}

/* --------------------------- event checkers --------------------------- */
async function onPostCreated({ userId, createdAt, hasImage }) {
  const count = await Post.countDocuments({ userId });
  if (count >= 1) await awardBadge(userId, 'Beginner');
  if (count >= 10) await awardBadge(userId, 'Chatter');

  if (hasImage) {
    const withImg = await Post.countDocuments({
      userId,
      $or: [
        { 'attachments.type': 'image' },
        { imageUrl: { $exists: true, $ne: '' } },
      ],
    });
    if (withImg >= 3) await awardBadge(userId, 'Artist');
  }

  const h = hourOf(createdAt);
  if (h >= 5 && h <= 10) await awardBadge(userId, 'Early Bird'); // 5:00-10:59
  if (h >= 23 || h <= 3) await awardBadge(userId, 'Night Owl');  // 23:00-03:59
}

async function onLikeToggled({ likerId, postAuthorId }) {
  // Helpful (likes given)
  const likesGiven = await Post.countDocuments({ likes: new ObjectId(likerId) });
  if (likesGiven >= 50) await awardBadge(likerId, 'Helpful');

  // Popular (likes received by the author)
  const agg = await Post.aggregate([
    { $match: { userId: new ObjectId(postAuthorId) } },
    { $project: { n: { $size: { $ifNull: ['$likes', []] } } } },
    { $group: { _id: null, total: { $sum: '$n' } } },
  ]);
  const total = (agg[0]?.total || 0);
  if (total >= 100) await awardBadge(postAuthorId, 'Popular');
}

async function onFollowed({ targetUserId }) {
  const u = await User.findById(targetUserId).select('followers');
  const followers = (u?.followers || []).length;
  if (followers >= 10) await awardBadge(targetUserId, 'Connector');
}

async function onProfileUpdated({ userId, before, after }) {
  if (!after) return;

  // Photogenic
  if (!before?.profilePicture && after.profilePicture) {
    await awardBadge(userId, 'Photogenic');
  }
  // Librarian
  if ((!before?.bio || !before.bio.trim()) && (after.bio && after.bio.trim())) {
    await awardBadge(userId, 'Librarian');
  }
  // Scholar
  if ((!before?.department || !before.department.trim()) && (after.department && after.department.trim())) {
    await awardBadge(userId, 'Scholar');
  }
  // Admin (if they were made admin)
  if (!before?.isAdmin && after.isAdmin) {
    await awardBadge(userId, 'Admin');
  }
}

async function passiveChecks({ userId }) {
  const u = await User.findById(userId).select('createdAt badgesUnlocked');
  if (!u) return;
  // Veteran
  const days = Math.floor((Date.now() - new Date(u.createdAt).getTime()) / 86400000);
  if (days >= 180) await awardBadge(userId, 'Veteran');

  // (Optional) 7-day post streak
  const since = new Date(Date.now() - 7 * 86400000);
  const posts = await Post.find({ userId, createdAt: { $gte: since } }).select('createdAt');
  if (posts.length) {
    const daysSet = new Set(posts.map(p => new Date(p.createdAt).toDateString()));
    if (daysSet.size >= 7) await awardBadge(userId, 'Trendsetter');
  }
}

/* --------------------------- retroactive recompute --------------------------- */
/**
 * Re-checks ALL rules from current DB state and adds missing badges.
 * Call this before serving profile/badges so older accounts pick up new badges.
 */
async function recomputeAllBadges(userId) {
  if (!userId) return { added: [] };
  const uid = new ObjectId(userId);

  const user = await User.findById(uid)
    .select('badgesUnlocked followers following bio profilePicture department isAdmin createdAt clubs')
    .lean();
  if (!user) return { added: [] };

  const unlocked = new Set(user.badgesUnlocked || []);
  const toAdd = [];

  // Current stats
  const [
    postsCount,
    postsWithImagesCount,
    likesGivenCount,
    likesReceivedAgg,
    morningExists,
    nightExists,
  ] = await Promise.all([
    Post.countDocuments({ userId: uid }),

    Post.countDocuments({
      userId: uid,
      $or: [
        { 'attachments.type': 'image' },
        { imageUrl: { $exists: true, $ne: '' } },
      ],
    }),

    Post.countDocuments({ likes: uid }),

    Post.aggregate([
      { $match: { userId: uid } },
      { $project: { likesCount: { $size: { $ifNull: ['$likes', []] } } } },
      { $group: { _id: null, total: { $sum: '$likesCount' } } },
    ]),

    // Morning post (5:00–11:59)
    Post.exists({
      userId: uid,
      $expr: {
        $and: [
          { $gte: [{ $hour: '$createdAt' }, 5] },
          { $lte: [{ $hour: '$createdAt' }, 11] },
        ],
      },
    }),

    // Night post (22:00–03:59)
    Post.exists({
      userId: uid,
      $expr: {
        $or: [
          { $gte: [{ $hour: '$createdAt' }, 22] },
          { $lte: [{ $hour: '$createdAt' }, 3] },
        ],
      },
    }),
  ]);

  const followersCount   = (user.followers || []).length;
  const likesReceived    = (likesReceivedAgg?.[0]?.total) || 0;
  const hasDept          = !!(user.department && String(user.department).trim());
  const hasAvatar        = !!(user.profilePicture && String(user.profilePicture).trim());
  const hasBio           = !!(user.bio && String(user.bio).trim());
  const inAClub          = Array.isArray(user.clubs) && user.clubs.length > 0;
  const accountAgeDays   = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000);

  // Rules (only push if not already unlocked)
  if (postsCount >= 1  && !unlocked.has('Beginner'))        toAdd.push('Beginner');
  if (postsCount >= 10 && !unlocked.has('Chatter'))         toAdd.push('Chatter');
  if (followersCount >= 10 && !unlocked.has('Connector'))   toAdd.push('Connector');
  if (inAClub && !unlocked.has('Club Member'))              toAdd.push('Club Member');
  if (hasDept && !unlocked.has('Scholar'))                  toAdd.push('Scholar');
  if (hasAvatar && !unlocked.has('Photogenic'))             toAdd.push('Photogenic');
  if (postsWithImagesCount >= 3 && !unlocked.has('Artist')) toAdd.push('Artist');
  if (likesGivenCount >= 50 && !unlocked.has('Helpful'))    toAdd.push('Helpful');
  if (likesReceived >= 100 && !unlocked.has('Popular'))     toAdd.push('Popular');
  if (morningExists && !unlocked.has('Early Bird'))         toAdd.push('Early Bird');
  if (nightExists && !unlocked.has('Night Owl'))            toAdd.push('Night Owl');
  if (hasBio && !unlocked.has('Librarian'))                 toAdd.push('Librarian');
  if (accountAgeDays >= 180 && !unlocked.has('Veteran'))    toAdd.push('Veteran');
  if (user.isAdmin && !unlocked.has('Admin'))               toAdd.push('Admin');

  // 'Explorer', 'Gamer', 'Champion/Silver/Gold', 'Trendsetter' need telemetry not yet tracked
  // Trendsetter can be handled similarly to passiveChecks if desired; keeping event-based for now.

  if (toAdd.length === 0) return { added: [] };
  return addBadges(uid, toAdd);
}

/* --------------------------- entry point --------------------------- */
/**
 * checkAndUnlock(userId, event)
 * event = { type: 'post_created'|'like_toggled'|'followed'|'profile_updated'|'passive',
 *           ...payload }
 */
async function checkAndUnlock(userId, event) {
  if (!userId || !event || !event.type) return;
  try {
    switch (event.type) {
      case 'post_created':
        await onPostCreated(event);
        break;
      case 'like_toggled':
        await onLikeToggled(event);
        break;
      case 'followed':
        await onFollowed(event);
        break;
      case 'profile_updated':
        await onProfileUpdated(event);
        break;
      case 'passive':
        await passiveChecks({ userId });
        break;
      default:
        break;
    }
  } catch (e) {
    console.warn('Badge check failed:', e?.message || e);
  }
}

module.exports = {
  BADGE_CATALOG,
  checkAndUnlock,
  awardBadge,
  recomputeAllBadges,
};
