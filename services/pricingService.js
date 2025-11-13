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
  const defaultProvenancePrice = (PRICING && PRICING.defaults && typeof PRICING.defaults.provenancePrice === 'number')
    ? PRICING.defaults.provenancePrice
    : 5;
  const provenancePrice = (() => {
    if (!setting || typeof setting.provenancePrice !== 'number' || Number.isNaN(setting.provenancePrice)) {
      return defaultProvenancePrice;
    }
    return Math.max(0, Number(setting.provenancePrice));
  })();

  const buildAdditionalServices = () => {
    const template = PRICING.additional || {};
    const mapped = {};
    Object.keys(baseCredits).forEach((brand) => {
      const services = template[brand] || template.default || [];
      mapped[brand] = services.map((service) => {
        if (service.id === 9 || service.serviceId === 9) {
          return {
            ...service,
            price: provenancePrice
          };
        }
        return { ...service };
      });
    });
    return mapped;
  };

  cachedConfig = {
    baseCredits,
    guestPrices,
    additionalServices: buildAdditionalServices(),
    provenancePrice,
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
  const config = await fetchPricingConfig();
  return config.additionalServices[brand] || config.additionalServices.default || getAdditionalServices(brand);
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

async function updatePricingConfig({ baseCredits = {}, guestPrices = {}, provenancePrice = null }, userId) {
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
    if (provenancePrice !== null && !Number.isNaN(provenancePrice) && provenancePrice >= 0) {
      existing.provenancePrice = provenancePrice;
    }
    await existing.save();
  } else {
    if (provenancePrice !== null && !Number.isNaN(provenancePrice) && provenancePrice >= 0) {
      payload.provenancePrice = provenancePrice;
    }
    await PricingSetting.create(payload);
  }

  cachedConfig = null;
  cachedAt = 0;
  return fetchPricingConfig();
}

async function getProvenancePrice() {
  const config = await fetchPricingConfig();
  return config.provenancePrice || (PRICING && PRICING.defaults && PRICING.defaults.provenancePrice) || 5;
}

module.exports = {
  getPricingConfig,
  getBasePrice,
  getGuestPrice,
  getAdditionalServices: getAdditional,
  calculateTotalCredits,
  updatePricingConfig,
  getProvenancePrice
};
