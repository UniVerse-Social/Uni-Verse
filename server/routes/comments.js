const router = require('express').Router();
const mongoose = require('mongoose');
const Comment = require('../models/Comment');

// Get all comments for a post (flat; client nests by parentId)
router.get('/post/:postId', async (req, res) => {
  try {
    const postId = new mongoose.Types.ObjectId(req.params.postId);
    const comments = await Comment.find({ postId }).sort({ createdAt: 1 }).lean();
    res.json(comments);
  } catch (e) {
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
    if (parentId) {
      const parent = await Comment.findById(parentId).lean();
      if (!parent || String(parent.postId) !== String(postId)) {
        return res.status(400).json({ message: 'Invalid parentId' });
      }
    }
    const created = await Comment.create({
      postId, userId, body: String(body).trim(), parentId: parentId || null
    });
    res.status(201).json(created);
  } catch {
    res.status(500).json({ message: 'Failed to comment' });
  }
});

// Like/unlike a comment
router.put('/:id/like', async (req, res) => {
  try {
    const { userId } = req.body || {};
    const c = await Comment.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Not found' });
    const has = c.likes.map(String).includes(String(userId));
    await c.updateOne(has ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } });
    res.json({ liked: !has });
  } catch {
    res.status(500).json({ message: 'Failed to like' });
  }
});

// Delete (author only) – removes replies to keep threads clean
router.delete('/:id', async (req, res) => {
  try {
    const { userId } = req.body || {};
    const c = await Comment.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Not found' });
    if (String(c.userId) !== String(userId)) return res.status(403).json({ message: 'Forbidden' });
    await Comment.deleteMany({ $or: [{ _id: c._id }, { parentId: c._id }] });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'Failed to delete' });
  }
});

module.exports = router;
