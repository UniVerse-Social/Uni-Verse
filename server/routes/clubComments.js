const router = require('express').Router();
const mongoose = require('mongoose');
const ClubComment = require('../models/ClubComment');
const User = require('../models/User');
const ClubPost = require('../models/ClubPost');

function normalizeAttachments(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((att) => att && att.url)
    .slice(0, 6)
    .map((att) => ({
      url: att.url,
      type: att.type === 'image' ? 'image' : 'image',
      width: typeof att.width === 'number' ? att.width : undefined,
      height: typeof att.height === 'number' ? att.height : undefined,
      scan: att.scan && typeof att.scan === 'object' ? att.scan : undefined,
    }));
}

// list
router.get('/post/:postId', async (req,res)=>{
  const postId = new mongoose.Types.ObjectId(req.params.postId);
  const comments = await ClubComment.find({ postId }).sort({ createdAt: 1 }).lean();
  if (!comments.length) return res.json([]);

  const authorIds = [...new Set(comments.map(c => String(c.userId)))];
  const authors = await User.find({ _id: { $in: authorIds } })
    .select('_id username profilePicture')
    .lean();
  const nameMap = new Map(authors.map((u) => [String(u._id), u]));

  const enriched = comments.map((c) => {
    const info = nameMap.get(String(c.userId));
    return {
      ...c,
      username: info?.username || 'user',
      profilePicture: info?.profilePicture || '',
    };
  });

  res.json(enriched);
});
router.get('/post/:postId/count', async (req,res)=>{
  try {
    const postId = new mongoose.Types.ObjectId(req.params.postId);
    const count = await ClubComment.countDocuments({ postId });

    const topLevel = await ClubComment.find({ postId, parentId: null })
      .sort({ createdAt: -1 })
      .lean();

    let preview = null;
    if (topLevel.length) {
      const authorIds = [...new Set(topLevel.map(c => String(c.userId)))];
      const authors = await User.find({ _id: { $in: authorIds } })
        .select('_id username')
        .lean();
      const nameMap = new Map(authors.map((u) => [String(u._id), u.username || 'user']));

      const sortedByLikes = [...topLevel].sort((a, b) => {
        const likeDiff = (b.likes?.length || 0) - (a.likes?.length || 0);
        if (likeDiff !== 0) return likeDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      const likedTop = sortedByLikes.find((c) => (c.likes?.length || 0) > 0);
      const latest = topLevel[0];
      const chosen = likedTop || latest;
      if (chosen) {
        preview = {
          type: likedTop ? 'top' : 'latest',
          username: nameMap.get(String(chosen.userId)) || 'user',
          body: chosen.body || '',
          likes: chosen.likes?.length || 0,
          createdAt: chosen.createdAt,
        };
      }
    }

    let userCommented = false;
    const viewerId = req.query.viewerId;
    if (viewerId && mongoose.isValidObjectId(viewerId)) {
      userCommented = !!(await ClubComment.exists({ postId, userId: new mongoose.Types.ObjectId(viewerId) }));
    }

    res.json({ count, preview, userCommented });
  } catch (e) {
    console.error('club comment count failed', e);
    res.status(500).json({ message: 'Failed to count comments' });
  }
});
// create / reply
router.post('/', async (req,res)=>{
  const { postId, userId, body, parentId, attachments } = req.body || {};
  const trimmed = String(body || '').trim();
  const safeAttachments = normalizeAttachments(attachments);
  if (!postId || !userId || (!trimmed && safeAttachments.length === 0)) return res.status(400).json({ message: 'Missing comment content' });
  if (parentId) {
    const parent = await ClubComment.findById(parentId).lean();
    if (!parent || String(parent.postId) !== String(postId)) return res.status(400).json({ message: 'Invalid parentId' });
  }
  const created = await ClubComment.create({
    postId,
    userId,
    body: trimmed,
    parentId: parentId || null,
    attachments: safeAttachments,
  });
  res.status(201).json(created);
});
// like
router.put('/:id/like', async (req,res)=>{
  const { userId } = req.body || {};
  const c = await ClubComment.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Not found' });
  const has = (c.likes || []).map(String).includes(String(userId));
  await c.updateOne(has ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } });
  res.json({ liked: !has });
});
// delete
router.delete('/:id', async (req,res)=>{
  const { userId } = req.body || {};
  const c = await ClubComment.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Not found' });
  const post = await ClubPost.findById(c.postId).select('authorId').lean();
  const isAuthor = String(c.userId) === String(userId);
  const isPostOwner = post && String(post.authorId) === String(userId);
  if (!isAuthor && !isPostOwner) return res.status(403).json({ message: 'Forbidden' });
  await ClubComment.deleteMany({ $or: [{ _id: c._id }, { parentId: c._id }] });
  res.json({ ok: true });
});

module.exports = router;