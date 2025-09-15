const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema(
  {
    postId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body:     { type: String, required: true, maxlength: 2000 },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null }, // reply-to
    likes:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

CommentSchema.index({ postId: 1, createdAt: 1 });
CommentSchema.index({ parentId: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', CommentSchema);
