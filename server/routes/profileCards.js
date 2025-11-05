const router = require('express').Router();
const mongoose = require('mongoose');
const ProfileCard = require('../models/ProfileCard');
const User = require('../models/User');

const MAX_MODULES = 6;
const MAX_PRESETS = 6;
const VALID_LAYOUTS = new Set(ProfileCard.validLayouts || ['single', 'double', 'triple']);
const VALID_MODULE_TYPES = new Set(ProfileCard.validModuleTypes || ['text', 'image', 'club', 'prompt']);

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || '').trim());
const toObjectId = (value) => new mongoose.Types.ObjectId(String(value).trim());

function sanitizeModule(raw = {}, index = 0) {
  const id = isObjectId(raw._id) ? toObjectId(raw._id) : new mongoose.Types.ObjectId();
  const slotId =
    typeof raw.slotId === 'string' && raw.slotId.trim()
      ? raw.slotId.trim().slice(0, 40)
      : `slot-${index + 1}`;
  const type = VALID_MODULE_TYPES.has(raw.type) ? raw.type : 'text';

  const content = {};
  if (type === 'text') {
    const text =
      typeof raw?.content?.text === 'string'
        ? raw.content.text.slice(0, 600)
        : '';
    content.text = text;
  } else if (type === 'image') {
    if (typeof raw?.content?.url === 'string') {
      content.url = raw.content.url.slice(0, 1024);
    }
    if (typeof raw?.content?.alt === 'string') {
      content.alt = raw.content.alt.slice(0, 160);
    }
  } else if (type === 'club') {
    const clubId =
      typeof raw?.content?.clubId === 'string'
        ? raw.content.clubId
        : null;
    if (clubId) content.clubId = clubId;
  } else if (type === 'prompt') {
    if (typeof raw?.content?.promptKey === 'string') {
      content.promptKey = raw.content.promptKey.slice(0, 80);
    }
    if (typeof raw?.content?.text === 'string') {
      content.text = raw.content.text.slice(0, 400);
    }
  }

  return {
    _id: id,
    slotId,
    type,
    content,
  };
}

function sanitizePreset(raw = {}, idx = 0) {
  const id = isObjectId(raw._id) ? toObjectId(raw._id) : new mongoose.Types.ObjectId();
  const layout = VALID_LAYOUTS.has(raw.layout) ? raw.layout : 'single';
  const name =
    typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim().slice(0, 80)
      : `Preset ${idx + 1}`;

  const modulesInput = Array.isArray(raw.modules) ? raw.modules.slice(0, MAX_MODULES) : [];
  const modules = modulesInput.map((item, moduleIdx) => sanitizeModule(item, moduleIdx));

  const stickers = Array.isArray(raw.stickers) ? raw.stickers : [];

  return {
    _id: id,
    name,
    layout,
    modules,
    stickers,
  };
}

async function ensureProfileCard(userObjectId) {
  let card = await ProfileCard.findOne({ userId: userObjectId }).lean();
  if (card) return card;

  const user = await User.findById(userObjectId).select('bio').lean();
  if (!user) return null;

  const presetId = new mongoose.Types.ObjectId();
  const moduleId = new mongoose.Types.ObjectId();

  const defaultPreset = {
    _id: presetId,
    name: 'My Profile Card',
    layout: 'single',
    modules: [
      {
        _id: moduleId,
        slotId: 'slot-1',
        type: 'text',
        content: { text: typeof user.bio === 'string' ? user.bio : '' },
      },
    ],
    stickers: [],
  };

  const created = await ProfileCard.create({
    userId: userObjectId,
    currentPresetId: presetId,
    presets: [defaultPreset],
  });

  return created.toObject();
}

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const userObjectId = toObjectId(userId);
    const card = await ensureProfileCard(userObjectId);
    if (!card) return res.status(404).json({ message: 'User not found' });

    res.json(card);
  } catch (e) {
    console.error('Profile card GET failed:', e);
    res.status(500).json({ message: 'Failed to load profile card' });
  }
});

router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const actorId = req.body?.userId;

    if (!isObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    if (!actorId || String(actorId) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const userObjectId = toObjectId(userId);
    const presetInput = Array.isArray(req.body?.presets) ? req.body.presets.slice(0, MAX_PRESETS) : [];
    if (!presetInput.length) {
      return res.status(400).json({ message: 'At least one preset is required' });
    }

    const presets = presetInput.map((preset, idx) => sanitizePreset(preset, idx));
    let currentPresetId = req.body?.currentPresetId && isObjectId(req.body.currentPresetId)
      ? toObjectId(req.body.currentPresetId)
      : null;

    const presetIds = presets.map((p) => String(p._id));
    if (!currentPresetId || !presetIds.includes(String(currentPresetId))) {
      currentPresetId = presets[0]._id;
    }

    const update = {
      currentPresetId,
      presets,
    };

    const card = await ProfileCard.findOneAndUpdate(
      { userId: userObjectId },
      { $set: update },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    res.json(card);
  } catch (e) {
    console.error('Profile card PUT failed:', e);
    res.status(500).json({ message: 'Failed to save profile card' });
  }
});

module.exports = router;
