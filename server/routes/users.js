const router = require('express').Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// ---------- GET USER BY USERNAME ----------
router.get("/profile/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json("User not found");
    const { password, ...other } = user._doc;
    res.status(200).json(other);
  } catch (err) {
    res.status(500).json(err);
  }
});

// ---------- UPDATE USER ----------
router.put("/:id", async (req, res) => {
  if (req.body.userId === req.params.id) {
    if (req.body.password) {
      try {
        const salt = await bcrypt.genSalt(10);
        req.body.password = await bcrypt.hash(req.body.password, salt);
      } catch (err) {
        return res.status(500).json(err);
      }
    }
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true }
      );
      const { password, ...other } = user._doc;
      res.status(200).json(other);
    } catch (err) {
      return res.status(500).json(err);
    }
  } else {
    return res.status(403).json("You can update only your account!");
  }
});

// ---------- FOLLOW / UNFOLLOW ----------
router.put("/:id/follow", async (req, res) => {
  if (req.body.userId !== req.params.id) {
    try {
      const userToFollow = await User.findById(req.params.id);
      const currentUser = await User.findById(req.body.userId);
      if (!userToFollow.followers.includes(req.body.userId)) {
        await userToFollow.updateOne({ $push: { followers: req.body.userId } });
        await currentUser.updateOne({ $push: { following: req.params.id } });
        res.status(200).json("User has been followed");
      } else {
        await userToFollow.updateOne({ $pull: { followers: req.body.userId } });
        await currentUser.updateOne({ $pull: { following: req.params.id } });
        res.status(200).json("User has been unfollowed");
      }
    } catch (err) {
      res.status(500).json(err);
    }
  } else {
    res.status(403).json("You can't follow yourself");
  }
});

// ---------- USER SEARCH ----------
/**
 * GET /api/users/search?q=...&userId=...
 * - Matches username, department, or hobbies (case-insensitive)
 * - Excludes current user if userId is provided
 * - Marks 'isFollowing' if userId is provided (for UI state)
 */
router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const me = req.query.userId ? new mongoose.Types.ObjectId(req.query.userId) : null;

    if (!q) return res.status(200).json([]);

    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const match = {
      $or: [
        { username: rx },
        { department: rx },
        { hobbies: rx }
      ]
    };
    if (me) match._id = { $ne: me };

    const users = await User.find(match)
      .select("-password -email")
      .limit(30)
      .lean();

    if (me) {
      const mine = await User.findById(me).select("following").lean();
      const followingSet = new Set((mine?.following || []).map(id => id.toString()));
      users.forEach(u => (u.isFollowing = followingSet.has(u._id.toString())));
    }

    res.status(200).json(users);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Search failed" });
  }
});

// ---------- IMPROVED SUGGESTIONS ----------
/**
 * GET /api/users/suggestions/:userId
 * - Excludes self and already-following
 * - Ranks by department (x3), mutuals (x2), and shared hobbies (x1)
 * - Returns up to 20 users (you can change via ?limit=)
 */
router.get("/suggestions/:userId", async (req, res) => {
  try {
    const meId = new mongoose.Types.ObjectId(req.params.userId);
    const me = await User.findById(meId).select("department hobbies following").lean();
    if (!me) return res.status(404).json("User not found");

    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const pipeline = [
      { $match: { _id: { $ne: meId, $nin: me.following || [] } } },
      {
        $addFields: {
          sharedHobbiesCount: { $size: { $setIntersection: ["$hobbies", me.hobbies || []] } },
          deptMatch: { $cond: [{ $eq: ["$department", me.department || null] }, 1, 0] },
          mutualCount: { $size: { $setIntersection: ["$following", me.following || []] } }
        }
      },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ["$deptMatch", 3] },
              { $multiply: ["$mutualCount", 2] },
              "$sharedHobbiesCount"
            ]
          }
        }
      },
      { $sort: { score: -1, createdAt: -1 } },
      { $project: { password: 0, email: 0 } },
      { $limit: limit }
    ];

    const users = await User.aggregate(pipeline);
    res.status(200).json(users);
  } catch (err) {
    console.error("Suggestions error:", err);
    res.status(500).json(err);
  }
});

const Post = require('../models/Post');

router.delete('/:id', async (req, res) => {
  try {
    if (req.body.userId !== req.params.id) {
      return res.status(403).json("You can delete only your account!");
    }
    await Post.deleteMany({ userId: req.params.id });
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

module.exports = router;
