// server/routes/games.js
const router = require('express').Router();
const mongoose = require('mongoose');
const GameProfile = require('../models/GameProfile');
const GameResult = require('../models/GameResult');
const { checkAndUnlock } = require('../services/badges'); // optional, if present
const User = require('../models/User');

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

/**
 * Optional monthly soft reset:
 * - If total trophies exceed Champion threshold, overflow converts to coins
 * - Scale down per-game trophies proportionally to keep total at cap
 */
async function maybeMonthlyReset(gp) {
  if (!gp) return gp;
  const now = new Date();
  const last = gp.lastResetAt || new Date(0);
  const monthsApart = (now.getUTCFullYear() - last.getUTCFullYear()) * 12 + (now.getUTCMonth() - last.getUTCMonth());
  const currentRank = rankFromTrophies(gp.totalTrophies);

  if (monthsApart >= 1) {
    if (currentRank === 'Champion' && gp.totalTrophies > 1500) {
      const overflow = gp.totalTrophies - 1500;
      gp.coins += overflow;

      // Scale per-game trophies down proportionally to total=1500
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

/** GET game profile / rank */
router.get('/stats/:userId', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);
    let gp = await ensureProfile(userId);
    gp = await maybeMonthlyReset(gp);
    res.json({
      userId: gp.userId,
      trophiesByGame: Object.fromEntries(gp.trophiesByGame.entries()),
      totalTrophies: gp.totalTrophies,
      coins: gp.coins,
      rank: rankFromTrophies(gp.totalTrophies),
      tiers: TIERS,
    });
  } catch (e) {
    console.error('games stats error:', e);
    res.status(500).json({ message: 'Failed to load game stats' });
  }
});

/** POST game result -> adjust trophies
 * body: { userId, gameKey, delta }  // e.g. +15 win, -5 loss (floored at 0)
 */
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
    await gp.save();

    // log history
    try {
      await GameResult.create({ userId: uid, gameKey, delta, didWin: delta > 0 });
    } catch (e) {
      console.warn('unable to create game result log', e?.message);
    }

    // Optional: award badges
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
      coins: gp.coins,
    });
  } catch (e) {
    console.error('games result error:', e);
    res.status(500).json({ message: 'Failed to post game result' });
  }
});

/** GET leaderboard by gameKey (top N) */
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
      { $project: { _id: 0, userId: '$userId', username: { $ifNull: ['$user.username', 'Player'] }, score: 1 } },
    ]);

    res.json({ leaders });
  } catch (e) {
    console.error('games leaderboard error:', e);
    res.status(500).json({ message: 'Failed to load leaderboard' });
  }
});

/** GET recent history for a user/gameKey */
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
