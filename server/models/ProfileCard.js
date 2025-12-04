const mongoose = require('mongoose');

const VALID_LAYOUTS = ['hidden', 'single', 'double', 'triple', 'dynamic', 'freeform'];
const VALID_MODULE_TYPES = ['text', 'image', 'club', 'prompt'];
const VALID_CANVAS_COLORS = [
  'glass',
  'classic',
  'frost',
  'citrus',
  'blush',
  'aurora',
  'lagoon',
  'midnight',
  'pearl',
];

const LayoutSettingsSchema = new mongoose.Schema(
  {
    span: { type: Number, min: 1, max: 12, default: 1 },
    minHeight: { type: Number, min: 0, default: null },
    alignX: {
      type: String,
      enum: ['start', 'center', 'end'],
      default: 'center',
    },
    alignY: {
      type: String,
      enum: ['start', 'center', 'end'],
      default: 'center',
    },
    slotScaleX: { type: Number, min: 0.2, max: 1, default: 1 },
    slotScaleY: { type: Number, min: 0.2, max: 1, default: 1 },
    autoPlaced: { type: Boolean, default: true },
    shape: {
      type: String,
      enum: ['square', 'circle', 'star', 'heart'],
      default: 'square',
    },
    moduleColor: { type: String, default: null },
  },
  { _id: false }
);

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
    layoutSettings: {
      type: LayoutSettingsSchema,
      default: () => ({}),
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
    stylePreset: { type: String, default: 'classic' },
    accentColor: { type: String, default: '#fbbf24' },
    canvasScale: { type: Number, min: 0.3, max: 1.2, default: 1 },
    canvasColorId: { type: String, enum: VALID_CANVAS_COLORS, default: 'glass' },
    canvasColorAlpha: { type: Number, min: 0, max: 1, default: 0.5 },
    modules: {
      type: [ModuleSchema],
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length <= 12;
        },
        message: 'Preset cannot exceed 12 modules.',
      },
    },
    dynamicSlotCount: {
      type: Number,
      min: 0,
      max: 12,
      default: 0,
    },
    stickers: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    cardBodyColor: {
      type: String,
      default: '#ffffff',
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
ProfileCardSchema.statics.validCanvasColors = VALID_CANVAS_COLORS;

module.exports = mongoose.model('ProfileCard', ProfileCardSchema);
