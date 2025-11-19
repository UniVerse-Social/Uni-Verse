const router = require('express').Router();
const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Post = require('../models/Post');
const { enforceTextLimits, COMMENT_CHAR_LIMIT } = require('../utils/textLimits');

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

// Get all comments for a post (flat; client nests by parentId) — ENRICHED with username & profilePicture
router.get('/post/:postId', async (req, res) => {
  try {
    const postId = new mongoose.Types.ObjectId(req.params.postId);
    const comments = await Comment.find({ postId }).sort({ createdAt: 1 }).lean();

    if (comments.length === 0) return res.json([]);

    // Fetch authors once, map onto comments
    const authorIds = [...new Set(comments.map(c => String(c.userId)))];
    const authors = await User.find({ _id: { $in: authorIds } })
      .select('_id username profilePicture')
      .lean();
    const map = new Map(authors.map(u => [String(u._id), u]));

    const enriched = comments.map(c => {
      const u = map.get(String(c.userId));
      return {
        ...c,
        username: u?.username || 'user',
        profilePicture: u?.profilePicture || '',
      };
    });

    res.json(enriched);
  } catch (e) {
    console.error('comments list error', e);
    res.status(500).json({ message: 'Failed to load comments' });
  }
});

// Count for a post
router.get('/post/:postId/count', async (req, res) => {
  try {
    const postId = new mongoose.Types.ObjectId(req.params.postId);
    const count = await Comment.countDocuments({ postId });

    const topLevel = await Comment.find({ postId, parentId: null })
      .sort({ createdAt: -1 })
      .lean();

    let preview = null;
    if (topLevel.length > 0) {
      const userIds = [...new Set(topLevel.map(c => String(c.userId)))];
      const authors = await User.find({ _id: { $in: userIds } })
        .select('_id username')
        .lean();
      const nameMap = new Map(authors.map(a => [String(a._id), a.username || 'user']));
      const byLikes = [...topLevel].sort((a, b) => {
        const likeDiff = (b.likes?.length || 0) - (a.likes?.length || 0);
        if (likeDiff !== 0) return likeDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      const likedTop = byLikes.find(c => (c.likes?.length || 0) > 0);
      const latest = topLevel[0];
      const chosen = likedTop ? { type: 'top', comment: likedTop } : latest ? { type: 'latest', comment: latest } : null;
      if (chosen) {
        preview = {
          type: chosen.type,
          username: nameMap.get(String(chosen.comment.userId)) || 'user',
          body: chosen.comment.body || '',
          likes: chosen.comment.likes?.length || 0,
          createdAt: chosen.comment.createdAt,
        };
        if (chosen.type === 'latest' && (chosen.comment.likes?.length || 0) === 0) {
          // ensure we only indicate "latest" when no liked top comment exists
          preview.type = 'latest';
        }
      }
    }

    let userCommented = false;
    const viewerIdRaw = req.query.viewerId;
    if (viewerIdRaw && mongoose.isValidObjectId(viewerIdRaw)) {
      const viewerObjectId = new mongoose.Types.ObjectId(viewerIdRaw);
      userCommented = !!(await Comment.exists({ postId, userId: viewerObjectId }));
    }

    res.json({ count, preview, userCommented });
  } catch (e) {
    console.error('comment preview error', e);
    res.status(500).json({ message: 'Failed to count comments' });
  }
});

// Create a comment (or reply)
router.post('/', async (req, res) => {
  try {
    const { postId, userId, body, parentId, attachments } = req.body || {};
    const trimmed = enforceTextLimits(body || '', COMMENT_CHAR_LIMIT).trim();
    const safeAttachments = normalizeAttachments(attachments);

    if (!postId || !userId || (!trimmed && safeAttachments.length === 0)) {
      return res.status(400).json({ message: 'Missing comment content' });
    }

    // If replying, validate the parent belongs to same post
    if (parentId) {
      const parent = await Comment.findById(parentId).lean();
      if (!parent || String(parent.postId) !== String(postId)) {
        return res.status(400).json({ message: 'Invalid parentId' });
      }
    }

    const created = await Comment.create({
      postId,
      userId,
      body: trimmed,
      parentId: parentId || null,
      attachments: safeAttachments,
    });

    res.status(201).json(created);
  } catch (e) {
    console.error('comment create error', e);
    res.status(500).json({ message: 'Failed to comment' });
  }
});

// Like/unlike a comment
router.put('/:id/like', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ message: 'Missing userId' });

    const c = await Comment.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Not found' });

    const has = c.likes.map(String).includes(String(userId));
    await c.updateOne(has ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } });

    res.json({ liked: !has });
  } catch (e) {
    console.error('comment like error', e);
    res.status(500).json({ message: 'Failed to like' });
  }
});

// Delete (author only) – removes replies to keep threads clean
router.delete('/:id', async (req, res) => {
  try {
    const { userId } = req.body || {};
    const c = await Comment.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Not found' });
    const post = await Post.findById(c.postId).select('userId').lean();
    const isCommentAuthor = String(c.userId) === String(userId);
    const isPostOwner = post && String(post.userId) === String(userId);
    if (!isCommentAuthor && !isPostOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await Comment.deleteMany({ $or: [{ _id: c._id }, { parentId: c._id }] });
    res.json({ ok: true });
  } catch (e) {
    console.error('comment delete error', e);
    res.status(500).json({ message: 'Failed to delete' });
  }
});

module.exports = router;
