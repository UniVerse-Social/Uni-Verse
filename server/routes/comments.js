const router = require('express').Router();
const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const User = require('../models/User');

// Get all comments for a post (flat; client nests by parentId) — ENRICHED with username & profilePicture
router.get('/post/:postId', async (req, res) => {
  try {
    const postId = new mongoose.Types.ObjectId(req.params.postId);
    const comments = await Comment.find({ postId }).sort({ createdAt: 1 }).lean();

    if (comments.length === 0) return res.json([]);

    // Fetch authors once, map onto comments
    const authorIds = [...new Set(comments.map(c => String(c.userId)))];
    const authors = await User.find({ _id: { $in: authorIds } })
      .select('_id username profilePicture')
      .lean();
    const map = new Map(authors.map(u => [String(u._id), u]));

    const enriched = comments.map(c => {
      const u = map.get(String(c.userId));
      return {
        ...c,
        username: u?.username || 'user',
        profilePicture: u?.profilePicture || '',
      };
    });

    res.json(enriched);
  } catch (e) {
    console.error('comments list error', e);
    res.status(500).json({ message: 'Failed to load comments' });
  }
});

// Count for a post
router.get('/post/:postId/count', async (req, res) => {
  try {
    const postId = new mongoose.Types.ObjectId(req.params.postId);
    const count = await Comment.countDocuments({ postId });
    res.json({ count });
  } catch {
    res.status(500).json({ message: 'Failed to count comments' });
  }
});

// Create a comment (or reply)
router.post('/', async (req, res) => {
  try {
    const { postId, userId, body, parentId } = req.body || {};
    if (!postId || !userId || !String(body || '').trim()) {
      return res.status(400).json({ message: 'Missing fields' });
    }

    // If replying, validate the parent belongs to same post
    if (parentId) {
      const parent = await Comment.findById(parentId).lean();
      if (!parent || String(parent.postId) !== String(postId)) {
        return res.status(400).json({ message: 'Invalid parentId' });
      }
    }

    const created = await Comment.create({
      postId,
      userId,
      body: String(body).trim(),
      parentId: parentId || null
    });

    res.status(201).json(created);
  } catch (e) {
    console.error('comment create error', e);
    res.status(500).json({ message: 'Failed to comment' });
  }
});

// Like/unlike a comment
router.put('/:id/like', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ message: 'Missing userId' });

    const c = await Comment.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Not found' });

    const has = c.likes.map(String).includes(String(userId));
    await c.updateOne(has ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } });

    res.json({ liked: !has });
  } catch (e) {
    console.error('comment like error', e);
    res.status(500).json({ message: 'Failed to like' });
  }
});

// Delete (author only) – removes replies to keep threads clean
router.delete('/:id', async (req, res) => {
  try {
    const { userId } = req.body || {};
    const c = await Comment.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Not found' });
    if (String(c.userId) !== String(userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await Comment.deleteMany({ $or: [{ _id: c._id }, { parentId: c._id }] });
    res.json({ ok: true });
  } catch (e) {
    console.error('comment delete error', e);
    res.status(500).json({ message: 'Failed to delete' });
  }
});

module.exports = router;
