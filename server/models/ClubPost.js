const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ['image'], default: 'image' },
    width: Number,
    height: Number,
    scan: {
      safe: { type: Boolean, default: true },
      labels: [{ type: String }],
      score: { type: Number, default: 0 }
    }
  },
  { _id: false }
);

const ClubPostSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    channel: { type: String, enum: ['main', 'side'], default: 'side' },
    sideChannelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club.sideChannels', default: null },
    text: { type: String, default: '' },
    images: [{ type: String }],                  // keep for existing UI
    attachments: [AttachmentSchema],             // NEW forward-compat
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

ClubPostSchema.index({ clubId: 1, channel: 1, createdAt: -1 });

module.exports = mongoose.model('ClubPost', ClubPostSchema);
