/**
 * Pricing configuration for frontend
 */

const SERVER_BASE_PRICING = (typeof window !== 'undefined' && window.serverPricing) ? window.serverPricing : null;
const parsedCreditValue = (typeof window !== 'undefined' && window.creditValue !== undefined)
  ? parseFloat(window.creditValue)
  : NaN;
const CREDIT_VALUE = (!isNaN(parsedCreditValue) && parsedCreditValue > 0) ? parsedCreditValue : 1;
const CURRENCY_CODE = (typeof window !== 'undefined' && window.currencyCode)
  ? window.currencyCode
  : 'RON';
const CURRENCY_LABEL = (CURRENCY_CODE || 'RON').toUpperCase();

const SERVER_ADDITIONAL_PRICING = (typeof window !== 'undefined' && window.serverAdditionalServices)
  ? window.serverAdditionalServices
  : null;
const PROVENANCE_PRICE = (typeof window !== 'undefined' && window.provenancePriceCredits !== undefined)
  ? parseFloat(window.provenancePriceCredits)
  : NaN;

const FALLBACK_BASE_PRICING = {
  apple: 3,
  samsung: 3,
  honor: 3,
  huawei: 3,
  xiaomi: 3,
  oneplus: 3,
  motorola: 3,
  default: 3
};

const BASE_PRICING = SERVER_BASE_PRICING || FALLBACK_BASE_PRICING;

const DEFAULT_PROVENANCE_PRICE = (!isNaN(PROVENANCE_PRICE) && PROVENANCE_PRICE >= 0)
  ? PROVENANCE_PRICE
  : 5;

function buildDefaultAdditional(baseConfig) {
  const template = {
    id: 9,
    serviceId: 9,
    name: '📋 Raport de proveniență și blocări',
    displayName: 'Raport proveniență',
    description: 'Obține istoricul complet al dispozitivului: țara și magazinul de achiziție, date despre activare și garanție, posibile blocări și politici GSX. Recomandat pentru a valida proveniența telefonului.',
    category: 'Proveniență',
    price: DEFAULT_PROVENANCE_PRICE,
    postVerification: true
  };

  const additional = {};
  Object.keys(baseConfig).forEach((brand) => {
    additional[brand] = [ { ...template } ];
  });
  return additional;
}

const ADDITIONAL_PRICING = (() => {
  if (SERVER_ADDITIONAL_PRICING && Object.keys(SERVER_ADDITIONAL_PRICING).length) {
    return SERVER_ADDITIONAL_PRICING;
  }
  return buildDefaultAdditional(BASE_PRICING);
})();

const PRICING_CONFIG = {
  base: BASE_PRICING,
  additional: ADDITIONAL_PRICING
};

/**
 * Get base price for brand
 */
function getBasePrice(brand) {
  return PRICING_CONFIG.base[brand] || PRICING_CONFIG.base.default;
}

/**
 * Get additional services for brand
 */
function getAdditionalServices(brand) {
  return PRICING_CONFIG.additional[brand] || [];
}

/**
 * Update pricing display
 */
function updatePricingDisplay(brand, selectedServices = [], isGuest = false) {
  const basePrice = getBasePrice(brand);
  let totalPrice = basePrice;
  
  const additional = getAdditionalServices(brand);
  additional.forEach(service => {
    if (selectedServices.includes(service.id)) {
      totalPrice += service.price;
    }
  });
  
  const costElement = isGuest ? document.getElementById('estimated-cost-guest') : document.getElementById('estimated-cost');
  if (costElement) {
    if (isGuest) {
      costElement.textContent = `${(totalPrice * CREDIT_VALUE).toFixed(2)} ${CURRENCY_LABEL}`;
    } else {
      costElement.textContent = `${totalPrice.toFixed(2)} credite`;
    }
  }
}

/**
 * Render additional services checkboxes
 */
function renderAdditionalServices(brand, isGuest = false) {
  const containerId = isGuest ? 'additional-services-list-guest' : 'additional-services-list';
  const container = document.getElementById(containerId);
  const servicesContainer = isGuest ? document.getElementById('additional-services-guest') : document.getElementById('additional-services');
  
  if (!container || !servicesContainer) return;
  
  const additional = getAdditionalServices(brand)
    .filter((service) => !service.postVerification);
  
  if (additional.length === 0) {
    servicesContainer.style.display = 'none';
    return;
  }
  
  servicesContainer.style.display = 'block';
  container.innerHTML = '';
  
  additional.forEach(service => {
    const serviceDiv = document.createElement('div');
    serviceDiv.className = 'additional-service-item';
    const priceText = isGuest
      ? `+${(service.price * CREDIT_VALUE).toFixed(2)} ${CURRENCY_LABEL}`
      : `+${service.price.toFixed(2)} credite`;
    serviceDiv.innerHTML = `
      <label class="service-checkbox">
        <input type="checkbox" name="additionalServices[]" value="${service.id}" data-price="${service.price}" class="service-checkbox-input">
        <div class="service-checkbox-content">
          <div class="service-header">
            <span class="service-name">${service.name}</span>
            <span class="service-price">${priceText}</span>
          </div>
          <p class="service-description">${service.description}</p>
        </div>
      </label>
    `;
    container.appendChild(serviceDiv);
  });
  
  // Add event listeners to checkboxes
  const checkboxes = container.querySelectorAll('.service-checkbox-input');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const selectedServices = Array.from(container.querySelectorAll('.service-checkbox-input:checked'))
        .map(cb => parseInt(cb.value));
      updatePricingDisplay(brand, selectedServices, isGuest);
      if (isGuest && typeof window.updateGuestPriceDisplay === 'function') {
        window.updateGuestPriceDisplay();
      }
    });
  });

  if (isGuest && typeof window.updateGuestPriceDisplay === 'function') {
    window.updateGuestPriceDisplay();
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.PRICING_CONFIG = PRICING_CONFIG;
  window.getBasePrice = getBasePrice;
  window.getAdditionalServices = getAdditionalServices;
  window.updatePricingDisplay = updatePricingDisplay;
  window.renderAdditionalServices = renderAdditionalServices;
}

