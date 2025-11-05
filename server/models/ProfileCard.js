const mongoose = require('mongoose');

const VALID_LAYOUTS = ['single', 'double', 'triple'];
const VALID_MODULE_TYPES = ['text', 'image', 'club', 'prompt'];

const ModuleSchema = new mongoose.Schema(
  {
    slotId: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: VALID_MODULE_TYPES,
      default: 'text',
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: true }
);

const PresetSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'Preset' },
    layout: {
      type: String,
      enum: VALID_LAYOUTS,
      default: 'single',
    },
    modules: {
      type: [ModuleSchema],
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length <= 6;
        },
        message: 'Preset cannot exceed 6 modules.',
      },
    },
    stickers: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  { _id: true }
);

const ProfileCardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    currentPresetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    presets: {
      type: [PresetSchema],
      default: [],
    },
  },
  { timestamps: true }
);

ProfileCardSchema.statics.validLayouts = VALID_LAYOUTS;
ProfileCardSchema.statics.validModuleTypes = VALID_MODULE_TYPES;

module.exports = mongoose.model('ProfileCard', ProfileCardSchema);
