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
      score: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const CommentSchema = new mongoose.Schema(
  {
    postId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body:     { type: String, default: '', maxlength: 2000 },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null }, // reply-to
    likes:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    attachments: { type: [AttachmentSchema], default: [] },
  },
  { timestamps: true }
);

CommentSchema.index({ postId: 1, createdAt: 1 });
CommentSchema.index({ parentId: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', CommentSchema);