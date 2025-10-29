// server/routes/admin.js
const router = require('express').Router();
const requireAdmin = require('../middleware/requireAdmin');
const User = require('../models/User');
const Post = require('../models/Post');
const Listing = require('../models/Listing');
const Club = require('../models/Club');
const ClubPost = require('../models/ClubPost');

// --- Stats (no private content) ---
router.get('/stats', requireAdmin, async (_req, res) => {
  const [users, posts, clubs, listings] = await Promise.all([
    User.countDocuments(),
    Post.countDocuments(),
    Club.countDocuments(),
    Listing.countDocuments(),
  ]);
  res.json({ users, posts, clubs, listings });
});

// --- User directory (redacts secrets; no DMs) ---
router.get('/users', requireAdmin, async (_req, res) => {
  const people = await User.find({})
    .select('_id username email isAdmin department createdAt profilePicture')
    .sort({ createdAt: -1 })
    .lean();
  res.json(people);
});

// Promote / demote
router.post('/promote', requireAdmin, async (req, res) => {
  const { targetId, makeAdmin } = req.body || {};
  const u = await User.findById(targetId);
  if (!u) return res.status(404).json({ message: 'User not found' });
  u.isAdmin = !!makeAdmin;
  await u.save();
  res.json({ ok: true, _id: u._id, isAdmin: u.isAdmin });
});

// Remove content (posts, club posts, listings). No DM endpoints here.
router.delete('/post/:id', requireAdmin, async (req, res) => {
  await Post.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
router.delete('/clubpost/:id', requireAdmin, async (req, res) => {
  await ClubPost.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
router.delete('/listing/:id', requireAdmin, async (req, res) => {
  await Listing.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// Disable a user (soft delete)
router.post('/users/:id/disable', requireAdmin, async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { $set: { isVerified: false } });
  res.json({ ok: true });
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ message: 'Missing user id' });

  const me = req.user?._id?.toString?.();
  if (me && me === id) return res.status(400).json({ message: "Admins can't delete their own account." });

  const target = await User.findById(id).select('_id isAdmin');
  if (!target) return res.status(404).json({ message: 'User not found' });

  if (target.isAdmin && !req.body?.allowAdmin) {
    return res.status(403).json({ message: 'Refusing to delete another admin. Pass {allowAdmin:true} to override.' });
  }

  await User.findByIdAndDelete(id);
  return res.json({ ok: true });
});

/** Hard delete by username (fallback for UIs that lack _id) */
router.delete('/users/by-username/:username', requireAdmin, async (req, res) => {
  const { username } = req.params;
  if (!username) return res.status(400).json({ message: 'Missing username' });

  const me = req.user?._id?.toString?.();
  const target = await User.findOne({ username }).select('_id isAdmin');
  if (!target) return res.status(404).json({ message: 'User not found' });
  if (me && me === target._id.toString()) {
    return res.status(400).json({ message: "Admins can't delete their own account." });
  }
  if (target.isAdmin && !req.body?.allowAdmin) {
    return res.status(403).json({ message: 'Refusing to delete another admin. Pass {allowAdmin:true} to override.' });
  }

  await User.findByIdAndDelete(target._id);
  return res.json({ ok: true });
});

module.exports = router;