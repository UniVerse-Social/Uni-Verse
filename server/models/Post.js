const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    textContent: { type: String, maxLength: 280 },
    imageUrl: { type: String },
    likes: { type: Array, default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Post', PostSchema);