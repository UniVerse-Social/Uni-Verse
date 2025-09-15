// server/routes/clubs.js
const router = require('express').Router();
const mongoose = require('mongoose');
const Club = require('../models/Club');
const User = require('../models/User');

const ensurePresident = (club, actorId) =>
  String(club.president) === String(actorId);

// ---------- List / Search ----------
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  const viewer = (req.query.viewer || '').trim();
  const viewerId = viewer ? new mongoose.Types.ObjectId(viewer) : null;
  const match = q ? { $text: { $search: q } } : {};
  const clubs = await Club.find(match).sort({ createdAt: -1 }).lean();
  res.json(clubs.map(c => {
    const members = c.members || [];
    const isMember = viewerId ? members.some(m => String(m) === String(viewerId)) : false;
    return {
      _id: c._id,
      name: c.name,
      description: c.description,
      membersCount: members.length,
      president: c.president,
      profilePicture: c.profilePicture || '',
      isMember
    };
  }));
});

// ---------- Mine ----------
router.get('/mine/:userId', async (req, res) => {
  const myId = new mongoose.Types.ObjectId(req.params.userId);
  const clubs = await Club.find({ members: myId }).lean();
  res.json(clubs);
});

// ---------- Create ----------
router.post('/', async (req, res) => {
  const { userId, name, description } = req.body || {};
  if (!userId || !name?.trim()) return res.status(400).json({ message: 'Missing fields' });
  const club = await Club.create({
    name: name.trim(),
    description: description || '',
    createdBy: userId,
    president: userId,
    members: [userId],
    roles: [{ userId, title: 'President' }],
    mainPosters: [userId],
    sideChannels: [] // start empty; president can add later
  });
  await User.updateOne({ _id: userId }, { $addToSet: { clubs: club._id } }).catch(()=>{});
  res.status(201).json(club);
});

// ---------- Details ----------
router.get('/:id', async (req, res) => {
  const c = await Club.findById(req.params.id).lean();
  if (!c) return res.status(404).json({ message: 'Not found' });
  res.json(c);
});

// ---------- Join / Leave ----------
router.put('/:id/join', async (req, res) => {
  const { userId } = req.body || {};
  await Club.updateOne({ _id: req.params.id }, { $addToSet: { members: userId }});
  await User.updateOne({ _id: userId }, { $addToSet: { clubs: req.params.id }}).catch(()=>{});
  res.json({ ok: true });
});

router.put('/:id/leave', async (req, res) => {
  const { userId } = req.body || {};
  await Club.updateOne(
    { _id: req.params.id },
    { 
      $pull: { 
        members: userId, 
        mainPosters: userId, 
        roles: { userId: new mongoose.Types.ObjectId(userId) }, 
        sideChannels: { director: new mongoose.Types.ObjectId(userId) } // if they were director, unset by removal below
      }
    }
  ).catch(()=>{});
  await User.updateOne({ _id: userId }, { $pull: { clubs: req.params.id }}).catch(()=>{});
  res.json({ ok: true });
});

// ----------- Club Photo -------------
router.put('/:id/photo', async (req, res) => {
  const { actorId, dataUrl } = req.body || {};
  const club = await Club.findById(req.params.id);
  if (!club) return res.status(404).json({ message: 'Not found' });
  if (String(club.president) !== String(actorId)) {
    return res.status(403).json({ message: 'Only president' });
  }
  if (typeof dataUrl !== 'string' || dataUrl.length < 10) {
    return res.status(400).json({ message: 'Invalid image' });
  }
  // (Optional) basic guard to allow only images:
  if (!/^data:image\//.test(dataUrl) && !/^https?:\/\//.test(dataUrl)) {
    return res.status(400).json({ message: 'Image must be a data: URL or http(s) URL' });
  }
  club.profilePicture = dataUrl;
  await club.save();
  res.json({ profilePicture: club.profilePicture });
});
// ---------- Members list ----------
router.get('/:id/members', async (req,res) => {
  const club = await Club.findById(req.params.id).lean();
  if (!club) return res.status(404).json({ message: 'Not found' });
  const people = await User.find({ _id: { $in: club.members || [] } })
    .select('_id username profilePicture')
    .lean();
  const titleById = new Map((club.roles || []).map(r => [String(r.userId), r.title]));
  res.json(people.map(p => ({ ...p, title: titleById.get(String(p._id)) || 'Member' })));
});

// ---------- Set custom title (President only) ----------
router.put('/:id/title', async (req,res)=>{
  const { actorId, targetId, title } = req.body || {};
  const club = await Club.findById(req.params.id);
  if (!club) return res.status(404).json({ message: 'Not found' });
  if (!ensurePresident(club, actorId)) return res.status(403).json({ message: 'Only president' });

  const i = (club.roles || []).findIndex(r => String(r.userId) === String(targetId));
  if (i === -1) club.roles.push({ userId: targetId, title: title || 'Member' });
  else club.roles[i].title = title || 'Member';
  await club.save();
  res.json({ ok: true });
});

// ---------- Allow / Revoke posting on Main (President only) ----------
router.put('/:id/allow-main', async (req,res)=>{
  const { actorId, targetId, allow } = req.body || {};
  const club = await Club.findById(req.params.id);
  if (!club) return res.status(404).json({ message: 'Not found' });
  if (!ensurePresident(club, actorId)) return res.status(403).json({ message: 'Only president' });

  if (allow) await club.updateOne({ $addToSet: { mainPosters: targetId }});
  else await club.updateOne({ $pull: { mainPosters: targetId }});

  const updated = await Club.findById(req.params.id).lean();
  res.json(updated);
});

// ---------- Transfer presidency (demote old president to Member) ----------
router.put('/:id/transfer', async (req,res)=>{
  const { actorId, targetId } = req.body || {};
  const club = await Club.findById(req.params.id);
  if (!club) return res.status(404).json({ message: 'Not found' });
  if (!ensurePresident(club, actorId)) return res.status(403).json({ message: 'Only president' });

  const prevPresident = club.president;
  club.president = targetId;

  // ensure roles reflect change
  // new president -> "President"
  const idxNew = (club.roles || []).findIndex(r => String(r.userId) === String(targetId));
  if (idxNew === -1) club.roles.push({ userId: targetId, title: 'President' });
  else club.roles[idxNew].title = 'President';

  // old president -> "Member"
  const idxOld = (club.roles || []).findIndex(r => String(r.userId) === String(prevPresident));
  if (idxOld === -1) club.roles.push({ userId: prevPresident, title: 'Member' });
  else club.roles[idxOld].title = 'Member';

  await club.save();
  res.json(club);
});

// ====================== SIDE CHANNELS ======================

// List side channels
router.get('/:id/side-channels', async (req,res)=>{
  const club = await Club.findById(req.params.id).lean();
  if (!club) return res.status(404).json({ message: 'Not found' });
  res.json(club.sideChannels || []);
});

// Create side channel (President only)
router.post('/:id/side-channels', async (req,res)=>{
  const { actorId, name, directorId } = req.body || {};
  const club = await Club.findById(req.params.id);
  if (!club) return res.status(404).json({ message: 'Not found' });
  if (!ensurePresident(club, actorId)) return res.status(403).json({ message: 'Only president' });

  club.sideChannels.push({ name: String(name).trim(), director: directorId || null });
  await club.save();
  res.status(201).json(club.sideChannels);
});

// Rename side channel (President only)
router.put('/:id/side-channels/:sid/rename', async (req,res)=>{
  const { actorId, name } = req.body || {};
  const club = await Club.findById(req.params.id);
  if (!club) return res.status(404).json({ message: 'Not found' });
  if (!ensurePresident(club, actorId)) return res.status(403).json({ message: 'Only president' });

  const sc = (club.sideChannels || []).id(req.params.sid);
  if (!sc) return res.status(404).json({ message: 'Channel not found' });
  sc.name = String(name || '').trim() || sc.name;
  await club.save();
  res.json(club.sideChannels);
});

// Set director (President only)
router.put('/:id/side-channels/:sid/director', async (req,res)=>{
  const { actorId, targetId } = req.body || {};
  const club = await Club.findById(req.params.id);
  if (!club) return res.status(404).json({ message: 'Not found' });
  if (!ensurePresident(club, actorId)) return res.status(403).json({ message: 'Only president' });

  const sc = (club.sideChannels || []).id(req.params.sid);
  if (!sc) return res.status(404).json({ message: 'Channel not found' });

  // director must be a member
  if (!(club.members || []).map(String).includes(String(targetId))) {
    return res.status(400).json({ message: 'Director must be a club member' });
  }
  sc.director = targetId;
  await club.save();
  res.json(club.sideChannels);
});

// Delete side channel (President only)
router.delete('/:id/side-channels/:sid', async (req,res)=>{
  const { actorId } = req.body || {};
  const club = await Club.findById(req.params.id);
  if (!club) return res.status(404).json({ message: 'Not found' });
  if (!ensurePresident(club, actorId)) return res.status(403).json({ message: 'Only president' });

  const sc = (club.sideChannels || []).id(req.params.sid);
  if (!sc) return res.status(404).json({ message: 'Channel not found' });

  sc.deleteOne();
  await club.save();
  res.json(club.sideChannels);
});

module.exports = router;
