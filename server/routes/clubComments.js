const router = require('express').Router();
const mongoose = require('mongoose');
const ClubComment = require('../models/ClubComment');

// list
router.get('/post/:postId', async (req,res)=>{
  const postId = new mongoose.Types.ObjectId(req.params.postId);
  const comments = await ClubComment.find({ postId }).sort({ createdAt: 1 }).lean();
  res.json(comments);
});
router.get('/post/:postId/count', async (req,res)=>{
  const postId = new mongoose.Types.ObjectId(req.params.postId);
  const count = await ClubComment.countDocuments({ postId });
  res.json({ count });
});
// create / reply
router.post('/', async (req,res)=>{
  const { postId, userId, body, parentId } = req.body || {};
  if (!postId || !userId || !body?.trim()) return res.status(400).json({ message: 'Missing fields' });
  if (parentId) {
    const parent = await ClubComment.findById(parentId).lean();
    if (!parent || String(parent.postId) !== String(postId)) return res.status(400).json({ message: 'Invalid parentId' });
  }
  const created = await ClubComment.create({ postId, userId, body: body.trim(), parentId: parentId || null });
  res.status(201).json(created);
});
// like
router.put('/:id/like', async (req,res)=>{
  const { userId } = req.body || {};
  const c = await ClubComment.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Not found' });
  const has = (c.likes || []).map(String).includes(String(userId));
  await c.updateOne(has ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } });
  res.json({ liked: !has });
});
// delete
router.delete('/:id', async (req,res)=>{
  const { userId } = req.body || {};
  const c = await ClubComment.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Not found' });
  if (String(c.userId) !== String(userId)) return res.status(403).json({ message: 'Forbidden' });
  await ClubComment.deleteMany({ $or: [{ _id: c._id }, { parentId: c._id }] });
  res.json({ ok: true });
});

module.exports = router;
