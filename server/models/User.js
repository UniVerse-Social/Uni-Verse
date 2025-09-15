const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username:   { type: String, required: true, unique: true },
  email:      { type: String, required: true, unique: true },
  password:   { type: String, required: true, select: false }, // hide by default
  profilePicture: { type: String, default: "" },
  bannerPicture:  { type: String, default: "" },
  bio:        { type: String, default: "" },
  department: { type: String, required: true },
  hobbies:    [{ type: String }],
  clubs:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'Club' }],
  followers:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isVerified: { type: Boolean, default: false },
}, { timestamps: true });

// Auto-verify seed/test users (your original helper kept)
UserSchema.pre('save', function(next) {
  if (this.isNew) {
    this.isVerified = true;
  }
  next();
});

// Hash password before save if it changed
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12); // cost factor 12
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Hash password on findOneAndUpdate if provided
UserSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  if (!update) return next();

  // support both $set.password and direct password
  const pwd = update.password || (update.$set && update.$set.password);
  if (!pwd) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(pwd, salt);
    if (update.password) update.password = hashed;
    if (update.$set && update.$set.password) update.$set.password = hashed;
    next();
  } catch (err) {
    next(err);
  }
});

// Instance method to compare passwords
UserSchema.methods.comparePassword = function(plain) {
  // if password field was not selected, throw
  if (typeof this.password !== 'string') {
    throw new Error('Password not selected on this document');
  }
  return bcrypt.compare(plain, this.password);
};

// Never return password in JSON
UserSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema);
