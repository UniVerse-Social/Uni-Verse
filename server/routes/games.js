// server/routes/games.js
const router = require('express').Router();
const mongoose = require('mongoose');
const GameProfile = require('../models/GameProfile');
const GameResult = require('../models/GameResult');
const { checkAndUnlock } = require('../services/badges'); // optional
const User = require('../models/User');

/* -------------------- Ranks / tiers -------------------- */
const TIERS = [
  { name: 'Wood',     min:   0 },
  { name: 'Bronze',   min: 100 },
  { name: 'Silver',   min: 250 },
  { name: 'Gold',     min: 400 },
  { name: 'Platinum', min: 600 },
  { name: 'Diamond',  min: 900 },
  { name: 'Champion', min: 1500 },
];

function rankFromTrophies(total) {
  let result = TIERS[0].name;
  for (const t of TIERS) if (total >= t.min) result = t.name;
  return result;
}

async function ensureProfile(userId) {
  let gp = await GameProfile.findOne({ userId });
  if (!gp) gp = await GameProfile.create({ userId });
  return gp;
}

/* -------------------- Monthly (existing) -------------------- */
async function maybeMonthlyReset(gp) {
  if (!gp) return gp;
  const now = new Date();
  const last = gp.lastResetAt || new Date(0);
  const monthsApart =
    (now.getUTCFullYear() - last.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - last.getUTCMonth());

  const currentRank = rankFromTrophies(gp.totalTrophies);

  if (monthsApart >= 1) {
    if (currentRank === 'Champion' && gp.totalTrophies > 1500) {
      const overflow = gp.totalTrophies - 1500;
      gp.coins = (gp.coins || 0) + overflow;

      // scale per-game trophies down proportionally to cap total at 1500
      const total = Math.max(1, gp.totalTrophies);
      const scale = 1500 / total;
      const nextMap = new Map();
      for (const [k, v] of gp.trophiesByGame.entries()) {
        nextMap.set(k, Math.floor(v * scale));
      }
      gp.trophiesByGame = nextMap;
      gp.totalTrophies = 1500;
    }
    gp.lastResetAt = now;
    await gp.save();
  }
  return gp;
}

/* -------------------- Coins helpers -------------------- */
const DAY_MS = 24 * 60 * 60 * 1000;

async function autoGrantDailyCoins(gp) {
  const now = Date.now();
  const last = gp.lastDailyCoinAt ? gp.lastDailyCoinAt.getTime() : 0;
  if (now - last >= DAY_MS) {
    gp.coins = (gp.coins || 0) + 100;
    gp.lastDailyCoinAt = new Date(now);
    await gp.save();
    return 100;
  }
  return 0;
}

/* -------------------- Routes -------------------- */
// stats (+auto daily coins)
router.get('/stats/:userId', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);
    let gp = await ensureProfile(userId);
    gp = await maybeMonthlyReset(gp);
    await autoGrantDailyCoins(gp);

    res.json({
      userId: gp.userId,
      trophiesByGame: Object.fromEntries(gp.trophiesByGame.entries()),
      totalTrophies: gp.totalTrophies,
      coins: gp.coins || 0,
      rank: rankFromTrophies(gp.totalTrophies),
      tiers: TIERS,
    });
  } catch (e) {
    console.error('games stats error:', e);
    res.status(500).json({ message: 'Failed to load game stats' });
  }
});

// result -> adjust trophies (+1 coin on wins)
router.post('/result', async (req, res) => {
  try {
    const { userId, gameKey, delta } = req.body || {};
    if (!userId || !gameKey || typeof delta !== 'number') {
      return res.status(400).json({ message: 'userId, gameKey, and numeric delta are required' });
    }

    const uid = new mongoose.Types.ObjectId(userId);
    const gp = await ensureProfile(uid);
    await maybeMonthlyReset(gp);

    const current = Number(gp.trophiesByGame.get(gameKey) || 0);
    const next = Math.max(0, current + delta);
    gp.trophiesByGame.set(gameKey, next);

    // recompute total
    let total = 0;
    for (const v of gp.trophiesByGame.values()) total += v;
    gp.totalTrophies = total;

    if (delta > 0) gp.coins = (gp.coins || 0) + 1;

    await gp.save();

    // history log
    try { await GameResult.create({ userId: uid, gameKey, delta, didWin: delta > 0 }); } catch (e) {
      console.warn('unable to create game result log', e?.message);
    }

    // optional badges
    try {
      if (Math.abs(delta) > 0) {
        await checkAndUnlock(userId, { type: 'played_game' });
        const r = rankFromTrophies(gp.totalTrophies);
        const tier = TIERS.find(t => t.name === r);
        if (tier) await checkAndUnlock(userId, { type: 'rank_reached', payload: { name: r, min: tier.min } });
      }
    } catch {}

    res.json({
      ok: true,
      gameKey,
      trophiesByGame: Object.fromEntries(gp.trophiesByGame.entries()),
      totalTrophies: gp.totalTrophies,
      rank: rankFromTrophies(gp.totalTrophies),
      coins: gp.coins || 0,
    });
  } catch (e) {
    console.error('games result error:', e);
    res.status(500).json({ message: 'Failed to post game result' });
  }
});

// coins for badges (idempotent)
router.post('/coins/badge', async (req, res) => {
  try {
    const { userId, badgeKey } = req.body || {};
    if (!userId || !badgeKey) return res.status(400).json({ message: 'userId and badgeKey are required' });

    const uid = new mongoose.Types.ObjectId(userId);
    const gp = await ensureProfile(uid);

    gp.badgeCoinLog = Array.isArray(gp.badgeCoinLog) ? gp.badgeCoinLog : [];
    if (!gp.badgeCoinLog.includes(badgeKey)) {
      gp.badgeCoinLog.push(badgeKey);
      gp.coins = (gp.coins || 0) + 100;
      await gp.save();
      return res.json({ ok: true, coins: gp.coins, awarded: 100 });
    }
    return res.json({ ok: true, coins: gp.coins, awarded: 0 });
  } catch (e) {
    console.error('badge coin award error:', e);
    res.status(500).json({ message: 'Failed to grant badge coins' });
  }
});

/* ---------- OVERALL LEADERBOARDS ---------- */
/**
 * 1) MAIN leaderboard (original): from GameProfile.totalTrophies
 *    – This is the “database” you were using before.
 *    – Kept at /leaderboard/overall.
 *
 * 2) UNION leaderboard (new): from Users left-joined with GameProfile
 *    – Includes zero-score users; available at /leaderboard/overall/all
 *    – Safe add, doesn’t replace the main one.
 */

/* (1) MAIN overall (GameProfile) — define BEFORE the :gameKey route */
router.get('/leaderboard/overall', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '100', 10)));
    const userIdParam = req.query.userId;

    const leaders = await GameProfile.aggregate([
      { $project: { userId: 1, score: { $ifNull: ['$totalTrophies', 0] } } },
      { $match: { score: { $gt: 0 } } },
      { $sort: { score: -1, _id: 1 } },
      { $limit: limit },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: {
          _id: 0,
          userId: '$userId',
          username: { $ifNull: ['$user.username', 'Player'] },
          avatarUrl: { $ifNull: ['$user.profilePicture', ''] },
          score: 1
      } },
    ]);

    let me = null;
    if (userIdParam) {
      const uid = new mongoose.Types.ObjectId(userIdParam);
      const gp = await GameProfile.findOne({ userId: uid }).lean();
      const score = gp?.totalTrophies || 0;
      const higher = await GameProfile.countDocuments({ totalTrophies: { $gt: score } });
      const u = await User.findById(uid).select('username profilePicture').lean();
      me = {
        userId: uid,
        username: u?.username || 'You',
        avatarUrl: u?.profilePicture || '',
        score,
        rank: higher + 1,
      };
    }

    res.json({ leaders, me });
  } catch (e) {
    console.error('overall leaderboard (main) error:', e);
    res.status(500).json({ message: 'Failed to load overall leaderboard' });
  }
});

/* (2) UNION overall (Users ⟕ GameProfile) — additional endpoint */
router.get('/leaderboard/overall/all', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '100', 10)));
    const userIdParam = req.query.userId;

    const leaders = await User.aggregate([
      { $project: { username: 1, profilePicture: 1 } },
      { $lookup: { from: 'gameprofiles', localField: '_id', foreignField: 'userId', as: 'gp' } },
      { $unwind: { path: '$gp', preserveNullAndEmptyArrays: true } },
      { $project: {
          _id: 0,
          userId: '$_id',
          username: { $ifNull: ['$username', 'Player'] },
          avatarUrl: { $ifNull: ['$profilePicture', ''] },
          score: { $ifNull: ['$gp.totalTrophies', 0] },
      } },
      { $sort: { score: -1, userId: 1 } },
      { $limit: limit },
    ]);

    let me = null;
    if (userIdParam) {
      const uid = new mongoose.Types.ObjectId(userIdParam);
      const gp = await GameProfile.findOne({ userId: uid }).lean();
      const score = gp?.totalTrophies ?? 0;
      const higher = await GameProfile.countDocuments({ totalTrophies: { $gt: score } });
      const u = await User.findById(uid).select('username profilePicture').lean();

      me = {
        userId: uid,
        username: u?.username || 'You',
        avatarUrl: u?.profilePicture || '',
        score,
        rank: higher + 1
      };
    }

    res.json({ leaders, me });
  } catch (e) {
    console.error('overall leaderboard (all) error:', e);
    res.status(500).json({ message: 'Failed to load overall-all leaderboard' });
  }
});

/* ---------- Per-game leaderboard (used by sidebar) ---------- */
router.get('/leaderboard/:gameKey', async (req, res) => {
  try {
    const gameKey = String(req.params.gameKey);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
    const path = `trophiesByGame.${gameKey}`;

    const leaders = await GameProfile.aggregate([
      { $addFields: { score: { $ifNull: [`$${path}`, 0] } } },
      { $match: { score: { $gt: 0 } } },
      { $sort: { score: -1 } },
      { $limit: limit },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: {
          _id: 0,
          userId: '$userId',
          username: { $ifNull: ['$user.username', 'Player'] },
          avatarUrl: { $ifNull: ['$user.profilePicture', ''] }, // needed for sidebar
          score: 1
      } },
    ]);

    res.json({ leaders });
  } catch (e) {
    console.error('games leaderboard error:', e);
    res.status(500).json({ message: 'Failed to load leaderboard' });
  }
});

/* ---------- Recent history (used by sidebar) ---------- */
router.get('/history/:userId/:gameKey', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);
    const gameKey = String(req.params.gameKey);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));

    const history = await GameResult.find({ userId, gameKey })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ history });
  } catch (e) {
    console.error('games history error:', e);
    res.status(500).json({ message: 'Failed to load history' });
  }
});

module.exports = router;
