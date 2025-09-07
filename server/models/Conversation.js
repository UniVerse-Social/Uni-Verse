const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    isGroup: { type: Boolean, default: false },
    name: { type: String, default: null },      // group name (null for DMs)
    avatar: { type: String, default: null },    // optional group avatar
    lastMessageAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// helpful indexes
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
