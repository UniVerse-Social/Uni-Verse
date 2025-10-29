const router = require('express').Router();
const Ad = require('../models/Ad');

const AD_MODE = (process.env.AD_MODE || 'dev').toLowerCase();
const ALLOWED_CITIES = (process.env.AD_ALLOWED_CITIES || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const INTERVAL = Number(process.env.AD_HOME_FEED_INTERVAL || 8);

// Back-compat: list active ads
router.get('/', async (_req,res) => {
  const ads = await Ad.find({ active:true }).sort({ createdAt:-1 }).limit(50).lean();
  res.json(ads);
});

// Create ad quickly (dev convenience; add admin auth if desired)
router.post('/', async (req, res) => {
  const payload = req.body || {};
  const doc = await Ad.create({
    title: payload.title || 'Untitled Ad',
    body: payload.body || '',
    image: payload.image || '',
    ctaText: payload.ctaText || 'Learn more',
    ctaUrl: payload.ctaUrl || '',
    placements: Array.isArray(payload.placements) ? payload.placements : ['home_feed'],
    cities: Array.isArray(payload.cities) ? payload.cities : ['Fullerton'],
    startAt: payload.startAt ? new Date(payload.startAt) : new Date(),
    endAt: payload.endAt ? new Date(payload.endAt) : null,
    weight: Number(payload.weight || 1),
    active: payload.active !== false,
    advertiserName: payload.advertiserName || 'FullertonConnect',
    testOnly: payload.testOnly !== false, // default true in dev
  });
  res.status(201).json(doc);
});

// Eligible ads with Fullerton targeting + dev/prod safety
// GET /api/ads/eligible?placement=home_feed&city=Fullerton&limit=10&mode=dev
router.get('/eligible', async (req, res) => {
  const placement = String(req.query.placement || 'home_feed');
  const city = String(req.query.city || 'Fullerton');
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
  const mode = String(req.query.mode || AD_MODE).toLowerCase();
  const now = new Date();

  // City & placement filters
  const cityRegex = new RegExp(`^${escapeRegex(city)}$`, 'i');
  const baseQuery = {
    active: true,
    placements: placement,
    startAt: { $lte: now },
    $or: [{ endAt: { $exists: false } }, { endAt: null }, { endAt: { $gte: now } }],
    cities: { $elemMatch: { $regex: cityRegex } },
  };

  // Dev returns ONLY test ads; prod returns ONLY non-test ads
  if (mode !== 'prod') {
    baseQuery.testOnly = true;
  } else {
    baseQuery.testOnly = { $ne: true };
  }

  // optional global allow-list
  if (ALLOWED_CITIES.length && !ALLOWED_CITIES.some(c => c.toLowerCase() === city.toLowerCase())) {
    return res.json({ mode, placement, items: [] });
  }

  const docs = await Ad.find(baseQuery).lean();

  // Fallback: no seeding needed. If nothing matches and we are in dev, return a synthetic house ad.
  let items = [];
  if (!docs.length && mode !== 'prod') {
    items = [
      {
        id: 'dev-fallback',
        title: 'Support Fullerton Businesses',
        body: 'Discover local shops, events, and deals around Fullerton.',
        imageUrl: '',
        ctaText: 'See What’s Nearby',
        ctaUrl: 'https://example.com/fullerton-demo',
        advertiserName: 'FullertonConnect',
        testOnly: true,
        interval: INTERVAL,
      },
    ];
  } else {
    // simple weighted shuffle
    const pool = [];
    for (const d of docs) {
      const w = Math.max(1, Number(d.weight || 1));
      for (let i = 0; i < w; i++) pool.push(d);
    }
    const shuffled = shuffle(pool).slice(0, limit);
    items = shuffled.map(d => ({
      id: String(d._id),
      title: d.title,
      body: d.body || '',
      imageUrl: d.image || '',
      ctaText: d.ctaText || 'Learn more',
      ctaUrl: d.ctaUrl || '',
      advertiserName: d.advertiserName || 'Sponsored',
      testOnly: !!d.testOnly,
      interval: INTERVAL,
    }));
  }

  return res.json({ mode, placement, items });
});

// Local analytics
router.post('/:id/imp', async (req, res) => {
  const id = req.params.id;
  if (id !== 'dev-fallback') await Ad.updateOne({ _id: id }, { $inc: { impressions: 1 } });
  res.json({ ok: true });
});

router.post('/:id/click', async (req, res) => {
  const id = req.params.id;
  if (id !== 'dev-fallback') await Ad.updateOne({ _id: id }, { $inc: { clicks: 1 } });
  res.json({ ok: true });
});

// utils
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = router;
