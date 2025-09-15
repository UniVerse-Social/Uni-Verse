const mongoose = require('mongoose');

const ClubPostSchema = new mongoose.Schema({
  clubId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  authorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channel:   { type: String, enum: ['main', 'side'], default: 'side' },
  sideChannelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club.sideChannels', default: null },
  text:      { type: String, default: '' },
  images:    [{ type: String }],
  likes:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

ClubPostSchema.index({ clubId: 1, channel: 1, createdAt: -1 });

module.exports = mongoose.model('ClubPost', ClubPostSchema);
