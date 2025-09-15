// server/routes/admin.js
const router = require('express').Router();
const User = require('../models/User');

// Simple header key; add this to your .env
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

// small helper for case-insensitive username
const esc = (s='') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const byUsernameCI = (u) => ({ username: { $regex: `^${esc(u)}$`, $options: 'i' } });

router.use((req, res, next) => {
  if (!ADMIN_API_KEY) return res.status(500).json({ message: 'ADMIN_API_KEY not set' });
  const key = req.header('x-admin-key');
  if (key !== ADMIN_API_KEY) return res.status(401).json({ message: 'Unauthorized' });
  next();
});

// Reset a user’s password (hashing handled by your User model pre('findOneAndUpdate'))
router.post('/users/reset-password', async (req, res) => {
  try {
    const { username, email, id, newPassword } = req.body || {};
    if (!newPassword || !(username || email || id)) {
      return res.status(400).json({ message: 'Provide username or email or id, and newPassword' });
    }
    const query = id
      ? { _id: id }
      : email
        ? { email: String(email).toLowerCase().trim() }
        : byUsernameCI(String(username).trim());

    const user = await User.findOneAndUpdate(query, { password: String(newPassword) }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ ok: true, user: { _id: user._id, username: user.username, email: user.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a user
router.delete('/users', async (req, res) => {
  try {
    const { username, email, id } = req.body || {};
    if (!(username || email || id)) {
      return res.status(400).json({ message: 'Provide username or email or id' });
    }
    const query = id
      ? { _id: id }
      : email
        ? { email: String(email).toLowerCase().trim() }
        : byUsernameCI(String(username).trim());

    const result = await User.deleteOne(query);
    if (result.deletedCount === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
