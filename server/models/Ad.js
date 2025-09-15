const mongoose = require('mongoose');
const AdSchema = new mongoose.Schema({
  title: String, body: String, image: String, ctaText: String, ctaUrl: String,
  active: { type:Boolean, default:true }
}, { timestamps:true });
module.exports = mongoose.model('Ad', AdSchema);
