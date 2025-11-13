const mongoose = require('mongoose');

const StudentVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, index: true },
  schoolSlug: { type: String, required: true, index: true },
  code: { type: String, required: true },
  verified: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } } // TTL index on expiresAt
}, { timestamps: true });

module.exports = mongoose.model('StudentVerification', StudentVerificationSchema);
