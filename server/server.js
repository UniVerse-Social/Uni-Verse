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

const RAW_ALLOWED_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000';
const ALLOWED_ORIGINS = RAW_ALLOWED_ORIGINS.split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true); // allow same-origin / server-side requests
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
};

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

/* -------------------- STATIC / UPLOADS -------------------- */
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, p) => {
      if (p.endsWith('.webp')) res.set('Content-Type', 'image/webp');
      if (p.endsWith('.mp4')) res.set('Content-Type', 'video/mp4');
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
app.use('/api/stickers', require('./routes/stickers'));
app.use('/api/profile-cards', require('./routes/profileCards'));

app.use('/api/auth', authRoute);
app.use('/api/users', userRoute);
app.use('/api/posts', postRoute);

/* -------------------- STATIC REACT BUILD (Path A) -------------------- */
const buildPath = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(buildPath));

// Don’t swallow /api or /socket.io — serve index.html for everything else
app.get(/^(?!\/api\/|\/socket\.io\/).*/, (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

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
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
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

// attach fishing realtime handlers
try {
  require('./realtime/fishing')(io);
  console.log('Realtime: fishing namespace initialized');
} catch (e) {
  console.warn('Realtime: fishing module not found or failed to load:', e?.message || e);
}

// attach poker realtime handlers
try {
  require('./realtime/poker')(io);
  console.log('Realtime: poker namespace initialized');
} catch (e) {
  console.warn('Realtime: poker module not found or failed to load:', e?.message || e);
}

// attach reversi matchmaking/realtime handlers
try {
  require('./realtime/reversi')(io);
  console.log('Realtime: reversi namespace initialized');
} catch (e) {
  console.warn('Realtime: reversi module not found or failed to load:', e?.message || e);
}

// Jump realtime
try {
  require('./realtime/jump')(io);
  console.log('Realtime: jump namespace initialized');
} catch (e) {
  console.warn('Realtime: jump module failed to load:', e?.message || e);
}

// NEW: Meteor realtime
try {
  require('./realtime/meteor')(io);
  console.log('Realtime: meteor namespace initialized');
} catch (e) {
  console.warn('Realtime: meteor module failed to load:', e?.message || e);
}

// NEW: Tetris realtime
try {
  require('./realtime/tetris')(io);
  console.log('Realtime: tetris namespace initialized');
} catch (e) {
  console.warn('Realtime: tetris module failed to load:', e?.message || e);
}

// Generic matchmaker (keep)
try {
  require('./realtime/mm')(io);
  console.log('Realtime: generic matchmaker initialized');
} catch (e) {
  console.warn('Realtime: matchmaker failed to load:', e?.message || e);
}

/* -------------------- START -------------------- */
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`API + Realtime listening on http://${HOST}:${PORT}`);
});
