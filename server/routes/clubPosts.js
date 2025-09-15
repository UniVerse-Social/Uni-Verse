// server/routes/clubPosts.js
const router = require('express').Router();
const mongoose = require('mongoose');
const Club = require('../models/Club');
const ClubPost = require('../models/ClubPost');

// ---------- List posts by club + channel ----------
// GET /api/club-posts/:clubId?channel=main|side&sideId=<channelId>
router.get('/:clubId', async (req, res) => {
  const clubId = new mongoose.Types.ObjectId(req.params.clubId);
  const channel = (req.query.channel || 'side').toLowerCase() === 'main' ? 'main' : 'side';
  const match = { clubId, channel };

  if (channel === 'side') {
    if (!req.query.sideId) return res.status(400).json({ message: 'sideId required for side channel' });
    match.sideChannelId = new mongoose.Types.ObjectId(req.query.sideId);
  }

  const posts = await ClubPost.aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $limit: 100 },
    // author
    { $lookup: { from: 'users', localField: 'authorId', foreignField: '_id', as: 'author' } },
    { $unwind: '$author' },
    // club -> side channel name
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
                  input: {
                    $filter: {
                      input: '$$arr', as: 'sc', cond: { $eq: ['$$sc._id', '$sideChannelId'] }
                    }
                  },
                  as: 'sc', in: '$$sc.name'
                }
              }
            }
          }
        }
      }
    },
    {
      $project: {
        _id: 1, clubId: 1, channel: 1, sideChannelId: 1, sideChannelName: 1,
        text: 1, images: 1, likes: 1, createdAt: 1,
        authorId: 1, author: { _id: '$author._id', username: '$author.username', profilePicture: '$author.profilePicture' }
      }
    }
  ]);
  res.json(posts);
});

// ---------- Create post ----------
// body: { clubId, authorId, channel: 'main'|'side', sideChannelId?, text, images[] }
router.post('/', async (req, res) => {
  const { clubId, authorId, channel='side', text='', images=[], sideChannelId=null } = req.body || {};
  if (!clubId || !authorId) return res.status(400).json({ message: 'Missing fields' });

  const club = await Club.findById(clubId);
  if (!club) return res.status(404).json({ message: 'Club not found' });

  const isMember = (club.members || []).map(String).includes(String(authorId));
  if (!isMember) return res.status(403).json({ message: 'Join the club to post' });

  const isAllowedMain = String(club.president) === String(authorId) ||
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

  const created = await ClubPost.create({
    clubId, authorId,
    channel: channel === 'main' ? 'main' : 'side',
    sideChannelId: sideId,
    text: String(text).trim().slice(0, 2000),
    images: Array.isArray(images) ? images.slice(0, 10) : []
  });
  res.status(201).json(created);
});

// ---------- Like / Unlike ----------
router.put('/:id/like', async (req, res) => {
  const { userId } = req.body || {};
  const p = await ClubPost.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Not found' });
  const has = (p.likes || []).map(String).includes(String(userId));
  await p.updateOne(has ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } });
  res.json({ liked: !has });
});

// ---------- Delete (author or president) ----------
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
