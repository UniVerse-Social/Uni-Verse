// Usage: node scripts/reset_password.js <username> <newPassword>
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fullerton-connect';

(async () => {
  try {
    const [,, usernameArg, newPassword] = process.argv;
    if (!usernameArg || !newPassword) {
      console.error('Usage: node scripts/reset_password.js <username> <newPassword>');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI, {});
    const user = await User.findOneAndUpdate(
      { username: usernameArg },
      { password: newPassword }, // pre('findOneAndUpdate') will hash
      { new: true }
    );
    if (!user) {
      console.error(`User "${usernameArg}" not found`);
      process.exit(2);
    }
    console.log(`Password reset for "${usernameArg}".`);
  } catch (e) {
    console.error(e);
    process.exit(3);
  } finally {
    await mongoose.disconnect();
  }
})();
