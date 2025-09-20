// server/routes/posts.js
const router = require('express').Router();
const Post = require('../models/Post');
const User = require('../models/User');
const { maskText, enforceNotBanned } = require('../middleware/moderation');
const { checkAndUnlock } = require('../services/badges');

// CREATE A POST (with text masking; attachments optional)
router.post('/', enforceNotBanned, async (req, res) => {
  try {
    const body = { ...req.body };

    // sanitize text
    if (typeof body.textContent === 'string') {
      body.textContent = maskText(body.textContent);
    }

    // normalize attachments to an array (limit to 10 to be safe)
    if (!Array.isArray(body.attachments)) body.attachments = [];
    body.attachments = body.attachments.slice(0, 10);

    const post = await Post.create(body);

    // ---- Badge checks fired by post creation ----
    try {
      const hasImage =
        (Array.isArray(post.attachments) && post.attachments.some(a => a?.type === 'image')) ||
        (post.imageUrl && String(post.imageUrl).trim());

      await checkAndUnlock(post.userId, {
        type: 'post_created',
        userId: post.userId,
        createdAt: post.createdAt,
        hasImage: !!hasImage,
      });
    } catch (e) {
      console.warn('Badge post_created check failed:', e?.message || e);
    }

    res.status(200).json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

// UPDATE A POST (owner only; mask text)
router.put('/:id', enforceNotBanned, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json('Post not found');
    if (String(post.userId) !== String(req.body.userId)) {
      return res.status(403).json('You can update only your post');
    }

    const updates = {};
    if (typeof req.body.textContent === 'string') {
      updates.textContent = maskText(req.body.textContent);
    }
    if (Array.isArray(req.body.attachments)) {
      updates.attachments = req.body.attachments.slice(0, 10);
    }

    await post.updateOne({ $set: updates });
    res.status(200).json('The post has been updated');
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

// DELETE A POST (owner only)
router.delete('/:id', enforceNotBanned, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json('Post not found');
    if (String(post.userId) !== String(req.body.userId)) {
      return res.status(403).json('You can delete only your post');
    }
    await post.deleteOne();
    res.status(200).json('The post has been deleted');
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

// LIKE / UNLIKE
router.put('/:id/like', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json('Post not found');

    const likerId = req.body.userId;

    if (!post.likes.includes(likerId)) {
      await post.updateOne({ $push: { likes: likerId } });
      res.status(200).json('The post has been liked');
    } else {
      await post.updateOne({ $pull: { likes: likerId } });
      res.status(200).json('The post has been disliked');
    }

    // fire-and-forget badge checks (Helpful/Popular etc.)
    checkAndUnlock(likerId, {
      type: 'like_toggled',
      likerId,
      postAuthorId: post.userId,
    }).catch(() => {});
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

// Helper to hydrate author info (+ title badge)
const aggregatePostData = async (posts) => {
  const authorIds = [...new Set(posts.map((p) => p.userId))];
  const postAuthors = await User.find({ _id: { $in: authorIds } });
  const authorMap = new Map(postAuthors.map((a) => [a._id.toString(), a]));

  return posts
    .map((post) => {
      const author = authorMap.get(post.userId.toString());
      const obj = post.toObject();
      obj.username       = author ? author.username : 'Unknown User';
      obj.profilePicture = author ? author.profilePicture : '';
      obj.titleBadge     = author?.badgesEquipped?.[0] || null; // slot 0 is "Title"
      return obj;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// TIMELINE (self + following)
router.get('/timeline/:userId', async (req, res) => {
  try {
    const me = await User.findById(req.params.userId);
    if (!me) return res.status(404).json('User not found');

    const own = await Post.find({ userId: me._id });
    const friends = await Post.find({ userId: { $in: me.following || [] } });

    res.status(200).json(await aggregatePostData(own.concat(friends)));
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

// PROFILE feed
router.get('/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json('User not found');

    const posts = await Post.find({ userId: user._id });
    res.status(200).json(await aggregatePostData(posts));
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

module.exports = router;
