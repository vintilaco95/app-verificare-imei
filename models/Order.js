const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: Number,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null pentru utilizatori neautentificați
  },
  email: {
    type: String,
    required: true // email pentru utilizatori neautentificați
  },
  imei: {
    type: String,
    required: true
  },
  serviceId: {
    type: Number,
    required: true
  },
  serviceName: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'error'],
    default: 'pending'
  },
  result: {
    type: String, // HTML result
    default: null
  },
  object: {
    type: mongoose.Schema.Types.Mixed, // JSON object
    default: null
  },
  brand: {
    type: String,
    default: null
  },
  model: {
    type: String,
    default: null
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  additionalServices: {
    type: [Number], // Array of additional service IDs
    default: []
  },
  // Payment fields for Stripe
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  stripeSessionId: {
    type: String,
    default: null
  },
  stripePaymentIntentId: {
    type: String,
    default: null
  },
  stripeCustomerId: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', orderSchema);
