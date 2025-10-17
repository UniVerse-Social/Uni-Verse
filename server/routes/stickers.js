const router = require('express').Router();
const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const stickersCatalog = require('../data/stickers');
const { enforceNotBanned } = require('../middleware/moderation');

const catalogMap = new Map(stickersCatalog.map((s) => [s.key, s]));

const MAX_CUSTOM_STICKER_LENGTH = 6_500_000; // ~4 MB binary payload (base64 expansion)

const makeCustomKey = () => `custom-${new mongoose.Types.ObjectId().toString()}`;

const toObjectId = (value) => {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(value);
  } catch {
    return null;
  }
};

const uniqueObjectIds = (values = []) => {
  const out = [];
  const seen = new Set();
  values.forEach((val) => {
    const oid = toObjectId(val);
    if (!oid) return;
    const key = String(oid);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(oid);
  });
  return out;
};

const clamp = (value, min, max, fallback = min) => {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(Math.max(num, min), max);
};

const sanitizeAnchor = (payload = {}) => {
  const requested = payload.anchor;
  const anchorType = requested === 'media' || requested === 'text' ? requested : 'card';
  if (anchorType === 'card') {
    return {
      anchor: 'card',
      anchorRect: { top: 0, left: 0, width: 1, height: 1 },
    };
  }
  const rect = payload.anchorRect || {};
  const top = clamp(rect.top, 0, 1, 0);
  const left = clamp(rect.left, 0, 1, 0);
  const width = clamp(rect.width, 0.001, 1, 1);
  const height = clamp(rect.height, 0.001, 1, 1);
  return {
    anchor: anchorType,
    anchorRect: { top, left, width, height },
  };
};

const serializeSticker = (sticker) => ({
  id: sticker._id,
  stickerKey: sticker.stickerKey,
  assetType: sticker.assetType,
  assetValue: sticker.assetValue,
  poster: sticker.poster,
  format: sticker.format,
  mediaSize: sticker.mediaSize,
  position: sticker.position,
  scale: sticker.scale,
  rotation: sticker.rotation,
  anchor: sticker.anchor || 'card',
  anchorRect: sticker.anchorRect || { top: 0, left: 0, width: 1, height: 1 },
  placedBy: sticker.placedBy ? String(sticker.placedBy) : null,
  createdAt: sticker.createdAt,
  updatedAt: sticker.updatedAt,
});

const enrichPlacements = async (post) => {
  if (!post || !Array.isArray(post.stickers)) return [];
  const userIds = [
    ...new Set(
      post.stickers
        .map((s) => (s.placedBy ? String(s.placedBy) : null))
        .filter(Boolean)
    ),
  ];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select('_id username profilePicture')
        .lean()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  return post.stickers.map((s) => {
    const base = serializeSticker(s);
    const u = userMap.get(base.placedBy || '');
    if (u) {
      base.placedByUser = {
        _id: String(u._id),
        username: u.username,
        profilePicture: u.profilePicture,
      };
    }
    return base;
  });
};

router.get('/catalog', (req, res) => {
  res.json(stickersCatalog);
});

router.get('/post/:postId', async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const placements = await enrichPlacements(post);
    res.json(placements);
  } catch (err) {
    console.error('stickers get error', err);
    res.status(500).json({ message: 'Failed to load stickers' });
  }
});


router.post(
  '/post/:postId',
  enforceNotBanned,
  async (req, res) => {
    try {
      const actorId = req.body.userId;
      const post = await Post.findById(req.params.postId);
      if (!post) return res.status(404).json({ message: 'Post not found' });

      let stickerMeta = null;
      const requestKey = req.body.stickerKey;
      if (requestKey && catalogMap.has(requestKey)) {
        stickerMeta = catalogMap.get(requestKey);
      } else if (req.body.customSticker && typeof req.body.customSticker === 'object') {
        const custom = req.body.customSticker;
        const assetType = ['image', 'video'].includes(custom.assetType) ? custom.assetType : null;
        const assetValue = typeof custom.assetValue === 'string' ? custom.assetValue : '';
        if (!assetType) {
          return res.status(400).json({ message: 'Invalid custom sticker payload' });
        }

        if (assetType === 'image') {
          if (!assetValue.startsWith('data:image/')) {
            return res.status(400).json({ message: 'Invalid custom sticker payload' });
          }
          if (assetValue.length > MAX_CUSTOM_STICKER_LENGTH) {
            return res.status(413).json({ message: 'Custom sticker is too large' });
          }
        } else if (assetType === 'video') {
          if (!/^\/uploads\//.test(assetValue) && !/^https?:/.test(assetValue)) {
            return res.status(400).json({ message: 'Invalid custom video sticker payload' });
          }
        }
        stickerMeta = {
          key: requestKey || makeCustomKey(),
          type: assetType,
          value: assetValue,
          label: custom.label || 'Custom sticker',
          poster: custom.poster || null,
          mediaSize: typeof custom.mediaSize === 'number' ? custom.mediaSize : null,
          format: custom.format || null,
          isCustom: true,
        };
      } else {
        stickerMeta = catalogMap.get(requestKey || '');
      }

      if (!stickerMeta) {
        return res.status(400).json({ message: 'Invalid stickerKey' });
      }

      const actorObjectId = toObjectId(actorId);
      if (!actorObjectId) {
        return res.status(400).json({ message: 'Invalid userId' });
      }

      const allowed = await canUserPlaceSticker(post, actorId);
      if (!allowed) return res.status(403).json({ message: 'Stickers not permitted on this post' });

      const maxCount = Number(post.stickerSettings?.maxCount) || 20;
      const stickerCount = Array.isArray(post.stickers) ? post.stickers.length : 0;
      if (stickerCount >= maxCount) {
        return res.status(409).json({ message: 'Sticker limit reached for this post' });
      }

      const anchorInfo = sanitizeAnchor(req.body);

      const placement = {
        stickerKey: stickerMeta.key,
        assetType: stickerMeta.type,
        assetValue: stickerMeta.value,
        poster: stickerMeta.poster || req.body.poster || null,
        format: stickerMeta.format || req.body.format || null,
        mediaSize: stickerMeta.mediaSize || req.body.mediaSize || null,
        position: {
          x: clamp(req.body?.position?.x, 0, 1, 0.5),
          y: clamp(req.body?.position?.y, 0, 1, 0.5),
        },
        scale: clamp(req.body.scale ?? 1, 0.25, 2.5, 1),
        rotation: clamp(req.body.rotation ?? 0, -180, 180, 0),
        anchor: anchorInfo.anchor,
        anchorRect: anchorInfo.anchorRect,
        placedBy: actorObjectId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      post.stickers.push(placement);
      await post.save();

      const placements = await enrichPlacements(post);
      res.status(201).json(placements[placements.length - 1]);
    } catch (err) {
      console.error('stickers add error', err);
      res.status(500).json({ message: 'Failed to place sticker' });
    }
  }
);

router.put(
  '/post/:postId/:stickerId',
  enforceNotBanned,
  async (req, res) => {
    try {
      const actorId = req.body.userId;
      const post = await Post.findById(req.params.postId);
      if (!post) return res.status(404).json({ message: 'Post not found' });

      const sticker = post.stickers.id(req.params.stickerId);
      if (!sticker) return res.status(404).json({ message: 'Sticker not found' });

      const actorOwnsSticker = sticker.placedBy && String(sticker.placedBy) === String(actorId);
      const actorIsOwner = String(post.userId) === String(actorId);
      if (!actorOwnsSticker && !actorIsOwner) {
        return res.status(403).json({ message: 'You cannot edit this sticker' });
      }

      if (req.body.position) {
        sticker.position.x = clamp(req.body.position.x, 0, 1, sticker.position.x);
        sticker.position.y = clamp(req.body.position.y, 0, 1, sticker.position.y);
      }
      if (req.body.scale !== undefined) {
        sticker.scale = clamp(req.body.scale, 0.25, 2.5, sticker.scale);
      }
      if (req.body.rotation !== undefined) {
        sticker.rotation = clamp(req.body.rotation, -180, 180, sticker.rotation);
      }
      if (req.body.anchor || req.body.anchorRect) {
        const anchorInfo = sanitizeAnchor(req.body);
        sticker.anchor = anchorInfo.anchor;
        sticker.anchorRect = anchorInfo.anchorRect;
      }
      sticker.updatedAt = new Date();

      await post.save();
      res.json(serializeSticker(sticker));
    } catch (err) {
      console.error('stickers update error', err);
      res.status(500).json({ message: 'Failed to update sticker' });
    }
  }
);

// DELETE one placement — owner of placement OR post owner
router.delete('/post/:postId/:stickerId', enforceNotBanned, async (req, res) => {
  try {
    const { postId, stickerId } = req.params;
    const { userId } = req.body || {};
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const sticker = post.stickers.id(stickerId); // robust subdoc lookup
    if (!sticker) return res.status(404).json({ message: 'Sticker not found' });

    const isPostOwner = String(post.userId) === String(userId);
    const isPlacementOwner = sticker.placedBy && String(sticker.placedBy) === String(userId);
    if (!isPostOwner && !isPlacementOwner) {
      return res.status(403).json({ message: 'Not allowed to delete this sticker' });
    }

    sticker.deleteOne(); // remove subdoc
    await post.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error('stickers delete error', err);
    return res.status(500).json({ message: 'Failed to delete sticker' });
  }
});

// DELETE /post/:postId — clear ALL stickers on a post (owner only)
router.delete('/post/:postId', enforceNotBanned, async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body || {};
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    // Only the post owner can wipe all placements
    if (String(post.userId) !== String(userId)) {
      return res.status(403).json({ message: 'Only the post owner can clear stickers' });
    }

    const cleared = Array.isArray(post.stickers) ? post.stickers.length : 0;
    post.stickers = [];
    await post.save();

    return res.json({ ok: true, cleared });
  } catch (err) {
    console.error('stickers clear-all error', err);
    return res.status(500).json({ message: 'Failed to clear stickers' });
  }
});


async function canUserPlaceSticker(post, userId) {
  const s = post.stickerSettings || {};
  // normalize legacy
  const mode = (s.allowMode === 'disabled' || s.allowMode === 'no one') ? 'none' : (s.allowMode || 'everyone');
  const uid = String(userId || '');
  const owner = String(post.userId || '');
  if (!uid) return false;
  if (uid === owner) return true;
  if (mode === 'none') return false;
  if (mode === 'owner') return false;
  // allow/deny overrides
  const deny = Array.isArray(s.denylist) && s.denylist.map(String).includes(uid);
  if (deny) return false;
  const allowlist = Array.isArray(s.allowlist) ? s.allowlist.map(String) : [];
  if (allowlist.length && !allowlist.includes(uid)) return false;
  if (mode === 'followers') {
    try {
      const ownerDoc = await User.findById(owner).select('followers').lean();
      const followers = Array.isArray(ownerDoc?.followers)
        ? ownerDoc.followers.map((f) => String(f))
        : [];
      if (!followers.includes(uid)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

module.exports = router;
