// server/models/Club.js
const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:  { type: String, default: 'Member' }
}, { _id: false });

const SideChannelSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  director: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { _id: true }); // keep _id for channel id

const ClubSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  president:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  roles:       [RoleSchema],                 // custom titles per member
  mainPosters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // allowed to post on "Main"
  sideChannels:[SideChannelSchema],          // multiple named side channels with director
  profilePicture: { type: String, default: '' }, // data URL or hosted URL
}, { timestamps: true });

ClubSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Club', ClubSchema);
