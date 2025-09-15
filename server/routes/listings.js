const router = require('express').Router();
const Listing = require('../models/Listing');

// Create listing
router.post('/', async (req,res)=>{
  try {
    const { userId, title, description, images=[], price=0, negotiable=true, type='item' } = req.body || {};
    if(!userId || !title) return res.status(400).json({message:'Missing fields'});
    const safeImages = Array.isArray(images) ? images.slice(0,10) : [];
    const created = await Listing.create({ userId, title, description, images: safeImages, price, negotiable, type });
    res.status(201).json(created);
  } catch(e){ res.status(500).json({message:'Failed to create'}); }
});

// List active
router.get('/', async (_req,res)=>{ res.json(await Listing.find({ status:'active' }).sort({createdAt:-1}).lean()); });

// Mark sold and apply $3 fee (server trust for now)
router.put('/:id/sold', async (req,res)=>{
  try{
    const l = await Listing.findById(req.params.id);
    if(!l) return res.status(404).json({message:'Not found'});
    l.status = 'sold'; l.feeApplied = true; // fee accounted off-platform for now
    await l.save();
    res.json(l);
  } catch(e){ res.status(500).json({message:'Failed to mark sold'}); }
});

module.exports = router;
