/**
 * Pricing configuration per brand and additional services
 */

const PRICING = {
  // Base prices per brand (default verification)
  base: {
    apple: 1,      // Service 19 - Apple FULL INFO [+Carrier] B
    samsung: 1,    // Service 37 - Samsung Info & KNOX STATUS
    honor: 1,      // Service 58 - Honor Info
    huawei: 1,    // Service 17 - Huawei IMEI Info
    xiaomi: 1,    // Service 25 - Xiaomi MI LOCK & INFO
    oneplus: 1,   // Service 27 - OnePlus IMEI Info
    motorola: 1,  // Service 63 - Motorola Info
    default: 1    // Fallback price
  },
  
  // Additional services (optional, extra cost)
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
        id: 900, // Special ID for post-verification enhancement
        name: '📋 Completează datele cu proveniența și riscul de blocare',
        description: 'Obține informații detaliate despre istoricul de achiziție, procurare, blocare și toate detaliile despre telefon folosind serviciul GSX complet.',
        price: 5,
        serviceId: 9,
        displayName: 'Proveniență și Riscul de Blocare',
        category: 'Proveniență',
        postVerification: true // Flag to indicate this is available after initial verification
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
        id: 900, // Special ID for post-verification enhancement
        name: '📋 Completează datele cu proveniența și riscul de blocare',
        description: 'Obține informații detaliate despre istoricul de achiziție, procurare, blocare și toate detaliile despre telefon folosind serviciul complet.',
        price: 5,
        serviceId: 9,
        displayName: 'Proveniență și Riscul de Blocare',
        category: 'Proveniență',
        postVerification: true // Flag to indicate this is available after initial verification
      },
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
 * Get base price for a brand
 */
function getBasePrice(brand) {
  return PRICING.base[brand] || PRICING.base.default;
}

/**
 * Get additional services for a brand
 */
function getAdditionalServices(brand) {
  return PRICING.additional[brand] || [];
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

