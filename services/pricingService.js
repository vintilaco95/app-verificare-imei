const PricingSetting = require('../models/PricingSetting');
const { PRICING, getAdditionalServices } = require('../config/pricing');
const { CREDIT_VALUE } = require('../config/currency');

let cachedConfig = null;
let cachedAt = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

function mergeBaseCredits(dbBase = {}) {
  const defaults = PRICING.base || {};
  const result = { ...defaults };
  Object.keys(dbBase || {}).forEach((brand) => {
    const value = Number(dbBase[brand]);
    if (!Number.isNaN(value) && value >= 0) {
      result[brand] = value;
    }
  });
  return result;
}

function mergeGuestPrices(baseCredits, dbGuest = {}) {
  const result = {};
  Object.keys(baseCredits).forEach((brand) => {
    const override = Number(dbGuest[brand]);
    if (!Number.isNaN(override) && override >= 0) {
      result[brand] = override;
    } else {
      result[brand] = Number((baseCredits[brand] * CREDIT_VALUE).toFixed(2));
    }
  });
  return result;
}

async function fetchPricingConfig() {
  if (cachedConfig && Date.now() - cachedAt < CACHE_TTL) {
    return cachedConfig;
  }

  const setting = await PricingSetting.findOne().sort({ updatedAt: -1 }).lean();
  const baseCredits = mergeBaseCredits(setting ? setting.baseCredits : {});
  const guestPrices = mergeGuestPrices(baseCredits, setting ? setting.guestPrices : {});

  cachedConfig = {
    baseCredits,
    guestPrices,
    additionalServices: PRICING.additional || {},
    updatedAt: setting ? setting.updatedAt : null,
    updatedBy: setting ? setting.updatedBy : null
  };
  cachedAt = Date.now();
  return cachedConfig;
}

async function getPricingConfig() {
  return fetchPricingConfig();
}

async function getBasePrice(brand) {
  const config = await fetchPricingConfig();
  return config.baseCredits[brand] || config.baseCredits.default || 0;
}

async function getGuestPrice(brand) {
  const config = await fetchPricingConfig();
  return config.guestPrices[brand] || config.guestPrices.default || 0;
}

async function getAdditional(brand) {
  return getAdditionalServices(brand);
}

async function calculateTotalCredits(brand, additionalServiceIds = []) {
  const base = await getBasePrice(brand);
  let total = base;
  const additional = await getAdditional(brand);
  additional.forEach((service) => {
    if (additionalServiceIds.includes(service.id)) {
      total += service.price;
    }
  });
  return total;
}

async function updatePricingConfig({ baseCredits = {}, guestPrices = {} }, userId) {
  const payload = {
    baseCredits,
    guestPrices,
    updatedBy: userId || null
  };

  const existing = await PricingSetting.findOne().sort({ updatedAt: -1 });
  if (existing) {
    existing.baseCredits = baseCredits;
    existing.guestPrices = guestPrices;
    existing.updatedBy = userId || existing.updatedBy;
    await existing.save();
  } else {
    await PricingSetting.create(payload);
  }

  cachedConfig = null;
  cachedAt = 0;
  return fetchPricingConfig();
}

module.exports = {
  getPricingConfig,
  getBasePrice,
  getGuestPrice,
  getAdditionalServices: getAdditional,
  calculateTotalCredits,
  updatePricingConfig
};
