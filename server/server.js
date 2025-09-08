// server/server.js

require('dotenv').config();
const jwtSecret = process.env.JWT_SECRET;
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import routes
const authRoute = require('./routes/auth');
const userRoute = require('./routes/users');
const postRoute = require('./routes/posts');

const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE SETUP ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/messages', require('./routes/messages'));

// --- DATABASE CONNECTION ---
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/fullertonconnect';
mongoose.connect(MONGO_URL)
    .then(() => console.log("SUCCESS: MongoDB connected successfully!"))
    .catch(err => console.error("ERROR: MongoDB connection failed.", err));

// --- API ROUTES ---
app.use('/api/auth', authRoute);
app.use('/api/users', userRoute);
app.use('/api/posts', postRoute);

// --- START THE SERVER ---
app.listen(PORT, () => {
    console.log(`Backend server is listening on http://localhost:${PORT}`);
});
