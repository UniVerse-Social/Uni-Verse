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

const PostSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },     // keep as-is for compatibility
    username: { type: String, required: true },
    textContent: { type: String, maxLength: 280 },
    imageUrl: { type: String },                    // legacy single image
    attachments: [AttachmentSchema],               // NEW multi-attachments
    likes: { type: Array, default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Post', PostSchema);
