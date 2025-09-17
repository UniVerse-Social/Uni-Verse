// server/middleware/requireAdmin.js
const User = require('../models/User');

// Flexible: reads the actor id from body / query / header
module.exports = async function requireAdmin(req, res, next) {
  try {
    const actorId =
      req.body?.userId ||
      req.query?.userId ||
      req.headers['x-user-id'];

    if (!actorId) return res.status(401).json({ message: 'Missing user id' });

    const actor = await User.findById(actorId).select('isAdmin');
    if (!actor || !actor.isAdmin) {
      return res.status(403).json({ message: 'Admin only' });
    }

    req.adminId = String(actor._id);
    next();
  } catch (e) {
    res.status(500).json({ message: 'Admin check failed' });
  }
};
