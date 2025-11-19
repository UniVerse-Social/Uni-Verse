const router = require('express').Router();
const mongoose = require('mongoose');
const Club = require('../models/Club');
const ClubPost = require('../models/ClubPost');
const ClubComment = require('../models/ClubComment');
const User = require('../models/User');
const { maskText, enforceNotBanned } = require('../middleware/moderation');
const { enforceTextLimits, CLUB_POST_CHAR_LIMIT } = require('../utils/textLimits');

// List (unchanged core)
router.get('/:clubId', async (req, res) => {
  const clubId = new mongoose.Types.ObjectId(req.params.clubId);
  const channel = (req.query.channel || 'side').toLowerCase() === 'main' ? 'main' : 'side';
  const match = { clubId, channel };

  const viewerIdRaw = req.query.viewerId;
  const viewerId = viewerIdRaw && mongoose.isValidObjectId(viewerIdRaw)
    ? new mongoose.Types.ObjectId(viewerIdRaw)
    : null;

  if (channel === 'side') {
    if (!req.query.sideId) return res.status(400).json({ message: 'sideId required for side channel' });
    match.sideChannelId = new mongoose.Types.ObjectId(req.query.sideId);
  }

  const posts = await ClubPost.aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $limit: 100 },
    { $lookup: { from: 'users', localField: 'authorId', foreignField: '_id', as: 'author' } },
    { $unwind: '$author' },
    { $lookup: { from: 'clubs', localField: 'clubId', foreignField: '_id', as: 'club' } },
    { $unwind: '$club' },
    {
      $addFields: {
        sideChannelName: {
          $let: {
            vars: { arr: { $ifNull: ['$club.sideChannels', []] } },
            in: {
              $first: {
                $map: {
                  input: { $filter: { input: '$$arr', as: 'sc', cond: { $eq: ['$$sc._id', '$sideChannelId'] } } },
                  as: 'sc',
                  in: '$$sc.name'
                }
              }
            }
          }
        }
      }
    },
    {
      $project: {
        _id: 1,
        clubId: 1,
        channel: 1,
        sideChannelId: 1,
        sideChannelName: 1,
        text: 1,
        images: 1,
        attachments: 1,
        likes: 1,
        createdAt: 1,
        updatedAt: 1,
        authorId: 1,
        author: {
          _id: '$author._id',
          username: '$author.username',
          profilePicture: '$author.profilePicture',
          department: '$author.department',
          hobbies: '$author.hobbies',
          badgesEquipped: '$author.badgesEquipped',
          titleBadge: '$author.titleBadge'
        }
      }
    }
  ]);
  const postIds = posts.map((p) => p._id);
  const commentMeta = new Map();

  if (postIds.length) {
    const comments = await ClubComment.find({ postId: { $in: postIds } })
      .select('postId userId body parentId likes createdAt')
      .lean();

    const authorIds = [...new Set(comments.map((c) => String(c.userId)))];
    const authors = authorIds.length
      ? await User.find({ _id: { $in: authorIds } }).select('_id username').lean()
      : [];
    const nameMap = new Map(authors.map((u) => [String(u._id), u.username || 'user']));

    const byPost = new Map();
    comments.forEach((c) => {
      const key = String(c.postId);
      if (!byPost.has(key)) byPost.set(key, []);
      byPost.get(key).push(c);
    });

    const viewerIdStrLocal = viewerId ? String(viewerId) : null;

    byPost.forEach((arr, key) => {
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
            username: nameMap.get(String(chosen.userId)) || 'user',
            body: chosen.body || '',
          };
        }
      }
      const userCommented = viewerIdStrLocal
        ? arr.some((c) => String(c.userId) === viewerIdStrLocal)
        : false;
      commentMeta.set(key, {
        count: arr.length,
        preview,
        userCommented,
      });
    });
  }

  const viewerIdStr = viewerId ? String(viewerId) : null;
  const enriched = posts.map((post) => {
    const meta = commentMeta.get(post._id.toString());
    return {
      ...post,
      authorDepartment: post.author?.department || '',
      authorHobbies: Array.isArray(post.author?.hobbies) ? post.author.hobbies : [],
      viewerLiked: viewerIdStr ? (post.likes || []).map(String).includes(viewerIdStr) : false,
      commentCount: meta?.count || 0,
      commentPreview: meta?.preview || null,
      viewerCommented: meta?.userCommented || false,
    };
  });

  res.json(enriched);
});

// Create post (mask text; allow images or attachments)
router.post('/', enforceNotBanned, async (req, res) => {
  const { clubId, authorId, channel = 'side', text = '', images = [], attachments = [], sideChannelId = null } = req.body || {};
  if (!clubId || !authorId) return res.status(400).json({ message: 'Missing fields' });

  const club = await Club.findById(clubId);
  if (!club) return res.status(404).json({ message: 'Club not found' });

  const isMember = (club.members || []).map(String).includes(String(authorId));
  if (!isMember) return res.status(403).json({ message: 'Join the club to post' });

  const isAllowedMain =
    String(club.president) === String(authorId) ||
    (club.mainPosters || []).map(String).includes(String(authorId));

  if (channel === 'main' && !isAllowedMain) {
    return res.status(403).json({ message: 'Not allowed to post on Main' });
  }

  let sideId = null;
  if (channel !== 'main') {
    if (!sideChannelId) return res.status(400).json({ message: 'sideChannelId required for side channel' });
    const sc = (club.sideChannels || []).id(sideChannelId);
    if (!sc) return res.status(404).json({ message: 'Side channel not found' });
    sideId = sc._id;
  }

  const sanitizedText = enforceTextLimits(String(text || ''), CLUB_POST_CHAR_LIMIT).trim();
  const created = await ClubPost.create({
    clubId,
    authorId,
    channel: channel === 'main' ? 'main' : 'side',
    sideChannelId: sideId,
    text: maskText(sanitizedText),
    images: Array.isArray(images) ? images.slice(0, 10) : [],
    attachments: Array.isArray(attachments) ? attachments.slice(0, 10) : []
  });
  res.status(201).json(created);
});

// Like/unlike (unchanged)
router.put('/:id/like', async (req, res) => {
  const { userId } = req.body || {};
  const p = await ClubPost.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Not found' });
  const has = (p.likes || []).map(String).includes(String(userId));
  await p.updateOne(has ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } });
  res.json({ liked: !has });
});

// Delete (author or president) (unchanged logic)
router.delete('/:id', async (req, res) => {
  const { userId } = req.body || {};
  const p = await ClubPost.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Not found' });
  const club = await Club.findById(p.clubId).lean();
  if (String(p.authorId) !== String(userId) && String(club.president) !== String(userId)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  await ClubPost.deleteOne({ _id: p._id });
  res.json({ ok: true });
});

module.exports = router;
