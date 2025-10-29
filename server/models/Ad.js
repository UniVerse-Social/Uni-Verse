const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema(
  {
    // Creative
    title: { type: String, required: true },
    body: { type: String, default: '' },
    image: { type: String, default: '' },        // e.g. /uploads/...
    ctaText: { type: String, default: 'Learn more' },
    ctaUrl: { type: String, default: '' },

    // Targeting
    placements: { type: [String], default: ['home_feed'] }, // 'home_feed' only for now
    cities: { type: [String], default: [] },                 // e.g. ["Fullerton"]

    // Scheduling
    startAt: { type: Date, default: Date.now },
    endAt: { type: Date },

    // Delivery
    weight: { type: Number, default: 1 },
    active: { type: Boolean, default: true },

    // Safety/labeling
    advertiserName: { type: String, default: 'FullertonConnect' },
    testOnly: { type: Boolean, default: true },

    // Simple local analytics (no 3rd party calls)
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AdSchema.index({ active: 1, placements: 1, cities: 1, startAt: 1, endAt: 1 });

module.exports = mongoose.model('Ad', AdSchema);
