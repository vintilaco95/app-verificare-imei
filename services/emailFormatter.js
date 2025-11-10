/**
 * Helper functions for formatting verification data in human-readable format
 */

const DEFAULT_LANGUAGE = 'ro';
const SUPPORTED_LANGUAGES = new Set(['ro', 'en']);
const riskWeights = require('../config/riskWeights');

function normalizeLang(lang) {
  return lang && SUPPORTED_LANGUAGES.has(lang) ? lang : DEFAULT_LANGUAGE;
}

function createTexts(ro, en) {
  return { ro, en };
}

function textFor(lang, texts) {
  const normalized = normalizeLang(lang);
  if (texts && texts[normalized]) {
    return texts[normalized];
  }
  return texts && texts[DEFAULT_LANGUAGE] ? texts[DEFAULT_LANGUAGE] : '';
}

/**
 * Format warranty info based on purchase/activation date
 */
function formatWarrantyInfo(purchaseDate, activationDate, brand, lang = DEFAULT_LANGUAGE) {
  const isApple = brand === 'apple' || brand === 'iphone';
  const warrantyPeriod = isApple ? 1 : 2; // 1 year for Apple, 2 years for others
  
  // Try purchase date first, then activation date
  const dateStr = purchaseDate || activationDate;
  const periodUnitRo = warrantyPeriod === 1 ? 'an' : 'ani';
  const periodUnitEn = warrantyPeriod === 1 ? 'year' : 'years';
  
  if (!dateStr || dateStr === 'N/A' || dateStr === 'null' || dateStr === '') {
    const texts = createTexts(
      'Nu avem informații despre garanție',
      'No warranty information available'
    );
    return {
      status: 'unknown',
      text: textFor(lang, texts),
      texts,
      hasInfo: false
    };
  }
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      const texts = createTexts(
        'Nu avem informații despre garanție',
        'No warranty information available'
      );
      return {
        status: 'unknown',
        text: textFor(lang, texts),
        texts,
        hasInfo: false
      };
    }
    
    const endDate = new Date(date);
    endDate.setFullYear(endDate.getFullYear() + warrantyPeriod);
    
    const now = new Date();
    const isExpired = endDate < now;
    
    if (isExpired) {
      const ro = `Garanția a expirat (${warrantyPeriod} ${periodUnitRo} de la ${formatDate(dateStr, 'ro')})`;
      const en = `Warranty expired (${warrantyPeriod} ${periodUnitEn} since ${formatDate(dateStr, 'en')})`;
      const texts = createTexts(ro, en);
      return {
        status: 'expired',
        text: textFor(lang, texts),
        texts,
        hasInfo: true,
        endDate: endDate
      };
    } else {
      const ro = `Garanție activă până la ${formatDate(endDate.toISOString(), 'ro')} (${warrantyPeriod} ${periodUnitRo})`;
      const en = `Warranty active until ${formatDate(endDate.toISOString(), 'en')} (${warrantyPeriod} ${periodUnitEn})`;
      const texts = createTexts(ro, en);
      return {
        status: 'active',
        text: textFor(lang, texts),
        texts,
        hasInfo: true,
        endDate: endDate
      };
    }
  } catch (e) {
    const texts = createTexts(
      'Nu avem informații despre garanție',
      'No warranty information available'
    );
    return {
      status: 'unknown',
      text: textFor(lang, texts),
      texts,
      hasInfo: false
    };
  }
}

/**
 * Format date in Romanian format
 */
function formatDate(dateStr, lang = DEFAULT_LANGUAGE) {
  const normalizedLang = normalizeLang(lang);
  const unknownTexts = createTexts('Data necunoscută', 'Unknown date');
  if (!dateStr) return textFor(normalizedLang, unknownTexts);
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return textFor(normalizedLang, unknownTexts);
    
    return date.toLocaleDateString(
      normalizedLang === 'en' ? 'en-US' : 'ro-RO',
      {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
      }
    );
  } catch (e) {
    return textFor(normalizedLang, unknownTexts);
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

function formatiCloudStatus(fmiOn, fmiON, lang = DEFAULT_LANGUAGE) {
  // Normalize both possible sources
  const normalizedFmiOn = normalizeBoolean(fmiOn);
  const normalizedFmiON = normalizeBoolean(fmiON);

  // Prefer explicit values; if one is null use the other
  const isOn = normalizedFmiOn !== null ? normalizedFmiOn : normalizedFmiON;
  const textsOn = createTexts('iCloud este ACTIV', 'iCloud is ON');
  const textsOff = createTexts('iCloud este DEZACTIVAT', 'iCloud is OFF');
  const textsUnknown = createTexts('Nu avem informații despre statusul iCloud', 'No iCloud status information available');

  if (isOn === true) {
    return {
      status: 'on',
      text: textFor(lang, textsOn),
      texts: textsOn,
      color: '#ef4444',
      warning: true
    };
  }

  if (isOn === false) {
    return {
      status: 'off',
      text: textFor(lang, textsOff),
      texts: textsOff,
      color: '#22c55e',
      warning: false
    };
  }

  return {
    status: 'unknown',
    text: textFor(lang, textsUnknown),
    texts: textsUnknown,
    color: '#64748b',
    warning: false
  };
}

/**
 * Format blacklist status
 * Accepts gsmaBlacklisted, blacklistStatus, blacklistRecords, and blacklistData object
 */
function formatBlacklistStatus(gsmaBlacklisted, blacklistStatus, blacklistRecords = null, blacklistData = null, lang = DEFAULT_LANGUAGE) {
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
    const roBase = 'Dispozitivul este BLOCAT sau FURAT';
    const enBase = 'Device is BLACKLISTED or REPORTED';
    let ro = roBase;
    let en = enBase;
    if (blacklistRecords !== null && blacklistRecords !== undefined && blacklistRecords > 0) {
      ro += ` (${blacklistRecords} înregistrări blacklist)`;
      en += ` (${blacklistRecords} blacklist record${blacklistRecords === 1 ? '' : 's'})`;
    }
    const texts = createTexts(ro, en);
    return {
      status: 'blacklisted',
      text: textFor(lang, texts),
      texts,
      color: '#ef4444',
      warning: true,
      records: blacklistRecords
    };
  } else if (gsmaBlacklisted === false || gsmaBlacklisted === 'Nu' || 
             blacklistStatus === 'CLEAN' || blacklistStatus === false ||
             (blacklistRecords !== null && blacklistRecords !== undefined && blacklistRecords === 0)) {
    const roBase = 'Dispozitivul este CLEAN (nu este blocat)';
    const enBase = 'Device is CLEAN (not blocked)';
    let ro = roBase;
    let en = enBase;
    if (blacklistRecords !== null && blacklistRecords !== undefined && blacklistRecords === 0) {
      ro += ' (0 înregistrări blacklist)';
      en += ' (0 blacklist records)';
    }
    const texts = createTexts(ro, en);
    return {
      status: 'clean',
      text: textFor(lang, texts),
      texts,
      color: '#22c55e',
      warning: false,
      records: blacklistRecords !== null ? blacklistRecords : 0
    };
  } else {
    const texts = createTexts(
      'Nu avem informații despre statusul blacklist',
      'No blacklist status information available'
    );
    return {
      status: 'unknown',
      text: textFor(lang, texts),
      texts,
      color: '#64748b',
      warning: false,
      records: null
    };
  }
}

/**
 * Format Knox Guard status
 */
function formatKnoxStatus(knoxRegistered, lang = DEFAULT_LANGUAGE) {
  if (knoxRegistered === true || knoxRegistered === 'ON' || 
      (typeof knoxRegistered === 'string' && knoxRegistered.toLowerCase().includes('on'))) {
    const texts = createTexts(
      'Knox Guard este ACTIV',
      'Knox Guard is ACTIVE'
    );
    return {
      status: 'active',
      text: textFor(lang, texts),
      texts,
      color: '#f97316',
      warning: true
    };
  } else if (knoxRegistered === false || knoxRegistered === 'OFF' ||
             (typeof knoxRegistered === 'string' && knoxRegistered.toLowerCase().includes('off'))) {
    const texts = createTexts(
      'Knox Guard este DEZACTIVAT',
      'Knox Guard is DISABLED'
    );
    return {
      status: 'inactive',
      text: textFor(lang, texts),
      texts,
      color: '#22c55e',
      warning: false
    };
  } else {
    const texts = createTexts(
      'Nu avem informații despre statusul Knox Guard',
      'No Knox Guard status information available'
    );
    return {
      status: 'unknown',
      text: textFor(lang, texts),
      texts,
      color: '#64748b',
      warning: false
    };
  }
}

/**
 * Format MDM lock status
 */
function formatMDMStatus(mdmStatus, mdmLocked, lang = DEFAULT_LANGUAGE) {
  const normalize = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') {
      return value ? 'locked' : 'unlocked';
    }
    const str = String(value).trim().toLowerCase();
    if (!str) return null;
    if (['on', 'locked', 'active', 'yes', 'true', 'enabled'].includes(str)) {
      return 'locked';
    }
    if (['off', 'unlocked', 'inactive', 'no', 'false', 'disabled', 'clean'].includes(str)) {
      return 'unlocked';
    }
    return null;
  };

  const normalizedStatus = normalize(mdmStatus) || normalize(mdmLocked);

  if (normalizedStatus === 'locked') {
    const texts = createTexts(
      'MDM Lock este ACTIV',
      'MDM Lock is ACTIVE'
    );
    return {
      status: 'locked',
      text: textFor(lang, texts),
      texts,
      color: '#f97316',
      warning: true
    };
  } else if (normalizedStatus === 'unlocked') {
    const texts = createTexts(
      'MDM Lock este DEZACTIVAT',
      'MDM Lock is DISABLED'
    );
    return {
      status: 'unlocked',
      text: textFor(lang, texts),
      texts,
      color: '#22c55e',
      warning: false
    };
  } else {
    const texts = createTexts(
      'Nu avem informații despre MDM Lock',
      'No MDM Lock information available'
    );
    return {
      status: 'unknown',
      text: textFor(lang, texts),
      texts,
      color: '#64748b',
      warning: false
    };
  }
}

/**
 * Format lost mode status
 */
function formatLostModeStatus(lostMode, lang = DEFAULT_LANGUAGE) {
  if (lostMode === true || lostMode === 'true' || lostMode === 'ON') {
    const texts = createTexts(
      'Mod Pierdut este ACTIV',
      'Lost Mode is ACTIVE'
    );
    return {
      status: 'active',
      text: textFor(lang, texts),
      texts,
      color: '#ef4444',
      warning: true
    };
  } else if (lostMode === false || lostMode === 'false' || lostMode === 'OFF') {
    const texts = createTexts(
      'Mod Pierdut este DEZACTIVAT',
      'Lost Mode is DISABLED'
    );
    return {
      status: 'inactive',
      text: textFor(lang, texts),
      texts,
      color: '#22c55e',
      warning: false
    };
  } else {
    const texts = createTexts(
      'Nu avem informații despre Mod Pierdut',
      'No Lost Mode information available'
    );
    return {
      status: 'unknown',
      text: textFor(lang, texts),
      texts,
      color: '#64748b',
      warning: false
    };
  }
}

/**
 * Format Mi Activation Lock status (Xiaomi)
 */
function formatMiLockStatus(miLockStatus, lang = DEFAULT_LANGUAGE) {
  if (!miLockStatus || miLockStatus === 'N/A') {
    const texts = createTexts(
      'Nu avem informații despre Mi Activation Lock',
      'No Mi Activation Lock information available'
    );
    return {
      status: 'unknown',
      text: textFor(lang, texts),
      texts,
      color: '#64748b',
      warning: false
    };
  }

  const normalized = miLockStatus.toString().trim().toLowerCase();

  if (normalized === 'off' || normalized === 'disabled' || normalized.includes('unlock') || normalized.includes('not found')) {
    const texts = createTexts(
      'Mi Activation Lock este DEZACTIVAT',
      'Mi Activation Lock is DISABLED'
    );
    return {
      status: 'off',
      text: textFor(lang, texts),
      texts,
      color: '#22c55e',
      warning: false
    };
  }

  if (normalized === 'on' || normalized.includes('locked') || normalized.includes('in database')) {
    const texts = createTexts(
      'Mi Activation Lock este ACTIV (dispozitiv legat de cont Mi)',
      'Mi Activation Lock is ACTIVE (device linked to Mi account)'
    );
    return {
      status: 'on',
      text: textFor(lang, texts),
      texts,
      color: '#ef4444',
      warning: true
    };
  }

  const texts = createTexts(
    `Status Mi Activation Lock: ${miLockStatus}`,
    `Mi Activation Lock status: ${miLockStatus}`
  );
  return {
    status: 'unknown',
    text: textFor(lang, texts),
    texts,
    color: '#f97316',
    warning: false
  };
}

/**
 * Format network lock status
 */
function formatNetworkLockStatus(simlock, carrier, lang = DEFAULT_LANGUAGE) {
  const isLocked = simlock === true || simlock === 'Da' || 
                   (typeof simlock === 'string' && simlock.toLowerCase().includes('lock'));

  const normalizedCarrier = (carrier || '').toString().trim();
  const fallbackCarrierTexts = createTexts('rețea necunoscută', 'unknown network');
  let carrierText = normalizedCarrier;
  
  if (!carrierText || carrierText.toLowerCase() === 'n/a' || carrierText.toLowerCase() === 'null' || carrierText === '-') {
    carrierText = textFor(lang, fallbackCarrierTexts);
  }

  const carrierLower = carrierText.toLowerCase();
  const isOrangeRomania = carrierLower.includes('orange romania');

  if (isLocked) {
    if (isOrangeRomania) {
      const texts = createTexts(
        'Dispozitivul este blocat pe Orange Romania (se poate debloca foarte ieftin și rapid)',
        'Device is locked to Orange Romania (can be unlocked cheaply and quickly)'
      );
      return {
        status: 'locked_orange',
        text: textFor(lang, texts),
        texts,
        color: '#f97316',
        warning: true,
        carrier: carrierText,
        orangeSafe: true
      };
    }

    const texts = createTexts(
      `Dispozitivul este BLOCAT pe rețeaua: ${carrierText}. Nu recomandăm achiziția.`,
      `Device is LOCKED to network: ${carrierText}. Purchase not recommended.`
    );
    return {
      status: 'locked',
      text: textFor(lang, texts),
      texts,
      color: '#ef4444',
      warning: true,
      carrier: carrierText,
      orangeSafe: false
    };
  } else if (simlock === false || simlock === 'Nu' ||
             (typeof simlock === 'string' && simlock.toLowerCase().includes('unlock'))) {
    const texts = createTexts(
      'Dispozitivul este LIBER (nu este blocat pe rețea)',
      'Device is UNLOCKED (not locked to any network)'
    );
    return {
      status: 'unlocked',
      text: textFor(lang, texts),
      texts,
      color: '#22c55e',
      warning: false,
      carrier: carrierText || null,
      orangeSafe: false
    };
  } else {
    const texts = createTexts(
      'Nu avem informații despre blocarea rețelei',
      'No network lock information available'
    );
    return {
      status: 'unknown',
      text: textFor(lang, texts),
      texts,
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
function formatOriginInfo(country, soldBy, soldByCountry, lang = DEFAULT_LANGUAGE) {
  const originCountry = country || soldByCountry;
  const seller = soldBy;
  
  let textRo = '';
  let textEn = '';
  if (originCountry && originCountry !== 'N/A' && originCountry !== 'null') {
    textRo = `Țara de proveniență: ${originCountry}`;
    textEn = `Country of origin: ${originCountry}`;
  }
  
  if (seller && seller !== 'N/A' && seller !== 'null') {
    if (textRo) textRo += ' | ';
    if (textEn) textEn += ' | ';
    textRo += `Vânzător: ${seller}`;
    textEn += `Seller: ${seller}`;
  }
  
  if (!textRo) {
    const texts = createTexts(
      'Nu avem informații despre proveniență',
      'No origin information available'
    );
    return {
      hasInfo: false,
      text: textFor(lang, texts),
      texts
    };
  }
  
  const texts = createTexts(textRo, textEn);
  return {
    hasInfo: true,
    text: textFor(lang, texts),
    texts,
    country: originCountry,
    seller: seller
  };
}

/**
 * Calculate risk score based on critical information
 */
function calculateRiskScore(info) {
  const baseScore = typeof riskWeights.baseScore === 'number' ? riskWeights.baseScore : 10;
  const penalties = riskWeights.penalties || {};
  let score = baseScore;
  
  const getPenalty = (key, fallback) => {
    if (typeof penalties[key] === 'number') {
      return penalties[key];
    }
    return fallback;
  };
  
  if (info.blacklist && info.blacklist.status === 'blacklisted') score -= getPenalty('blacklist', 8);
  if (info.lostMode && info.lostMode.status === 'active') score -= getPenalty('lostMode', 7);
  if (info.iCloud && info.iCloud.status === 'on') score -= getPenalty('iCloudOn', 5);
  if (info.knox && info.knox.status === 'active') score -= getPenalty('knoxActive', 5);
  if (info.mdm && info.mdm.status === 'locked') score -= getPenalty('mdmLocked', 4);
  
  if (info.networkLock) {
    if (info.networkLock.status === 'locked') {
      score -= getPenalty('networkLocked', 4);
    } else if (info.networkLock.status === 'locked_orange') {
      score -= getPenalty('networkLockedOrange', 1);
    }
  }
  
  return Math.max(0, Math.min(baseScore, score));
}

function getRiskDetails(riskScore, lang = DEFAULT_LANGUAGE) {
  const normalizedLang = normalizeLang(lang);
  const baseScore = riskWeights.baseScore || 10;
  const ratio = baseScore > 0 ? (riskScore / baseScore) : 0;
  let level = 'safe';
  if (ratio <= 0.2) {
    level = 'danger';
  } else if (ratio <= 0.4) {
    level = 'high';
  } else if (ratio <= 0.6) {
    level = 'moderate';
  }

  const details = {
    danger: {
      scoreColor: '#ef4444',
      texts: createTexts('Dispozitiv PERICULOS', 'Dangerous device'),
      summaryTexts: createTexts(
        'Dispozitivul are probleme critice — NU CUMPĂRA.',
        'The device has critical issues — DO NOT BUY.'
      )
    },
    high: {
      scoreColor: '#f97316',
      texts: createTexts('Dispozitiv cu RISC RIDICAT', 'High-risk device'),
      summaryTexts: createTexts(
        'Dispozitivul are probleme importante — amână achiziția.',
        'The device has significant issues — postpone the purchase.'
      )
    },
    moderate: {
      scoreColor: '#f59e0b',
      texts: createTexts('Dispozitiv cu RISC MODERAT', 'Moderate-risk device'),
      summaryTexts: createTexts(
        'Dispozitivul are probleme minore — verifică înainte de cumpărare.',
        'The device has minor issues — double-check before buying.'
      )
    },
    safe: {
      scoreColor: '#22c55e',
      texts: createTexts('Telefon sigur', 'Device is safe'),
      summaryTexts: createTexts(
        'Dispozitivul este în regulă pentru achiziție.',
        'The device is safe to buy.'
      )
    }
  };

  const detail = details[level];
  return {
    level,
    scoreColor: detail.scoreColor,
    riskText: textFor(normalizedLang, detail.texts),
    riskTexts: detail.texts,
    summaryText: textFor(normalizedLang, detail.summaryTexts),
    summaryTexts: detail.summaryTexts
  };
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
  calculateRiskScore,
  getRiskDetails,
  DEFAULT_LANGUAGE,
  normalizeLang
};

