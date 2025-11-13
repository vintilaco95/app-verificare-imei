const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const orderSnapshotSchema = new mongoose.Schema({
  orderId: String,
  imei: String,
  imei2: String,
  brand: String,
  model: String,
  modelDesc: String,
  status: String,
  servicePrice: Number,
  serviceCurrency: String,
  currency: String,
  language: String,
  riskScore: Number,
  riskLabel: String,
  summaryLabel: String,
  createdAt: Date,
  object: mongoose.Schema.Types.Mixed,
  resultHtml: String,
  appleMdm: mongoose.Schema.Types.Mixed,
  blacklist: mongoose.Schema.Types.Mixed,
  mdm: mongoose.Schema.Types.Mixed,
  iCloud: mongoose.Schema.Types.Mixed,
  networkLock: mongoose.Schema.Types.Mixed,
  statuses: mongoose.Schema.Types.Mixed,
  verificationRaw: mongoose.Schema.Types.Mixed,
  meta: mongoose.Schema.Types.Mixed
}, { _id: false });

const faneConversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  history: {
    type: [messageSchema],
    default: []
  },
  sessionOrders: {
    type: [orderSnapshotSchema],
    default: []
  },
  currentOrder: {
    type: orderSnapshotSchema,
    default: null
  },
  lastAccountOrder: {
    type: orderSnapshotSchema,
    default: null
  },
  latestVerification: {
    type: orderSnapshotSchema,
    default: null
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

faneConversationSchema.pre('save', function updateTimestamps(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('FaneConversation', faneConversationSchema);

