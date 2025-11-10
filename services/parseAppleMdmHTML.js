const HTML_ENTITY_MAP = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': '\'',
  '&lt;': '<',
  '&gt;': '>'
};

function decodeHtml(value = '') {
  return Object.entries(HTML_ENTITY_MAP).reduce(
    (acc, [entity, replacement]) => acc.replace(new RegExp(entity, 'g'), replacement),
    value
  ).trim();
}

function extractValue(html, label) {
  if (!html) return null;
  const pattern = new RegExp(`${label}\\s*:\\s*(?:<[^>]*>)*([^<\\n]+)`, 'i');
  const match = pattern.exec(html);
  return match ? decodeHtml(match[1]) : null;
}

function normalizeToggle(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (['on', 'yes', 'active', 'enabled', 'locked'].includes(normalized)) {
    return 'on';
  }
  if (['off', 'no', 'inactive', 'disabled', 'unlocked', 'clean'].includes(normalized)) {
    return 'off';
  }
  return normalized;
}

function parseAppleMdmHTML(html) {
  if (!html || typeof html !== 'string') {
    return {
      rawHtml: html || '',
      fields: {},
      mdmLock: { raw: null, normalized: null, isLocked: null }
    };
  }

  const fields = {
    activationStatus: extractValue(html, 'Activation Status'),
    warrantyStatus: extractValue(html, 'Warranty Status'),
    estPurchaseDate: extractValue(html, 'Estimated Purchase Date'),
    coverageEndDate: extractValue(html, 'Coverage End Date'),
    telephoneSupport: extractValue(html, 'Telephone Technical Support'),
    repairCoverage: extractValue(html, 'Repairs and Service Coverage'),
    appleCareEligible: extractValue(html, 'AppleCare Eligible'),
    validPurchaseDate: extractValue(html, 'Valid Purchase Date'),
    registeredDevice: extractValue(html, 'Registered Device'),
    replacedByApple: extractValue(html, 'Replaced by Apple'),
    replacementDevice: extractValue(html, 'Replacement Device'),
    refurbished: extractValue(html, 'Refurbished'),
    demoUnit: extractValue(html, 'Demo Unit'),
    loanerDevice: extractValue(html, 'Loaner Device'),
    findMyIphone: extractValue(html, 'Find My iPhone'),
    icloudStatus: extractValue(html, 'iCloud Status'),
    usBlockStatus: extractValue(html, 'US Block Status'),
    carrier: extractValue(html, 'Carrier'),
    nextTetherPolicy: extractValue(html, 'Next Tether Policy'),
    simLock: extractValue(html, 'Sim-Lock'),
    mdmLock: extractValue(html, 'MDM Lock'),
    blacklistStatus: extractValue(html, 'Blacklist Status'),
    generalListStatus: extractValue(html, 'General List Status'),
    blacklistRecords: extractValue(html, 'Blacklist Records')
  };

  const mdmNormalized = normalizeToggle(fields.mdmLock);
  const mdmLock = {
    raw: fields.mdmLock,
    normalized: mdmNormalized,
    isLocked: mdmNormalized === 'on'
  };

  const boolFields = [
    'telephoneSupport',
    'repairCoverage',
    'appleCareEligible',
    'validPurchaseDate',
    'registeredDevice',
    'replacedByApple',
    'replacementDevice',
    'refurbished',
    'demoUnit',
    'loanerDevice',
    'findMyIphone'
  ];

  boolFields.forEach((key) => {
    const normalized = normalizeToggle(fields[key]);
    fields[key] = {
      raw: fields[key],
      normalized,
      isPositive: normalized === 'on',
      isNegative: normalized === 'off'
    };
  });

  fields.simLock = {
    raw: fields.simLock,
    normalized: normalizeToggle(fields.simLock)
  };

  fields.blacklistStatus = {
    raw: fields.blacklistStatus,
    normalized: normalizeToggle(fields.blacklistStatus)
  };

  return {
    rawHtml: html,
    fields,
    mdmLock
  };
}

module.exports = {
  parseAppleMdmHTML
};

