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

const StickerPlacementSchema = new mongoose.Schema(
  {
    stickerKey: { type: String, required: true }, // references catalog key
    assetType: { type: String, enum: ['emoji', 'image'], default: 'emoji' },
    assetValue: { type: String, required: true }, // fallback when catalog unavailable
    position: {
      x: { type: Number, default: 0.5 }, // normalized (0-1)
      y: { type: Number, default: 0.5 },
    },
    scale: { type: Number, default: 1 },
    rotation: { type: Number, default: 0 },
    placedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const StickerSettingsSchema = new mongoose.Schema(
  {
    allowMode: {
      type: String,
      enum: ['everyone', 'followers', 'none'],
      default: 'everyone',
    },
    allowlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    denylist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    sticky: { type: Boolean, default: false }, // whether stickers persist prominently
  },
  { _id: false }
);

const PostSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },     // keep as-is for compatibility
    username: { type: String, required: true },
    textContent: { type: String, maxLength: 280 },
    imageUrl: { type: String },                    // legacy single image
    attachments: [AttachmentSchema],               // NEW multi-attachments
    likes: { type: Array, default: [] },
    stickers: { type: [StickerPlacementSchema], default: [] },
    stickerSettings: { type: StickerSettingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Post', PostSchema);
