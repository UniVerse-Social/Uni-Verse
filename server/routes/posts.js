const router = require('express').Router();
const Post = require('../models/Post');
const User = require('../models/User');

// CREATE A POST
router.post("/", async (req, res) => {
    const newPost = new Post(req.body);
    try {
        const savedPost = await newPost.save();
        res.status(200).json(savedPost);
    } catch (err) {
        res.status(500).json(err);
    }
});

// --- NEW: UPDATE A POST ---
router.put("/:id", async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (post.userId.toString() === req.body.userId) { // Ensure the user owns the post
            await post.updateOne({ $set: { textContent: req.body.textContent } });
            res.status(200).json("The post has been updated");
        } else {
            res.status(403).json("You can update only your post");
        }
    } catch (err) {
        res.status(500).json(err);
    }
});

// DELETE A POST
router.delete("/:id", async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (post.userId.toString() === req.body.userId) { // Ensure the user owns the post
            await post.deleteOne();
            res.status(200).json("The post has been deleted");
        } else {
            res.status(403).json("You can delete only your post");
        }
    } catch (err) {
        res.status(500).json(err);
    }
});


// LIKE / DISLIKE A POST
router.put("/:id/like", async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post.likes.includes(req.body.userId)) {
            await post.updateOne({ $push: { likes: req.body.userId } });
            res.status(200).json("The post has been liked");
        } else {
            await post.updateOne({ $pull: { likes: req.body.userId } });
            res.status(200).json("The post has been disliked");
        }
    } catch (err) {
        res.status(500).json(err);
    }
});

// AGGREGATE POST DATA HELPER
const aggregatePostData = async (posts) => {
    const authorIds = [...new Set(posts.map(p => p.userId))];
    const postAuthors = await User.find({ _id: { $in: authorIds } });
    const authorMap = new Map(postAuthors.map(author => [author._id.toString(), author]));
    return posts.map(post => {
        const author = authorMap.get(post.userId.toString());
        const postObject = post.toObject(); 
        postObject.username = author ? author.username : "Unknown User";
        postObject.profilePicture = author ? author.profilePicture : "";
        return postObject;
    }).sort((p1, p2) => new Date(p2.createdAt) - new Date(p1.createdAt));
};

// GET TIMELINE POSTS
router.get("/timeline/:userId", async (req, res) => {
    try {
        const currentUser = await User.findById(req.params.userId);
        if (!currentUser) return res.status(404).json("User not found");
        const userPosts = await Post.find({ userId: currentUser._id });
        const friendPosts = await Post.find({ userId: { $in: currentUser.following } });
        const aggregatedPosts = await aggregatePostData(userPosts.concat(friendPosts));
        res.status(200).json(aggregatedPosts);
    } catch (err) {
        res.status(500).json(err);
    }
});

// GET A USER'S POSTS
router.get("/profile/:username", async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json("User not found");
        const posts = await Post.find({ userId: user._id });
        const aggregatedPosts = await aggregatePostData(posts);
        res.status(200).json(aggregatedPosts);
    } catch (err) {
        res.status(500).json(err);
    }
});

module.exports = router;