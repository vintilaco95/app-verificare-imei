const mongoose = require('mongoose');

const pricingSettingSchema = new mongoose.Schema({
  baseCredits: {
    type: Map,
    of: Number,
    default: {}
  },
  guestPrices: {
    type: Map,
    of: Number,
    default: {}
  },
  provenancePrice: {
    type: Number,
    default: 5
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PricingSetting', pricingSettingSchema);
