/**
 * Pricing configuration per brand and additional services
 */

const DEFAULT_PROVENANCE_PRICE = 5;

const PROVENANCE_SERVICE = {
  id: 9,
  serviceId: 9,
  name: '📋 Raport de proveniență și blocări',
  displayName: 'Raport proveniență',
  description: 'Obține istoricul complet al dispozitivului: țara și magazinul de achiziție, date despre activare și garanție, posibile blocări și politici GSX. Recomandat pentru a valida proveniența telefonului.',
  category: 'Proveniență',
  price: DEFAULT_PROVENANCE_PRICE,
  postVerification: true
};

const PRICING = {
  // Base prices per brand (default verification)
  base: {
    apple: 3,      // Service 19 - Apple FULL INFO [+Carrier] B
    samsung: 3,    // Service 37 - Samsung Info & KNOX STATUS
    honor: 3,      // Service 58 - Honor Info
    huawei: 3,    // Service 17 - Huawei IMEI Info
    xiaomi: 3,    // Service 25 - Xiaomi MI LOCK & INFO
    oneplus: 3,   // Service 27 - OnePlus IMEI Info
    motorola: 3,  // Service 63 - Motorola Info
    default: 3    // Fallback price
  },
  
  // Single upsell available for all brands (provenance report)
  additional: {
    default: [PROVENANCE_SERVICE]
  },

  defaults: {
    provenancePrice: DEFAULT_PROVENANCE_PRICE
  }
};

/**
 * Get base price for a brand
 */
function getBasePrice(brand) {
  return PRICING.base[brand] || PRICING.base.default;
}

/**
 * Get additional services for a brand
 */
function getAdditionalServices(brand) {
  return PRICING.additional[brand] || PRICING.additional.default || [];
}

/**
 * Calculate total price including additional services
 */
function calculateTotalPrice(brand, additionalServiceIds = []) {
  let total = getBasePrice(brand);
  
  const additional = getAdditionalServices(brand);
  additional.forEach(service => {
    if (additionalServiceIds.includes(service.id)) {
      total += service.price;
    }
  });
  
  return total;
}

module.exports = {
  PRICING,
  getBasePrice,
  getAdditionalServices,
  calculateTotalPrice
};

