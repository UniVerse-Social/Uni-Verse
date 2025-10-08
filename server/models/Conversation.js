const mongoose = require('mongoose');
const { Schema } = mongoose;

const ConversationSchema = new Schema(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    isGroup: { type: Boolean, default: false, index: true },
    // Display name for group chats (DMs infer title from the other user)
    name: { type: String, default: null },
    avatar: { type: String, default: null },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', ConversationSchema);
