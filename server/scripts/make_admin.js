// server/scripts/make_admin.js
// Usage:
// MONGO_URL="mongodb://127.0.0.1:27017/fullertonconnect" node server/scripts/make_admin.js "Christian.M"
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  try {
    const mongo = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/fullertonconnect';
    const username = process.argv[2];
    if (!username) throw new Error('Provide a username, e.g. node make_admin.js "Christian.M"');

    await mongoose.connect(mongo);
    const u = await User.findOne({ username });
    if (!u) throw new Error('User not found: ' + username);

    u.isAdmin = true;
    await u.save();
    console.log(`✅ ${username} is now admin`);
  } catch (e) {
    console.error('❌', e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
