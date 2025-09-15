const mongoose = require('mongoose');
const ListingSchema = new mongoose.Schema({
  type: { type:String, enum:['item','gig'], required:true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  title: { type:String, required:true },
  description: { type:String, default:'' },
  images: [{ type:String }], // base64 or URLs
  price: { type:Number, default:0 },
  negotiable: { type:Boolean, default:true },
  status: { type:String, enum:['active','sold','closed'], default:'active' },
  feeApplied: { type:Boolean, default:false },
}, { timestamps:true });

module.exports = mongoose.model('Listing', ListingSchema);
