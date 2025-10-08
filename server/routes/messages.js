const router = require('express').Router();
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { maskText, enforceNotBanned } = require('../middleware/moderation');

// --- Guards ---
async function ensureDmParticipant(req, res, next) {
  try {
    const actorId =
      req.body?.userId ||
      req.query?.userId ||
      req.headers['x-user-id'];

    if (!actorId) return res.status(401).json({ message: 'Missing user id' });

    // /conversations/:userId
    if (req.params?.userId && !req.params.conversationId) {
      if (String(req.params.userId) !== String(actorId)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      return next();
    }

    // any route with :conversationId
    if (req.params?.conversationId) {
      const conv = await Conversation.findById(req.params.conversationId)
        .select('participants')
        .lean();
      if (!conv) return res.status(404).json({ message: 'Conversation not found' });
      const ok = (conv.participants || []).map(String).includes(String(actorId));
      if (!ok) return res.status(403).json({ message: 'Forbidden' });
      return next();
    }

    next();
  } catch (e) {
    console.error('ensureDmParticipant error', e);
    res.status(500).json({ message: 'DM guard failed' });
  }
}

// --- Unread count ---
router.get('/unread/:userId', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);
    const convs = await Conversation.find({ participants: userId }).select('_id');
    const convIds = convs.map((c) => c._id);
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

// --- List conversations (returns title + avatar) ---
router.get('/conversations/:userId', ensureDmParticipant, async (req, res) => {
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
      { $addFields: { lastMessageAt: { $ifNull: ['$last.createdAt', '$updatedAt'] } } },
      { $sort: { lastMessageAt: -1 } }
    ]);

    const result = [];
    for (const c of convs) {
      let title = c.name;
      let avatar = c.avatar || null;

      if (!c.isGroup) {
        const otherId = c.participants.find((id) => id.toString() !== userId.toString());
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

// --- Create conversation ---
router.post('/conversation', async (req, res) => {
  try {
    const { creatorId, participants, name } = req.body;
    const ids = [...new Set([creatorId, ...(participants || [])])].map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const isGroup = ids.length > 2;

    // Reuse existing DM for 2 participants
    if (!isGroup && ids.length === 2) {
      const existing = await Conversation.findOne({
        isGroup: false,
        participants: { $all: ids, $size: 2 }
      });
      if (existing) return res.json(existing);
    }

    const conv = await Conversation.create({
      participants: ids,
      isGroup,
      name: isGroup ? name || 'Group chat' : null
    });

    res.json(conv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to create conversation' });
  }
});

// --- Conversation details (participants, name, avatar) ---
router.get('/conversation/:conversationId', ensureDmParticipant, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.conversationId)
      .select('participants isGroup name avatar updatedAt createdAt')
      .lean();

    if (!conv) return res.status(404).json({ message: 'Conversation not found' });

    res.json({
      _id: conv._id,
      isGroup: conv.isGroup,
      name: conv.name,
      avatar: conv.avatar,
      participants: conv.participants
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load conversation details' });
  }
});

// --- Get messages (by conversation) ---
router.get('/:conversationId', ensureDmParticipant, async (req, res) => {
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

// --- Send message ---
router.post('/:conversationId', enforceNotBanned, async (req, res) => {
  try {
    const { senderId, body, attachments } = req.body;
    const msg = await Message.create({
      conversationId: req.params.conversationId,
      senderId,
      body: maskText(body || ''),
      attachments: Array.isArray(attachments) ? attachments.slice(0, 10) : [],
      readBy: [senderId]
    });
    await Conversation.findByIdAndUpdate(req.params.conversationId, { lastMessageAt: msg.createdAt });
    res.json(msg);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

// --- Mark read ---
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

// --- Rename conversation (groups only) ---
router.put('/conversation/:conversationId', ensureDmParticipant, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    if (!conv.isGroup) return res.status(400).json({ message: 'Only groups can be renamed' });

    const raw = (req.body?.name ?? req.body?.title ?? '').toString().trim();
    if (!raw) return res.status(400).json({ message: 'Missing name' });
    conv.name = raw.slice(0, 80);
    await conv.save();

    res.json({ ok: true, _id: conv._id, name: conv.name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to rename conversation' });
  }
});

// Provide BOTH paths so legacy clients or different mounts keep working.
router.put('/:conversationId/avatar', ensureDmParticipant, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    if (!conv.isGroup) return res.status(400).json({ message: 'Only groups can have avatars' });

    const url = (req.body?.avatar || '').toString().trim();
    if (!url) return res.status(400).json({ message: 'Missing avatar URL' });

    conv.avatar = url;
    await conv.save();
    res.json({ ok: true, _id: conv._id, avatar: conv.avatar });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to update avatar' });
  }
});

router.put('/conversation/:conversationId/avatar', ensureDmParticipant, async (req, res) => {
  req.url = `/${req.params.conversationId}/avatar`;
  return router.handle(req, res);
});

module.exports = router;
