// server/server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoute = require('./routes/auth');
const userRoute = require('./routes/users');
const postRoute = require('./routes/posts');

const app = express();
const PORT = process.env.PORT || 5000;

// mount the upload API if you haven’t yet
app.use('/api/uploads', require('./routes/uploads'));

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded media
app.use('/uploads',
  express.static(
    path.join(__dirname, 'uploads'),
    { setHeaders: (res, p) => { if (p.endsWith('.webp')) res.set('Content-Type', 'image/webp'); } }
  )
);

// Core routes
app.use('/api/messages', require('./routes/messages'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/clubs', require('./routes/clubs'));
app.use('/api/club-posts', require('./routes/clubPosts'));
app.use('/api/club-comments', require('./routes/clubComments'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/ads', require('./routes/ads'));
app.use('/api/events', require('./routes/events'));

// NEW: uploads route
app.use('/api/uploads', require('./routes/uploads'));

// --- DB ---
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/fullertonconnect';
mongoose
  .connect(MONGO_URL)
  .then(() => console.log('SUCCESS: MongoDB connected successfully!'))
  .catch((err) => console.error('ERROR: MongoDB connection failed.', err));

// --- API ---
app.use('/api/auth', authRoute);
app.use('/api/users', userRoute);
app.use('/api/posts', postRoute);

// --- START ---
app.listen(PORT, () => {
  console.log(`Backend server is listening on http://localhost:${PORT}`);
});
