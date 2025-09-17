// server/routes/events.js
const router = require('express').Router();
const Event = require('../models/Event');
const User = require('../models/User');

// list (newest first)
router.get('/', async (req, res) => {
  const rows = await Event.find({}).sort({ createdAt: -1 }).limit(200).lean();
  res.json(rows);
});

// create (admin only)
router.post('/', async (req, res) => {
  const { authorId, title, text, images = [] } = req.body || {};
  const u = await User.findById(authorId).lean();
  if (!u) return res.status(404).json({ message: 'No user' });
  if (!u.isAdmin) return res.status(403).json({ message: 'Admins only' });

  const ev = await Event.create({ authorId, title: String(title).trim(), text: String(text).trim(), images: Array.isArray(images) ? images.slice(0, 6) : [] });
  res.status(201).json(ev);
});

// delete (admin only)
router.delete('/:id', async (req, res) => {
  const { userId } = req.body || {};
  const u = await User.findById(userId).lean();
  if (!u?.isAdmin) return res.status(403).json({ message: 'Admins only' });
  await Event.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
