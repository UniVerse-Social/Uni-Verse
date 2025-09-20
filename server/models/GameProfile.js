// server/models/GameProfile.js
const mongoose = require('mongoose');

const GameProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, index: true, unique: true, required: true },
  trophiesByGame: {
    type: Map,
    of: Number,
    default: {},
  },
  totalTrophies: { type: Number, default: 0 },
  coins: { type: Number, default: 0 },
  lastResetAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('GameProfile', GameProfileSchema);
