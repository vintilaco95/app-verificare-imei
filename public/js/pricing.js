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

const PRICING_CONFIG = {
  base: SERVER_BASE_PRICING || {
    apple: 0.12,
    samsung: 0.09,
    honor: 0.05,
    huawei: 0.07,
    xiaomi: 0.05,
    oneplus: 0.04,
    motorola: 0.05,
    default: 0.10
  },
  
  additional: {
    apple: [
      {
        id: 9,
        name: '🔍 Verificare Sursă de Achiziție',
        description: 'Află de unde a fost cumpărat inițial telefonul (magazin, rețea, online). Ajută la verificarea legitimății și a garanției. Rezultatele includ informații despre locul de vânzare inițial și data achiziției.',
        price: 1.69,
        serviceId: 9,
        displayName: 'Sursă de Achiziție',
        category: 'Proveniență'
      },
      {
        id: 47,
        name: '🛡️ Verificare Completă Securitate',
        description: 'Verificare exhaustivă a securității dispozitivului: status MDM (Management Device Mobile - dacă e gestionat de o companie), blacklist GSMA (dacă e blocat global), și toate informațiile complete despre telefon. Recomandat pentru verificări importante.',
        price: 0.75,
        serviceId: 47,
        displayName: 'Verificare Completă Securitate',
        category: 'Securitate'
      },
      {
        id: 46,
        name: '🔐 Verificare Management & Blocare',
        description: 'Verifică dacă telefonul este gestionat de o companie (MDM), politici de securitate GSX, și status Find My iPhone. Ajută la identificarea dispozitivelor corporative sau blocate.',
        price: 0.45,
        serviceId: 46,
        displayName: 'Management & Blocare',
        category: 'Securitate'
      },
      {
        id: 41,
        name: '📱 Verificare Management Dispositiv (MDM)',
        description: 'Verifică dacă telefonul este gestionat de o companie sau organizație prin MDM (Mobile Device Management). Dispozitivele cu MDM activ pot fi blocate de la distanță și pot avea restricții de utilizare.',
        price: 0.22,
        serviceId: 41,
        displayName: 'Status MDM',
        category: 'Securitate'
      }
    ],
    samsung: [
      {
        id: 36,
        name: '🛡️ Informații Complete + Blacklist',
        description: 'Obține informații detaliate despre telefonul Samsung și verificare blacklist globală. Include status blocare, informații despre model, și verificare în bazele de date internaționale.',
        price: 0.06,
        serviceId: 36,
        displayName: 'Info + Blacklist',
        category: 'Securitate'
      },
      {
        id: 53,
        name: '🔒 Verificare Status KNOX',
        description: 'Verifică statusul Samsung KNOX - sistemul de securitate care protejează datele. Ajută la identificarea dacă telefonul a fost compromis sau modificat.',
        price: 0.04,
        serviceId: 53,
        displayName: 'Status KNOX',
        category: 'Securitate'
      }
    ],
    honor: [],
    huawei: [],
    xiaomi: [],
    oneplus: [],
    motorola: []
  }
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
  
  const additional = getAdditionalServices(brand);
  
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

