/**
 * Helper functions for formatting verification data in human-readable format
 */

/**
 * Format warranty info based on purchase/activation date
 */
function formatWarrantyInfo(purchaseDate, activationDate, brand) {
  const isApple = brand === 'apple' || brand === 'iphone';
  const warrantyPeriod = isApple ? 1 : 2; // 1 year for Apple, 2 years for others
  
  // Try purchase date first, then activation date
  const dateStr = purchaseDate || activationDate;
  
  if (!dateStr || dateStr === 'N/A' || dateStr === 'null' || dateStr === '') {
    return {
      status: 'unknown',
      text: 'Nu avem informații despre garanție',
      hasInfo: false
    };
  }
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return {
        status: 'unknown',
        text: 'Nu avem informații despre garanție',
        hasInfo: false
      };
    }
    
    const endDate = new Date(date);
    endDate.setFullYear(endDate.getFullYear() + warrantyPeriod);
    
    const now = new Date();
    const isExpired = endDate < now;
    
    if (isExpired) {
      return {
        status: 'expired',
        text: `Garanția a expirat (${warrantyPeriod} ${warrantyPeriod === 1 ? 'an' : 'ani'} de la ${formatDate(dateStr)})`,
        hasInfo: true,
        endDate: endDate
      };
    } else {
      return {
        status: 'active',
        text: `Garanție activă până la ${formatDate(endDate.toISOString())} (${warrantyPeriod} ${warrantyPeriod === 1 ? 'an' : 'ani'})`,
        hasInfo: true,
        endDate: endDate
      };
    }
  } catch (e) {
    return {
      status: 'unknown',
      text: 'Nu avem informații despre garanție',
      hasInfo: false
    };
  }
}

/**
 * Format date in Romanian format
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Data necunoscută';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Data necunoscută';
    
    return date.toLocaleDateString('ro-RO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return 'Data necunoscută';
  }
}

/**
 * Format iCloud status
 */
function normalizeBoolean(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'boolean') return value;

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['on', 'true', 'yes', 'da', '1', 'activ', 'enabled'].includes(normalized)) {
      return true;
    }

    if (['off', 'false', 'no', 'nu', '0', 'dezactivat', 'disabled'].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function formatiCloudStatus(fmiOn, fmiON) {
  // Normalize both possible sources
  const normalizedFmiOn = normalizeBoolean(fmiOn);
  const normalizedFmiON = normalizeBoolean(fmiON);

  // Prefer explicit values; if one is null use the other
  const isOn = normalizedFmiOn !== null ? normalizedFmiOn : normalizedFmiON;

  if (isOn === true) {
    return {
      status: 'on',
      text: 'iCloud este ACTIV',
      color: '#ef4444',
      warning: true
    };
  }

  if (isOn === false) {
    return {
      status: 'off',
      text: 'iCloud este DEZACTIVAT',
      color: '#22c55e',
      warning: false
    };
  }

  return {
    status: 'unknown',
    text: 'Nu avem informații despre statusul iCloud',
    color: '#64748b',
    warning: false
  };
}

/**
 * Format blacklist status
 * Accepts gsmaBlacklisted, blacklistStatus, blacklistRecords, and blacklistData object
 */
function formatBlacklistStatus(gsmaBlacklisted, blacklistStatus, blacklistRecords = null, blacklistData = null) {
  // If blacklistData object is provided, extract values from it
  if (blacklistData && typeof blacklistData === 'object') {
    gsmaBlacklisted = gsmaBlacklisted !== undefined ? gsmaBlacklisted : blacklistData.gsmaBlacklisted;
    blacklistStatus = blacklistStatus !== undefined ? blacklistStatus : blacklistData.blacklistStatus;
    blacklistRecords = blacklistRecords !== null ? blacklistRecords : blacklistData.blacklistRecords;
  }
  
  // Determine if device is blacklisted
  const isBlacklisted = gsmaBlacklisted === true || gsmaBlacklisted === 'Da' || 
                        blacklistStatus === 'BLACKLISTED' || blacklistStatus === true ||
                        (blacklistRecords !== null && blacklistRecords !== undefined && blacklistRecords > 0);
  
  if (isBlacklisted) {
    let text = 'Dispozitivul este BLOCAT sau FURAT';
    if (blacklistRecords !== null && blacklistRecords !== undefined && blacklistRecords > 0) {
      text += ` (${blacklistRecords} înregistrări blacklist)`;
    }
    return {
      status: 'blacklisted',
      text: text,
      color: '#ef4444',
      warning: true,
      records: blacklistRecords
    };
  } else if (gsmaBlacklisted === false || gsmaBlacklisted === 'Nu' || 
             blacklistStatus === 'CLEAN' || blacklistStatus === false ||
             (blacklistRecords !== null && blacklistRecords !== undefined && blacklistRecords === 0)) {
    let text = 'Dispozitivul este CLEAN (nu este blocat)';
    if (blacklistRecords !== null && blacklistRecords !== undefined && blacklistRecords === 0) {
      text += ' (0 înregistrări blacklist)';
    }
    return {
      status: 'clean',
      text: text,
      color: '#22c55e',
      warning: false,
      records: blacklistRecords !== null ? blacklistRecords : 0
    };
  } else {
    return {
      status: 'unknown',
      text: 'Nu avem informații despre statusul blacklist',
      color: '#64748b',
      warning: false,
      records: null
    };
  }
}

/**
 * Format Knox Guard status
 */
function formatKnoxStatus(knoxRegistered) {
  if (knoxRegistered === true || knoxRegistered === 'ON' || 
      (typeof knoxRegistered === 'string' && knoxRegistered.toLowerCase().includes('on'))) {
    return {
      status: 'active',
      text: 'Knox Guard este ACTIV',
      color: '#f97316',
      warning: true
    };
  } else if (knoxRegistered === false || knoxRegistered === 'OFF' ||
             (typeof knoxRegistered === 'string' && knoxRegistered.toLowerCase().includes('off'))) {
    return {
      status: 'inactive',
      text: 'Knox Guard este DEZACTIVAT',
      color: '#22c55e',
      warning: false
    };
  } else {
    return {
      status: 'unknown',
      text: 'Nu avem informații despre statusul Knox Guard',
      color: '#64748b',
      warning: false
    };
  }
}

/**
 * Format MDM lock status
 */
function formatMDMStatus(mdmStatus, mdmLocked) {
  const isLocked = mdmStatus === true || mdmLocked === true || 
                   mdmStatus === 'ACTIVE' || mdmLocked === 'LOCKED';
  
  if (isLocked) {
    return {
      status: 'locked',
      text: 'MDM Lock este ACTIV',
      color: '#f97316',
      warning: true
    };
  } else if (mdmStatus === false || mdmLocked === false ||
             mdmStatus === 'INACTIVE' || mdmLocked === 'UNLOCKED') {
    return {
      status: 'unlocked',
      text: 'MDM Lock este DEZACTIVAT',
      color: '#22c55e',
      warning: false
    };
  } else {
    return {
      status: 'unknown',
      text: 'Nu avem informații despre MDM Lock',
      color: '#64748b',
      warning: false
    };
  }
}

/**
 * Format lost mode status
 */
function formatLostModeStatus(lostMode) {
  if (lostMode === true || lostMode === 'true' || lostMode === 'ON') {
    return {
      status: 'active',
      text: 'Mod Pierdut este ACTIV',
      color: '#ef4444',
      warning: true
    };
  } else if (lostMode === false || lostMode === 'false' || lostMode === 'OFF') {
    return {
      status: 'inactive',
      text: 'Mod Pierdut este DEZACTIVAT',
      color: '#22c55e',
      warning: false
    };
  } else {
    return {
      status: 'unknown',
      text: 'Nu avem informații despre Mod Pierdut',
      color: '#64748b',
      warning: false
    };
  }
}

/**
 * Format Mi Activation Lock status (Xiaomi)
 */
function formatMiLockStatus(miLockStatus) {
  if (!miLockStatus || miLockStatus === 'N/A') {
    return {
      status: 'unknown',
      text: 'Nu avem informații despre Mi Activation Lock',
      color: '#64748b',
      warning: false
    };
  }

  const normalized = miLockStatus.toString().trim().toLowerCase();

  if (normalized === 'off' || normalized === 'disabled' || normalized.includes('unlock') || normalized.includes('not found')) {
    return {
      status: 'off',
      text: 'Mi Activation Lock este DEZACTIVAT',
      color: '#22c55e',
      warning: false
    };
  }

  if (normalized === 'on' || normalized.includes('locked') || normalized.includes('in database')) {
    return {
      status: 'on',
      text: 'Mi Activation Lock este ACTIV (dispozitiv legat de cont Mi)',
      color: '#ef4444',
      warning: true
    };
  }

  return {
    status: 'unknown',
    text: `Status Mi Activation Lock: ${miLockStatus}`,
    color: '#f97316',
    warning: false
  };
}

/**
 * Format network lock status
 */
function formatNetworkLockStatus(simlock, carrier) {
  const isLocked = simlock === true || simlock === 'Da' || 
                   (typeof simlock === 'string' && simlock.toLowerCase().includes('lock'));

  const normalizedCarrier = (carrier || '').toString().trim();
  let carrierText = normalizedCarrier;
  
  if (!carrierText || carrierText.toLowerCase() === 'n/a' || carrierText.toLowerCase() === 'null' || carrierText === '-') {
    carrierText = 'rețea necunoscută';
  }

  const carrierLower = carrierText.toLowerCase();
  const isOrangeRomania = carrierLower.includes('orange romania');

  if (isLocked) {
    if (isOrangeRomania) {
      return {
        status: 'locked_orange',
        text: 'Dispozitivul este blocat pe Orange Romania (se poate debloca foarte ieftin și rapid)',
        color: '#f97316',
        warning: true,
        carrier: carrierText,
        orangeSafe: true
      };
    }

    return {
      status: 'locked',
      text: `Dispozitivul este BLOCAT pe rețeaua: ${carrierText}. Nu recomandăm achiziția.`,
      color: '#ef4444',
      warning: true,
      carrier: carrierText,
      orangeSafe: false
    };
  } else if (simlock === false || simlock === 'Nu' ||
             (typeof simlock === 'string' && simlock.toLowerCase().includes('unlock'))) {
    return {
      status: 'unlocked',
      text: 'Dispozitivul este LIBER (nu este blocat pe rețea)',
      color: '#22c55e',
      warning: false,
      carrier: carrierText || null,
      orangeSafe: false
    };
  } else {
    return {
      status: 'unknown',
      text: 'Nu avem informații despre blocarea rețelei',
      color: '#64748b',
      warning: false,
      carrier: carrierText || null,
      orangeSafe: false
    };
  }
}

/**
 * Format origin information
 */
function formatOriginInfo(country, soldBy, soldByCountry) {
  const originCountry = country || soldByCountry;
  const seller = soldBy;
  
  let text = '';
  if (originCountry && originCountry !== 'N/A' && originCountry !== 'null') {
    text = `Țara de proveniență: ${originCountry}`;
  }
  
  if (seller && seller !== 'N/A' && seller !== 'null') {
    if (text) text += ' | ';
    text += `Vânzător: ${seller}`;
  }
  
  if (!text) {
    return {
      hasInfo: false,
      text: 'Nu avem informații despre proveniență'
    };
  }
  
  return {
    hasInfo: true,
    text: text,
    country: originCountry,
    seller: seller
  };
}

/**
 * Calculate risk score based on critical information
 */
function calculateRiskScore(info) {
  let score = 10; // Start with perfect score
  
  // Critical issues (reduce score significantly)
  if (info.blacklist && info.blacklist.status === 'blacklisted') score -= 8;
  if (info.lostMode && info.lostMode.status === 'active') score -= 7;
  if (info.iCloud && info.iCloud.status === 'on') score -= 5;
  if (info.knox && info.knox.status === 'active') score -= 5;
  if (info.mdm && info.mdm.status === 'locked') score -= 4;
  
  // Moderate issues
  if (info.networkLock) {
    if (info.networkLock.status === 'locked') {
      score -= 4;
    } else if (info.networkLock.status === 'locked_orange') {
      score -= 1;
    }
  }
  
  // Ensure score is between 0 and 10
  return Math.max(0, Math.min(10, score));
}

module.exports = {
  formatWarrantyInfo,
  formatDate,
  formatiCloudStatus,
  formatBlacklistStatus,
  formatKnoxStatus,
  formatMDMStatus,
  formatLostModeStatus,
  formatMiLockStatus,
  formatNetworkLockStatus,
  formatOriginInfo,
  calculateRiskScore
};

