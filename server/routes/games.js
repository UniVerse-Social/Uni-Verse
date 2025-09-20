// server/routes/games.js
const router = require('express').Router();
const mongoose = require('mongoose');
const GameProfile = require('../models/GameProfile');
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
  let r = TIERS[0].name;
  for (const t of TIERS) if (total >= t.min) r = t.name;
  return r;
}

async function ensureProfile(userId) {
  let gp = await GameProfile.findOne({ userId });
  if (!gp) gp = await GameProfile.create({ userId });
  return gp;
}

// Reset rule: If a new calendar month has started and rank was Champion,
// clamp total to 1500 and convert overflow to coins.
async function maybeMonthlyReset(gp) {
  const then = new Date(gp.lastResetAt || Date.now());
  const now = new Date();
  const changedMonth = (then.getUTCFullYear() !== now.getUTCFullYear()) || (then.getUTCMonth() !== now.getUTCMonth());
  if (!changedMonth) return gp;

  const currentRank = rankFromTrophies(gp.totalTrophies);
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

    // Optional: award "Gamer" on first ever trophy, and rank badges for thresholds
    try {
      if (Math.abs(delta) > 0) {
        await checkAndUnlock(userId, { type: 'played_game' });
        const r = rankFromTrophies(gp.totalTrophies);
        await checkAndUnlock(userId, { type: 'games_rank', rank: r });
      }
    } catch (_) {}

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

module.exports = router;
