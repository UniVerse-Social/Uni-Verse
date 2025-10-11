// server/routes/posts.js
const router = require('express').Router();
const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const { maskText, enforceNotBanned } = require('../middleware/moderation');
const { checkAndUnlock } = require('../services/badges');

const ALLOW_MODES = new Set(['everyone', 'followers', 'none']);
const uniqueStrings = (arr = []) => {
  const out = [];
  const seen = new Set();
  arr.forEach((val) => {
    if (val === null || val === undefined) return;
    const str = String(val).trim();
    if (!str) return;
    if (seen.has(str)) return;
    seen.add(str);
    out.push(str);
  });
  return out;
};

const toObjectIds = (values = []) => {
  const out = [];
  const seen = new Set();
  values.forEach((val) => {
    try {
      const oid = val instanceof mongoose.Types.ObjectId ? val : new mongoose.Types.ObjectId(val);
      const key = oid.toString();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(oid);
    } catch {
      // ignore invalid ids
    }
  });
  return out;
};

const sanitizeStickerSettings = (raw = {}) => {
  if (!raw || typeof raw !== 'object') return undefined;
  const settings = {};
  const mode = typeof raw.allowMode === 'string' ? raw.allowMode : '';
  settings.allowMode = ALLOW_MODES.has(mode) ? mode : 'everyone';
  if (Array.isArray(raw.allowlist)) {
    settings.allowlist = toObjectIds(uniqueStrings(raw.allowlist));
  }
  if (Array.isArray(raw.denylist)) {
    settings.denylist = toObjectIds(uniqueStrings(raw.denylist));
  }
  if (typeof raw.sticky === 'boolean') {
    settings.sticky = raw.sticky;
  }
  return settings;
};

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

    const stickerSettings = sanitizeStickerSettings(body.stickerSettings);
    if (stickerSettings) {
      body.stickerSettings = stickerSettings;
    } else {
      delete body.stickerSettings;
    }

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
    if (req.body.stickerSettings) {
      const stickerSettings = sanitizeStickerSettings(req.body.stickerSettings);
      if (stickerSettings) {
        updates.stickerSettings = stickerSettings;
      }
    }

    Object.assign(post, updates);
    await post.save();
    res.status(200).json(post);
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
const aggregatePostData = async (posts, viewerId) => {
  const authorIds = [...new Set(posts.map((p) => p.userId))];
  const postAuthors = await User.find({ _id: { $in: authorIds } });
  const authorMap = new Map(postAuthors.map((a) => [a._id.toString(), a]));

  const postIds = posts.map((p) => p._id);
  const commentMeta = new Map();
  const stickerUserIds = new Set();

  posts.forEach((post) => {
    (post.stickers || []).forEach((sticker) => {
      if (sticker.placedBy) {
        stickerUserIds.add(String(sticker.placedBy));
      }
    });
  });

  if (postIds.length) {
    const comments = await Comment.find({ postId: { $in: postIds } })
      .select('postId userId body parentId likes createdAt')
      .lean();

    const commentUserIds = new Set(comments.map((c) => String(c.userId)));
    const commentAuthorMap = commentUserIds.size
      ? new Map(
          (await User.find({ _id: { $in: Array.from(commentUserIds) } })
            .select('_id username')
            .lean()).map((u) => [String(u._id), u.username || 'user'])
        )
      : new Map();

    const byPost = new Map();
    comments.forEach((c) => {
      const key = String(c.postId);
      if (!byPost.has(key)) byPost.set(key, []);
      byPost.get(key).push(c);
    });

    const viewerIdStr = viewerId ? String(viewerId) : null;

    byPost.forEach((arr, key) => {
      arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const topLevel = arr.filter((c) => !c.parentId);
      let preview = null;
      if (topLevel.length) {
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
            username: commentAuthorMap.get(String(chosen.userId)) || 'user',
            body: chosen.body || '',
          };
        }
      }
      const userCommented = viewerIdStr ? arr.some((c) => String(c.userId) === viewerIdStr) : false;
      commentMeta.set(key, {
        count: arr.length,
        preview,
        userCommented,
      });
    });
  }

  const stickerUsers = stickerUserIds.size
    ? await User.find({ _id: { $in: Array.from(stickerUserIds) } })
        .select('_id username profilePicture')
        .lean()
    : [];
  const stickerUserMap = new Map(stickerUsers.map((u) => [String(u._id), u]));

  return posts
    .map((post) => {
      const author = authorMap.get(post.userId.toString());
      const obj = post.toObject();
      obj.username       = author ? author.username : 'Unknown User';
      obj.profilePicture = author ? author.profilePicture : '';
      obj.titleBadge     = author?.badgesEquipped?.[0] || null; // slot 0 is "Title"
      obj.authorDepartment = author?.department || '';
      obj.authorHobbies = Array.isArray(author?.hobbies) ? author.hobbies : [];
      obj.viewerLiked = viewerId ? (post.likes || []).some((id) => String(id) === String(viewerId)) : false;

      const meta = commentMeta.get(post._id.toString());
      obj.commentCount = meta?.count || 0;
      obj.commentPreview = meta?.preview || null;
      obj.viewerCommented = meta?.userCommented || false;

      obj.stickers = (post.stickers || []).map((sticker) => {
        const placement = {
          id: sticker._id,
          stickerKey: sticker.stickerKey,
          assetType: sticker.assetType,
          assetValue: sticker.assetValue,
          position: sticker.position,
          scale: sticker.scale,
          rotation: sticker.rotation,
          placedBy: sticker.placedBy ? String(sticker.placedBy) : null,
          createdAt: sticker.createdAt,
          updatedAt: sticker.updatedAt,
        };
        const sUser = placement.placedBy ? stickerUserMap.get(placement.placedBy) : null;
        if (sUser) {
          placement.placedByUser = {
            _id: String(sUser._id),
            username: sUser.username,
            profilePicture: sUser.profilePicture,
          };
        }
        return placement;
      });
      const settings = post.stickerSettings || {};
      obj.stickerSettings = {
        allowMode: settings.allowMode || 'everyone',
        allowlist: Array.isArray(settings.allowlist)
          ? settings.allowlist.map((id) => String(id))
          : [],
        denylist: Array.isArray(settings.denylist)
          ? settings.denylist.map((id) => String(id))
          : [],
        sticky: Boolean(settings.sticky),
      };

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

    res.status(200).json(await aggregatePostData(own.concat(friends), me._id));
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

    const viewerId = req.query.viewerId;
    const posts = await Post.find({ userId: user._id });
    res.status(200).json(await aggregatePostData(posts, viewerId));
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

// helper: parse boolean-ish query values
const parseBool = (v, def = false) => {
  if (v === undefined) return def;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
};

/**
 * GET /api/posts/home-feed/:userId
 * Query params:
 *  - showOwn, showFollowers, includeNonFollowers, includeSameDepartment,
 *    onlyInteracted, sharedInterestsOnly (all boolean-ish)
 *  - sort: 'newest' | 'mostLiked'
 *  - limit: optional, default 250 (max 500)
 *
 * Note: `showFollowers` here means "people I follow" (to match existing timeline semantics)
 */
router.get('/home-feed/:userId', async (req, res) => {
  try {
    const me = await User.findById(req.params.userId)
      .select('following department hobbies')
      .lean();
    if (!me) return res.status(404).json('User not found');

    const showOwn              = parseBool(req.query.showOwn, true);
    const showFollowers        = parseBool(req.query.showFollowers, true); // i.e., following
    const includeNonFollowers  = parseBool(req.query.includeNonFollowers, false);
    const includeSameDepartment= parseBool(req.query.includeSameDepartment, false);
    const onlyInteracted       = parseBool(req.query.onlyInteracted, false);
    const sharedInterestsOnly  = parseBool(req.query.sharedInterestsOnly, false);
    const sortKey              = req.query.sort === 'mostLiked' ? 'mostLiked' : 'newest';
    const limit                = Math.min(parseInt(req.query.limit, 10) || 250, 500);

    // Build author set if we're NOT exploring the whole network
    let match = {};
    if (!includeNonFollowers) {
      const idSet = new Set();
      if (showOwn) idSet.add(String(me._id));
      if (showFollowers && Array.isArray(me.following)) {
        for (const f of me.following) idSet.add(String(f));
      }

      // same department expansion (when requested)
      if (includeSameDepartment && me.department) {
        const sameDept = await User.find({
          department: me.department,
          _id: { $ne: me._id },
        }).select('_id');
        for (const u of sameDept) idSet.add(String(u._id));
      }

      const authorIds = Array.from(idSet).map((id) => new mongoose.Types.ObjectId(id));
      match = authorIds.length ? { userId: { $in: authorIds } } : { userId: null }; // empty result if none
    }

    // Pull a sufficiently large recent window
    const rawPosts = await Post.find(match).sort({ createdAt: -1 }).limit(limit);
    let hydrated = await aggregatePostData(rawPosts, me._id);

    // If we included "everyone", respect opt-outs (hide own / following if toggles are off)
    if (includeNonFollowers) {
      if (!showOwn) {
        hydrated = hydrated.filter((p) => String(p.userId) !== String(me._id));
      }
      if (!showFollowers && Array.isArray(me.following)) {
        const followingSet = new Set(me.following.map((x) => String(x)));
        hydrated = hydrated.filter((p) => !followingSet.has(String(p.userId)));
      }
      // Department toggle is redundant when "everyone" is on (feed already includes dept),
      // but sharedInterests/onlyInteracted will still apply below.
    }

    // Shared interests filter
    if (sharedInterestsOnly) {
      const myHobbies = new Set(Array.isArray(me.hobbies) ? me.hobbies : []);
      hydrated = hydrated.filter((p) =>
        Array.isArray(p.authorHobbies) && p.authorHobbies.some((h) => myHobbies.has(h))
      );
    }

    // Only posts I've interacted with (liked or commented)
    if (onlyInteracted) {
      hydrated = hydrated.filter((p) => p.viewerLiked || p.viewerCommented);
    }

    // Sort: newest (default) vs most liked
    if (sortKey === 'mostLiked') {
      hydrated = [...hydrated].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
    }
    // 'newest' is already ensured by aggregatePostData's default ordering

    res.json(hydrated);
  } catch (err) {
    console.error('home-feed error:', err);
    res.status(500).json({ message: 'Failed to load home feed' });
  }
});

module.exports = router;