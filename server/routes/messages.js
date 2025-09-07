const router = require('express').Router();
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// Get unread total for a user
router.get('/unread/:userId', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);
    const convs = await Conversation.find({ participants: userId }).select('_id');
    const convIds = convs.map(c => c._id);
    if (convIds.length === 0) return res.json({ count: 0 });

    const count = await Message.countDocuments({
      conversationId: { $in: convIds },
      readBy: { $ne: userId },
      senderId: { $ne: userId }
    });

    res.json({ count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to get unread count' });
  }
});

// Get conversations for a user (with last message + unread per conversation)
router.get('/conversations/:userId', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);
    const convs = await Conversation.aggregate([
      { $match: { participants: userId } },
      {
        $lookup: {
          from: 'messages',
          let: { cid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$conversationId', '$$cid'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: 'last'
        }
      },
      { $unwind: { path: '$last', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          lastMessageAt: { $ifNull: ['$last.createdAt', '$updatedAt'] }
        }
      },
      { $sort: { lastMessageAt: -1 } }
    ]);

    // compute title/avatar + unread for each
    const result = [];
    for (const c of convs) {
      let title = c.name;
      let avatar = c.avatar || null;

      if (!c.isGroup) {
        const otherId = c.participants.find(id => id.toString() !== userId.toString());
        const other = await User.findById(otherId).select('username profilePicture').lean();
        title = other?.username || 'Direct Message';
        avatar = other?.profilePicture || null;
      }

      const unread = await Message.countDocuments({
        conversationId: c._id,
        readBy: { $ne: userId },
        senderId: { $ne: userId }
      });

      result.push({
        _id: c._id,
        isGroup: c.isGroup,
        title,
        avatar,
        last: c.last ? { body: c.last.body, createdAt: c.last.createdAt } : null,
        unread
      });
    }

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load conversations' });
  }
});

// Create conversation (DM if 1 participant; group if >=2)
router.post('/conversation', async (req, res) => {
  try {
    const { creatorId, participants, name } = req.body;
    const ids = [...new Set([creatorId, ...(participants || [])])].map(id => new mongoose.Types.ObjectId(id));
    const isGroup = ids.length > 2;

    if (!isGroup && ids.length === 2) {
      // reuse existing DM
      const existing = await Conversation.findOne({
        isGroup: false,
        participants: { $all: ids, $size: 2 }
      });
      if (existing) return res.json(existing);
    }

    const conv = await Conversation.create({
      participants: ids,
      isGroup,
      name: isGroup ? (name || 'Group chat') : null
    });

    res.json(conv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to create conversation' });
  }
});

// Get messages for conversation
router.get('/:conversationId', async (req, res) => {
  try {
    const msgs = await Message.find({ conversationId: req.params.conversationId })
      .sort({ createdAt: 1 })
      .lean();
    res.json(msgs);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load messages' });
  }
});

// Send message
router.post('/:conversationId', async (req, res) => {
  try {
    const { senderId, body } = req.body;
    const msg = await Message.create({
      conversationId: req.params.conversationId,
      senderId,
      body,
      readBy: [senderId]
    });
    await Conversation.findByIdAndUpdate(req.params.conversationId, { lastMessageAt: msg.createdAt });
    res.json(msg);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

// Mark conversation as read by user
router.put('/:conversationId/read', async (req, res) => {
  try {
    const { userId } = req.body;
    await Message.updateMany(
      { conversationId: req.params.conversationId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to mark read' });
  }
});

module.exports = router;
