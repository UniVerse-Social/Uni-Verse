const router = require('express').Router();
const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const stickersCatalog = require('../data/stickers');
const { enforceNotBanned } = require('../middleware/moderation');

const catalogMap = new Map(stickersCatalog.map((s) => [s.key, s]));

const MAX_CUSTOM_STICKER_LENGTH = 250_000; // ~180 KB base64 payload

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

const serializeSticker = (sticker) => ({
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

const canPlaceSticker = async (post, actorId) => {
  if (!actorId) return false;
  if (String(post.userId) === String(actorId)) return true; // owner

  const settings = post.stickerSettings || {};
  const actorObjectId = toObjectId(actorId);

  if (settings.denylist && settings.denylist.some((id) => String(id) === String(actorId))) {
    return false;
  }
  if (settings.allowlist && settings.allowlist.length) {
    const isAllowed = settings.allowlist.some((id) => String(id) === String(actorId));
    if (!isAllowed) return false;
  }
  if (settings.allowMode === 'none') return false;
  if (settings.allowMode === 'followers') {
    const owner = await User.findById(post.userId).select('followers').lean();
    if (!owner) return false;
    const followers = owner.followers || [];
    const isFollower = followers.some((id) => String(id) === String(actorId));
    if (!isFollower) return false;
  }

  return true;
};

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
        const assetType = custom.assetType === 'image' ? 'image' : null;
        const assetValue = typeof custom.assetValue === 'string' ? custom.assetValue : '';
        if (!assetType || !assetValue.startsWith('data:image/')) {
          return res.status(400).json({ message: 'Invalid custom sticker payload' });
        }
        if (assetValue.length > MAX_CUSTOM_STICKER_LENGTH) {
          return res.status(413).json({ message: 'Custom sticker is too large' });
        }
        stickerMeta = {
          key: requestKey || makeCustomKey(),
          type: 'image',
          value: assetValue,
          label: custom.label || 'Custom sticker',
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

      const allowed = await canPlaceSticker(post, actorId);
      if (!allowed) return res.status(403).json({ message: 'Stickers not permitted on this post' });

      const placement = {
        stickerKey: stickerMeta.key,
        assetType: stickerMeta.type,
        assetValue: stickerMeta.value,
        position: {
          x: clamp(req.body?.position?.x, 0, 1, 0.5),
          y: clamp(req.body?.position?.y, 0, 1, 0.5),
        },
        scale: clamp(req.body.scale ?? 1, 0.4, 2.5, 1),
        rotation: clamp(req.body.rotation ?? 0, -180, 180, 0),
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
        sticker.scale = clamp(req.body.scale, 0.4, 2.5, sticker.scale);
      }
      if (req.body.rotation !== undefined) {
        sticker.rotation = clamp(req.body.rotation, -180, 180, sticker.rotation);
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

router.delete(
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
        return res.status(403).json({ message: 'You cannot delete this sticker' });
      }

      sticker.deleteOne();
      await post.save();
      res.json({ ok: true });
    } catch (err) {
      console.error('stickers delete error', err);
      res.status(500).json({ message: 'Failed to delete sticker' });
    }
  }
);

router.put(
  '/post/:postId/settings',
  enforceNotBanned,
  async (req, res) => {
    try {
      const actorId = req.body.userId;
      const post = await Post.findById(req.params.postId);
      if (!post) return res.status(404).json({ message: 'Post not found' });
      if (String(post.userId) !== String(actorId)) {
        return res.status(403).json({ message: 'Only the post owner can update sticker settings' });
      }

      const nextSettings = post.stickerSettings || {};
      if (req.body.allowMode) {
        const modes = ['everyone', 'followers', 'none'];
        const mode = String(req.body.allowMode);
        if (modes.includes(mode)) {
          nextSettings.allowMode = mode;
        }
      }

      if (Array.isArray(req.body.allowlist)) {
        nextSettings.allowlist = uniqueObjectIds(req.body.allowlist);
      }
      if (Array.isArray(req.body.denylist)) {
        nextSettings.denylist = uniqueObjectIds(req.body.denylist);
      }
      if (typeof req.body.sticky === 'boolean') {
        nextSettings.sticky = req.body.sticky;
      }

      post.stickerSettings = nextSettings;
      await post.save();
      res.json(post.stickerSettings);
    } catch (err) {
      console.error('stickers settings error', err);
      res.status(500).json({ message: 'Failed to update sticker settings' });
    }
  }
);

<<<<<<< HEAD
module.exports = router;
=======
module.exports = router;
>>>>>>> 43d671d (Christian’s push)
