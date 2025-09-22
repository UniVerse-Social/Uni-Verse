// server/server.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoute = require('./routes/auth');
const userRoute = require('./routes/users');
const postRoute = require('./routes/posts');

const app = express();
const PORT = process.env.PORT || 5000;

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

/* -------------------- STATIC / UPLOADS -------------------- */
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, p) => {
      if (p.endsWith('.webp')) res.set('Content-Type', 'image/webp');
    },
  })
);

// REST endpoint for uploading files
app.use('/api/uploads', require('./routes/uploads')); // (keep one mount)

/* -------------------- CORE ROUTES -------------------- */
app.use('/api/messages', require('./routes/messages'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/clubs', require('./routes/clubs'));
app.use('/api/club-posts', require('./routes/clubPosts'));
app.use('/api/club-comments', require('./routes/clubComments'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/ads', require('./routes/ads'));
app.use('/api/events', require('./routes/events'));
app.use('/api/games', require('./routes/games'));

app.use('/api/auth', authRoute);
app.use('/api/users', userRoute);
app.use('/api/posts', postRoute);

/* -------------------- DB -------------------- */
const MONGO_URL =
  process.env.MONGO_URL || 'mongodb://localhost:27017/fullertonconnect';

mongoose
  .connect(MONGO_URL)
  .then(() => console.log('SUCCESS: MongoDB connected successfully!'))
  .catch((err) => console.error('ERROR: MongoDB connection failed.', err));

/* -------------------- HTTP + SOCKET.IO -------------------- */
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' }, // relax for dev; tighten in prod
});

// attach chess matchmaking/realtime handlers
try {
  require('./realtime/chess')(io);
  console.log('Realtime: chess namespace initialized');
} catch (e) {
  console.warn('Realtime: chess module not found or failed to load:', e?.message || e);
}

// attach checkers matchmaking/realtime handlers
try {
  require('./realtime/checkers')(io);
  console.log('Realtime: checkers namespace initialized');
} catch (e) {
  console.warn('Realtime: checkers module not found or failed to load:', e?.message || e);
}

try {
  require('./realtime/mm')(io);
  console.log('Realtime: generic matchmaker initialized');
} catch (e) {
  console.warn('Realtime: matchmaker failed to load:', e?.message || e);
}
/* -------------------- START -------------------- */
server.listen(PORT, () => {
  console.log(`API + Realtime listening on http://localhost:${PORT}`);
});
