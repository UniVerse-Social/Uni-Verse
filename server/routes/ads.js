const router = require('express').Router();
const Ad = require('../models/Ad');
router.get('/', async (_req,res) => {
  const ads = await Ad.find({ active:true }).sort({ createdAt:-1 }).limit(50).lean();
  res.json(ads);
});
module.exports = router;
