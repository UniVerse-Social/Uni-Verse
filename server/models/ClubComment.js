const mongoose = require('mongoose');

const ClubCommentSchema = new mongoose.Schema({
  postId:   { type: mongoose.Schema.Types.ObjectId, ref: 'ClubPost', required: true },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body:     { type: String, required: true, maxlength: 2000 },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClubComment', default: null },
  likes:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

ClubCommentSchema.index({ postId: 1, createdAt: 1 });

module.exports = mongoose.model('ClubComment', ClubCommentSchema);
