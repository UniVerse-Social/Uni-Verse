const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },

    profilePicture: { type: String, default: '' },
    bannerPicture: { type: String, default: '' },
    bio: { type: String, default: '' },
    department: { type: String, default: '' },

    hobbies: [{ type: String }],
    clubs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Club' }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    isAdmin: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: true },

    // NEW: moderation/economy
    strikes: { type: Number, default: 0 },
    bannedUntil: { type: Date, default: null }
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

UserSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  if (!update) return next();
  const raw = update.password ?? update.$set?.password;
  if (!raw) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(String(raw), salt);
    if (update.password) update.password = hashed;
    if (update.$set && update.$set.password) update.$set.password = hashed;
    next();
  } catch (err) {
    next(err);
  }
});

UserSchema.methods.comparePassword = function (plain) {
  if (typeof this.password !== 'string') throw new Error('Password not selected on this document');
  return bcrypt.compare(plain, this.password);
};

UserSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema);
