const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fullerton-connect';

(async () => {
  await mongoose.connect(MONGO_URI, {});
  const users = await User.find().select('+password').lean();
  let updated = 0;

  for (const u of users) {
    // bcrypt hashes start with $2a$ / $2b$ / $2y$
    if (typeof u.password !== 'string' || !u.password.startsWith('$2')) {
      const salt = await bcrypt.genSalt(12);
      const hashed = await bcrypt.hash(u.password || '', salt);
      await User.updateOne({ _id: u._id }, { $set: { password: hashed } });
      updated++;
    }
  }

  console.log(`Done. Hashed ${updated} existing users.`);
  await mongoose.disconnect();
})();
