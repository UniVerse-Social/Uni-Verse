// server/models/GameProfile.js
const mongoose = require('mongoose');

const GameProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, index: true, unique: true, required: true },

  // Per-game trophies (Map of Number) and aggregate
  trophiesByGame: { type: Map, of: Number, default: {} },
  totalTrophies: { type: Number, default: 0 },

  // Coins & resets
  coins: { type: Number, default: 0 },
  lastResetAt: { type: Date, default: Date.now },

  lastDailyCoinAt: { type: Date, default: null }, // auto +100/day on first stats fetch
  badgeCoinLog: { type: [String], default: [] },  // idempotent +100 per badgeKey
}, { timestamps: true });

module.exports = mongoose.model('GameProfile', GameProfileSchema);
