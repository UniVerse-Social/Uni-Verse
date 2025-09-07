const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body:           { type: String, required: true },
    readBy:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ conversationId: 1, readBy: 1 });

module.exports = mongoose.model('Message', MessageSchema);
