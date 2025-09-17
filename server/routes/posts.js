const router = require('express').Router();
const Post = require('../models/Post');
const User = require('../models/User');
const { maskText, enforceNotBanned } = require('../middleware/moderation');

// CREATE A POST (with text masking; attachments optional)
router.post('/', enforceNotBanned, async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.textContent) body.textContent = maskText(body.textContent);
    if (!Array.isArray(body.attachments)) body.attachments = [];

    const post = await Post.create(body);
    res.status(200).json(post);
  } catch (err) {
    res.status(500).json(err);
  }
});

// UPDATE A POST (owner only; mask text)
router.put('/:id', enforceNotBanned, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json('Post not found');
    if (post.userId.toString() !== req.body.userId) {
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
    res.status(500).json(err);
  }
});

// DELETE A POST (owner only)
router.delete('/:id', enforceNotBanned, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json('Post not found');
    if (post.userId.toString() !== req.body.userId) {
      return res.status(403).json('You can delete only your post');
    }
    await post.deleteOne();
    res.status(200).json('The post has been deleted');
  } catch (err) {
    res.status(500).json(err);
  }
});

// LIKE / DISLIKE A POST (unchanged)
router.put('/:id/like', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post.likes.includes(req.body.userId)) {
      await post.updateOne({ $push: { likes: req.body.userId } });
      res.status(200).json('The post has been liked');
    } else {
      await post.updateOne({ $pull: { likes: req.body.userId } });
      res.status(200).json('The post has been disliked');
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// Helpers preserved from your file to hydrate author and order
const aggregatePostData = async (posts) => {
  const authorIds = [...new Set(posts.map((p) => p.userId))];
  const postAuthors = await User.find({ _id: { $in: authorIds } });
  const authorMap = new Map(postAuthors.map((author) => [author._id.toString(), author]));
  return posts
    .map((post) => {
      const author = authorMap.get(post.userId.toString());
      const postObject = post.toObject();
      postObject.username = author ? author.username : 'Unknown User';
      postObject.profilePicture = author ? author.profilePicture : '';
      return postObject;
    })
    .sort((p1, p2) => new Date(p2.createdAt) - new Date(p1.createdAt));
};

// GET TIMELINE POSTS (unchanged logic)
router.get('/timeline/:userId', async (req, res) => {
  try {
    const currentUser = await User.findById(req.params.userId);
    if (!currentUser) return res.status(404).json('User not found');
    const userPosts = await Post.find({ userId: currentUser._id });
    const friendPosts = await Post.find({ userId: { $in: currentUser.following } });
    const aggregatedPosts = await aggregatePostData(userPosts.concat(friendPosts));
    res.status(200).json(aggregatedPosts);
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET A USER'S POSTS (unchanged logic)
router.get('/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json('User not found');
    const posts = await Post.find({ userId: user._id });
    const aggregatedPosts = await aggregatePostData(posts);
    res.status(200).json(aggregatedPosts);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
