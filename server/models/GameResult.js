// server/models/GameResult.js
const mongoose = require('mongoose');

const GameResultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
  gameKey: { type: String, index: true, required: true },
  delta: { type: Number, required: true },
  didWin: { type: Boolean, default: false },
}, { timestamps: true });

GameResultSchema.index({ userId: 1, createdAt: -1 });
GameResultSchema.index({ gameKey: 1, createdAt: -1 });

module.exports = mongoose.model('GameResult', GameResultSchema);
