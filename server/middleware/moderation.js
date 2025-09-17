const leo = require('leo-profanity');
const User = require('../models/User');

leo.loadDictionary();

function maskText(text = '') { return text ? leo.clean(String(text)) : ''; }

async function enforceNotBanned(req, res, next) {
  try {
    const actorId =
      req.body?.userId ||
      req.body?.authorId ||
      req.body?.senderId ||   // DM fix
      req.headers['x-user-id'] ||
      req.query?.userId ||
      req.user?._id;

    if (!actorId) return res.status(401).json({ message: 'Missing user id' });

    const u = await User.findById(actorId).select('bannedUntil').lean();
    if (u?.bannedUntil && new Date(u.bannedUntil) > new Date()) {
      return res.status(423).json({ message: 'Account temporarily banned', until: u.bannedUntil });
    }
    next();
  } catch (e) {
    console.error('enforceNotBanned error', e);
    res.status(500).json({ message: 'Moderation check failed' });
  }
}

async function addStrike(userId, reason = 'policy_violation') {
  const u = await User.findById(userId).select('strikes bannedUntil').lean();
  if (!u) return;
  let strikes = (u.strikes || 0) + 1;
  let bannedUntil = u.bannedUntil || null;
  if (strikes >= 3) {
    bannedUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    strikes = 0;
  }
  await User.findByIdAndUpdate(userId, { $set: { strikes, bannedUntil } });
  return { strikes, bannedUntil, reason };
}

module.exports = { maskText, enforceNotBanned, addStrike };
