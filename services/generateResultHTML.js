const ejs = require('ejs');
const path = require('path');
const { getTranslation } = require('../config/translations');
const riskWeights = require('../config/riskWeights');
const {
  formatWarrantyInfo,
  formatDate: formatDateHelper,
  formatiCloudStatus,
  formatBlacklistStatus,
  formatKnoxStatus,
  formatMDMStatus,
  formatLostModeStatus,
  formatNetworkLockStatus,
  formatOriginInfo,
  formatMiLockStatus,
  calculateRiskScore,
  getRiskDetails,
  DEFAULT_LANGUAGE,
  normalizeLang
} = require('./emailFormatter');
const APPLE_MDM_FIELD_KEYS = [
  'activationStatus',
  'warrantyStatus',
  'estPurchaseDate',
  'coverageEndDate',
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
  'findMyIphone',
  'icloudStatus',
  'usBlockStatus',
  'carrier',
  'nextTetherPolicy',
  'simLock',
  'mdmLock',
  'blacklistStatus',
  'generalListStatus',
  'blacklistRecords'
];

function translateWithReplacements(lang, key, replacements = {}) {
  let value = getTranslation(lang, key);
  if (typeof value !== 'string') {
    return value;
  }

  if (replacements && typeof replacements === 'object') {
    for (const [placeholder, replacement] of Object.entries(replacements)) {
      const regex = new RegExp(`\{${placeholder}\}`, 'g');
      value = value.replace(regex, replacement);
    }
  }

  return value;
}

function toPlainObject(doc) {
  if (!doc) {
    return {};
  }
  if (typeof doc.toObject === 'function') {
    return doc.toObject();
  }
  return doc;
}

function getDeviceInfo(templateName, data) {
  const order = data.order || {};
  const orderObj = toPlainObject(order);
  const reportData = orderObj.object || {};
  const brand = (data.brand || orderObj.brand || '').toLowerCase();

  const device = {
    brand: brand || 'necunoscut',
    model: reportData.model || orderObj.model || '',
    modelDesc: reportData.modelDesc || '',
    imei: orderObj.imei || reportData.imei || '',
    imei2: reportData.imei2 || '',
    serial: reportData.serial || '',
    eid: reportData.eid || '',
    color: reportData.color || ''
  };

  if (templateName === 'verify/result-samsung') {
    const samsungData = data.samsungParsedData || {};
    device.model = samsungData.marketingName || samsungData.modelDesc || samsungData.model || device.model;
    device.modelDesc = samsungData.fullName || samsungData.modelDesc || device.modelDesc;
    device.imei = samsungData.imei || device.imei;
    device.imei2 = samsungData.imei2 || device.imei2;
    device.serial = samsungData.serial || device.serial;
  } else if (templateName === 'verify/result-honor') {
    const honorData = data.honorParsedData || {};
    device.model = honorData.marketingName || honorData.skuName || device.model;
    device.modelDesc = honorData.modelNumber || honorData.externalModel || device.modelDesc;
    device.serial = honorData.serial || device.serial;
  } else if (templateName === 'verify/result-motorola') {
    const motorolaData = data.motorolaParsedData || {};
    device.model = motorolaData.marketingName || motorolaData.modelName || device.model;
    device.modelDesc = motorolaData.modelNumber || device.modelDesc;
    device.serial = motorolaData.serialNumber || device.serial;
  } else if (templateName === 'verify/result-xiaomi') {
    const xiaomiData = data.xiaomiParsedData || {};
    device.model = xiaomiData.model || device.model;
    device.modelDesc = xiaomiData.modelDesc || xiaomiData.marketingName || device.modelDesc;
    device.serial = xiaomiData.serial || device.serial;
  } else if (templateName === 'verify/result-pixel') {
    const pixelData = data.pixelParsedData || {};
    device.model = pixelData.model || device.model;
    device.modelDesc = pixelData.marketingName || pixelData.modelNumber || device.modelDesc;
  } else if (templateName === 'verify/result-huawei') {
    const huaweiData = data.huaweiParsedData || {};
    device.model = huaweiData.modelName || huaweiData.model || device.model;
    device.modelDesc = huaweiData.modelDesc || device.modelDesc;
    device.serial = huaweiData.serialNumber || device.serial;
  }

  if (!device.model) {
    device.model = 'Dispozitiv necunoscut';
  }

  return device;
}

function addCriticalInfo(criticalInfo, label, info, options = {}) {
  if (!info) {
    return;
  }

  const value = info.text || info.value || info.statusText || '';
  if (!value) {
    return;
  }

  criticalInfo.push({
    label,
    value,
    status: info.status || options.defaultStatus || 'unknown',
    color: info.color || options.color || null,
    warning: typeof info.warning === 'boolean' ? info.warning : options.warning || false
  });
}

function buildAlerts(data, translate) {
  const t = typeof translate === 'function' ? translate : (key) => key;
  const alerts = [];

  const localized = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  if (data.iCloud && data.iCloud.status === 'on') {
    alerts.push({
      title: localized('verify.result.alerts.icloud.title', 'iCloud (Find My iPhone) este activ'),
      text: localized('verify.result.alerts.icloud.message', 'Dispozitivul este legat de un cont iCloud. Nu achiziționa fără a-l dezactiva în fața ta.')
    });
  }

  if (data.lostMode && data.lostMode.status === 'active') {
    alerts.push({
      title: localized('verify.result.alerts.lostMode.title', 'Dispozitiv în mod pierdut'),
      text: localized('verify.result.alerts.lostMode.message', 'Dispozitivul este raportat ca pierdut/furat. Nu recomandăm achiziția.')
    });
  }

  if (data.blacklist && data.blacklist.status === 'blacklisted') {
    alerts.push({
      title: localized('verify.result.alerts.blacklist.title', 'Dispozitiv blocat/furat'),
      text: localized('verify.result.alerts.blacklist.message', 'IMEI-ul apare în bazele de date blacklist. Evită achiziția.')
    });
  }

  if (data.mdm && data.mdm.status === 'locked') {
    alerts.push({
      title: localized('verify.result.alerts.mdm.title', 'MDM Lock activ'),
      text: localized('verify.result.alerts.mdm.message', 'Dispozitivul este gestionat de o companie (Mobile Device Management). Poate fi re-blocat ulterior.')
    });
  }

  const miAccountData = data.miAccountInfo || data.miAccount;
  if (miAccountData && (miAccountData.warning || miAccountData.status === 'on')) {
    alerts.push({
      title: localized('verify.result.alerts.miLock.title', 'MI Activation Lock este activ'),
      text: localized('verify.result.alerts.miLock.message', 'Dispozitivul este legat de un cont Mi Account. Nu achiziționa fără dezactivare.')
    });
  }

  if (data.networkLock && data.networkLock.status === 'locked') {
    alerts.push({
      title: localized('verify.result.alerts.network.title', 'Blocare de rețea'),
      text: data.networkLock.text || localized('verify.result.alerts.network.message', 'Dispozitivul este blocat pe o anumită rețea.')
    });
  }

  return alerts;
}

function mapAdditionalResults(additionalResults) {
  if (!Array.isArray(additionalResults)) {
    return [];
  }

  return additionalResults.map((item) => {
    const title = (item.service && (item.service.displayName || item.service.name)) || 'Verificare suplimentară';
    const description = (item.service && item.service.description) || '';

    let content = '';
    let isHTML = false;

    if (item.sanitizedHtml) {
      content = item.sanitizedHtml;
      isHTML = true;
    } else if (item.parsedData) {
      content = `<pre style="margin:0; white-space:pre-wrap;">${JSON.stringify(item.parsedData, null, 2)}</pre>`;
      isHTML = true;
    } else if (item.rawResult) {
      content = `<pre style="margin:0; white-space:pre-wrap;">${item.rawResult}</pre>`;
      isHTML = true;
    }

    return {
      title,
      description,
      content,
      isHTML
    };
  });
}

function buildEmailData(templateName, templateData, translate) {
  const order = templateData.order || {};
  const device = getDeviceInfo(templateName, templateData);
  const criticalInfo = [];
  const t = typeof translate === 'function'
    ? translate
    : (templateData && typeof templateData.t === 'function' ? templateData.t : (key) => key);

  const label = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : (fallback || key);
  };

  if (templateData.miAccount) {
    addCriticalInfo(criticalInfo, label('verify.result.labels.miAccount', 'Mi Account (Mi Activation Lock)'), templateData.miAccount);
    if (templateData.iCloud && templateData.iCloud !== templateData.miAccount) {
      addCriticalInfo(criticalInfo, label('verify.result.labels.icloud', 'iCloud (Find My iPhone)'), templateData.iCloud);
    }
  } else {
    addCriticalInfo(criticalInfo, label('verify.result.labels.icloud', 'iCloud (Find My iPhone)'), templateData.iCloud);
  }
  addCriticalInfo(criticalInfo, label('verify.result.labels.blacklist', 'Status blacklist'), templateData.blacklist);
  addCriticalInfo(criticalInfo, label('verify.result.labels.knox', 'Knox Guard'), templateData.knox);
  addCriticalInfo(criticalInfo, label('verify.result.labels.mdm', 'MDM Lock'), templateData.mdm);
  addCriticalInfo(criticalInfo, label('verify.result.labels.lostMode', 'Mod pierdut'), templateData.lostMode);
  addCriticalInfo(criticalInfo, label('verify.result.labels.networkLock', 'Blocare rețea'), templateData.networkLock);
  addCriticalInfo(criticalInfo, label('verify.result.labels.warranty', 'Garanție'), templateData.warranty);

  if (templateData.origin && templateData.origin.text) {
    addCriticalInfo(criticalInfo, label('verify.result.labels.origin', 'Proveniență'), {
      text: templateData.origin.text,
      status: templateData.origin.hasInfo ? 'info' : 'unknown'
    });
  }

  const formatDateFn = typeof templateData.formatDate === 'function'
    ? templateData.formatDate
    : formatDateHelper || ((date) => date || 'Data necunoscută');

  const generatedAtSource = order.completedAt || order.updatedAt || order.createdAt || new Date();
  const generatedAt = formatDateFn(generatedAtSource);

  return {
    title: templateData.title || t('verify.result.pageTitle'),
    brand: device.brand,
    device,
    riskScore: templateData.riskScore || 0,
    riskText: templateData.riskText || 'Status necunoscut',
    riskScoreMax: templateData.riskScoreMax || riskWeights.baseScore || 10,
    scoreColor: templateData.scoreColor || '#22c55e',
    summaryText: templateData.summaryText || '',
    criticalInfo,
    alerts: buildAlerts(templateData, t),
    additionalResults: mapAdditionalResults(templateData.additionalResults),
    order: {
      id: order._id ? order._id.toString() : '',
      imei: device.imei,
      createdAt: generatedAt
    },
    t,
    currentLang: templateData.currentLang,
    currentLangLabel: templateData.currentLangLabel,
    switchLang: templateData.switchLang,
    switchLangLabel: templateData.switchLangLabel
  };
}

/**
 * Generate the complete HTML for a verification result
 * Uses the same logic as routes/verify.js to prepare data and render template
 */
async function generateResultHTML(order, options = {}) {
  const viewsPath = path.join(__dirname, '../views');
  const includeLayout = options.includeLayout !== undefined ? options.includeLayout : true;
  const lang = normalizeLang(options.lang || (order && order.language) || DEFAULT_LANGUAGE);
  const translate = (key, replacements) => translateWithReplacements(lang, key, replacements);
  const switchLang = lang === 'ro' ? 'en' : 'ro';
  const currentLangLabel = translateWithReplacements(lang, 'nav.language.current');
  const switchLangLabel = translateWithReplacements(switchLang, 'nav.language.current');
  
  // Use the same logic as routes/verify.js
  const brand = (order.brand || '').toLowerCase().trim();
  
  // Check brand-specific markers
  const isSamsung = brand === 'samsung' || (!order.object && order.result && order.result.includes('Knox Registered'));
  const isHonor = brand === 'honor' || (!order.object && order.result && (
    order.result.includes('HONOR') || 
    order.result.includes('Marketing Name:') ||
    order.result.includes('SKU Name:')
  ));
  const isMotorola = brand === 'motorola' || (order.result && (
    order.result.includes('MOTOROLA') ||
    order.result.includes('Moto') ||
    order.result.includes('Motorola')
  ));
  const isXiaomi = brand === 'xiaomi' || (order.result && (
    order.result.includes('Xiaomi') ||
    order.result.includes('MI ') ||
    order.result.includes('Redmi') ||
    order.result.includes('POCO') ||
    order.result.includes('MI Lock')
  ));
  const isPixel = brand === 'google' || brand === 'pixel' || (order.result && (
    order.result.includes('Pixel') ||
    order.result.includes('Google Pixel')
  ));
  const isHuawei = brand === 'huawei' || (order.result && (
    order.result.includes('Huawei') ||
    order.result.includes('SKU Name:') ||
    order.result.includes('nova') ||
    order.result.includes('HUAWEI')
  ));
  
  // Parse additional service results
  const { parseAdditionalResults } = require('./parseAdditionalResults');
  const parsedResults = parseAdditionalResults(order);
  
  // Update order.result to only contain main result
  const mainOrder = { ...order.toObject() };
  mainOrder.result = parsedResults.mainResult;
  
  // Determine which template to use and prepare data
  let templateName = 'verify/result';
  let templateData = {
    title: translate('verify.result.pageTitle'),
    order: mainOrder,
    user: null, // No user in email context
    brand: brand, // Add brand to template data
    additionalResults: parsedResults.additionalResults,
    formatDate: (date) => formatDateHelper ? formatDateHelper(date, lang) : date || 'Data necunoscută',
    currentLang: lang,
    t: translate,
    currentLangLabel,
    switchLang,
    switchLangLabel
  };
  
  // Prepare data based on brand (same logic as routes/verify.js)
  if (isSamsung) {
    templateName = 'verify/result-samsung';
    
    // Parse Samsung data
    const { parseSamsung21, mergeSamsungData } = require('./parseSamsung21');
    const { parseSamsungHTML } = require('./parseSamsungHTML');
    
    let samsungParsedData = null;
    if (mainOrder.object && mainOrder.object._parsedData) {
      samsungParsedData = mainOrder.object._parsedData;
    } else {
      samsungParsedData = parseSamsung21(mainOrder.result || '');
      if (!samsungParsedData.marketingName || !samsungParsedData.warrantyStatus) {
        const data37 = parseSamsungHTML(mainOrder.result || '');
        samsungParsedData = mergeSamsungData(samsungParsedData, data37);
      }
    }
    
    // Extract MDM status
    let mdmStatus = null;
    let mdmLocked = null;
    if (parsedResults.additionalResults && parsedResults.additionalResults.length > 0) {
      for (const result of parsedResults.additionalResults) {
        if (result.parsedData) {
          if (result.parsedData.mdmStatus !== undefined) {
            mdmStatus = result.parsedData.mdmStatus;
          }
          if (result.parsedData.mdmLocked !== undefined) {
            mdmLocked = result.parsedData.mdmLocked;
          }
        }
      }
    }
    if (mainOrder.object && mainOrder.object.mdmStatus !== undefined) {
      mdmStatus = mainOrder.object.mdmStatus;
    }
    if (mainOrder.object && mainOrder.object.mdmLocked !== undefined) {
      mdmLocked = mainOrder.object.mdmLocked;
    }
    
    // Format critical information
    const reportData = mainOrder.object || samsungParsedData;
    const iCloud = null;
    const blacklist = formatBlacklistStatus(
      reportData.gsmaBlacklisted, 
      reportData.blacklistStatus,
      reportData.blacklistRecords,
      reportData.blacklistData,
      lang
    );
    
    let knoxValue = null;
    if (samsungParsedData && samsungParsedData.knoxGuard !== undefined) {
      knoxValue = samsungParsedData.knoxGuard;
    } else if (samsungParsedData && samsungParsedData.knoxRegistered !== undefined) {
      knoxValue = samsungParsedData.knoxRegistered;
    } else if (reportData && reportData.knoxRegistered !== undefined) {
      knoxValue = reportData.knoxRegistered;
    }
    const knox = knoxValue !== null ? formatKnoxStatus(knoxValue, lang) : formatKnoxStatus(null, lang);
    
    const warranty = formatWarrantyInfo(
      samsungParsedData.purchaseDate || samsungParsedData.productionDate || reportData.estPurchaseDate, 
      null, 
      'samsung',
      lang
    );
    
    let mdm = null;
    if (mdmStatus !== null || mdmLocked !== null) {
      mdm = formatMDMStatus(mdmStatus, mdmLocked, lang);
    }
    
    const lostMode = null;
    const carrierText = samsungParsedData.carrier || reportData.carrier || '';
    const isUnlocked = carrierText.toLowerCase() === 'open' || carrierText.toLowerCase().includes('unlock');
    const networkLock = formatNetworkLockStatus(!isUnlocked, carrierText, lang);
    const origin = formatOriginInfo(
      samsungParsedData.soldByCountry || samsungParsedData.shipToCountry || reportData.country, 
      samsungParsedData.salesBuyerName || reportData.soldBy, 
      samsungParsedData.soldByCountry || reportData.soldByCountry,
      lang
    );
    
    // Calculate risk score
    const criticalInfo = { iCloud, blacklist, knox, mdm, lostMode, networkLock };
    const riskScore = calculateRiskScore(criticalInfo);
    
    const riskDetails = getRiskDetails(riskScore, lang);
    
      templateData = {
        ...templateData,
        brand: brand, // Ensure brand is included
        samsungParsedData: samsungParsedData,
        iCloud: iCloud || null,
        blacklist: blacklist || formatBlacklistStatus(undefined, undefined, null, null, lang),
        knox: knox || formatKnoxStatus(null, lang),
        mdm: mdm || formatMDMStatus(null, null, lang),
        lostMode: lostMode || null,
        networkLock: networkLock || formatNetworkLockStatus(null, null, lang),
        warranty: warranty || formatWarrantyInfo(null, null, brand, lang),
        origin: origin || formatOriginInfo(null, null, null, lang),
        riskScore: riskScore || 9,
        riskText: riskDetails.riskText,
        riskTexts: riskDetails.riskTexts,
        scoreColor: riskDetails.scoreColor,
        summaryText: riskDetails.summaryText,
        summaryTexts: riskDetails.summaryTexts
      };
  } else if (isHonor) {
    templateName = 'verify/result-honor';
    const { parseHonorHTML } = require('./parseHonorHTML');
    const honorParsedData = parseHonorHTML(mainOrder.result || '');
    
    // Format critical information for Honor
    const reportData = mainOrder.object || {};
    const iCloud = null; // Not applicable for Honor
    const blacklist = formatBlacklistStatus(
      reportData.gsmaBlacklisted, 
      reportData.blacklistStatus,
      reportData.blacklistRecords,
      reportData.blacklistData,
      lang
    );
    const knox = null; // Not applicable for Honor
    
    // Extract MDM status
    let mdmStatus = null;
    let mdmLocked = null;
    if (parsedResults.additionalResults && parsedResults.additionalResults.length > 0) {
      for (const result of parsedResults.additionalResults) {
        if (result.parsedData) {
          if (result.parsedData.mdmStatus !== undefined) {
            mdmStatus = result.parsedData.mdmStatus;
          }
          if (result.parsedData.mdmLocked !== undefined) {
            mdmLocked = result.parsedData.mdmLocked;
          }
        }
      }
    }
    if (mainOrder.object && mainOrder.object.mdmStatus !== undefined) {
      mdmStatus = mainOrder.object.mdmStatus;
    }
    if (mainOrder.object && mainOrder.object.mdmLocked !== undefined) {
      mdmLocked = mainOrder.object.mdmLocked;
    }
    
    let mdm = null;
    if (mdmStatus !== null || mdmLocked !== null) {
      mdm = formatMDMStatus(mdmStatus, mdmLocked, lang);
    }
    
    const lostMode = null; // Not applicable for Honor
    const networkLock = formatNetworkLockStatus(false, '', lang); // Default to unlocked for Honor
    const warranty = formatWarrantyInfo(
      honorParsedData.warrantyStartDate || honorParsedData.bindDate, 
      null, 
      'honor',
      lang
    );
    const origin = formatOriginInfo(
      honorParsedData.countryName || '', 
      honorParsedData.companyName || '', 
      honorParsedData.countryName || '',
      lang
    );
    
    // Calculate risk score
    const criticalInfo = { iCloud, blacklist, knox, mdm, lostMode, networkLock };
    const riskScore = calculateRiskScore(criticalInfo);
    
    const riskDetails = getRiskDetails(riskScore, lang);
    
    templateData = {
      ...templateData,
      brand: brand, // Ensure brand is included
      honorParsedData: honorParsedData,
        iCloud: iCloud || null,
        blacklist: blacklist || formatBlacklistStatus(undefined, undefined, null, null, lang),
        knox: knox || null,
        mdm: mdm || formatMDMStatus(null, null, lang),
        lostMode: lostMode || null,
        networkLock: networkLock || formatNetworkLockStatus(null, null, lang),
        warranty: warranty || formatWarrantyInfo(null, null, brand, lang),
        origin: origin || formatOriginInfo(null, null, null, lang),
      riskScore: riskScore || 9,
        riskText: riskDetails.riskText,
        riskTexts: riskDetails.riskTexts,
        scoreColor: riskDetails.scoreColor,
        summaryText: riskDetails.summaryText,
        summaryTexts: riskDetails.summaryTexts
    };
  } else if (isMotorola) {
    templateName = 'verify/result-motorola';
    const { parseMotorolaHTML } = require('./parseMotorolaHTML');
    const motorolaParsedData = parseMotorolaHTML(mainOrder.result || '');
    
    // Format critical information for Motorola
    const reportData = mainOrder.object || {};
    const iCloud = null; // Not applicable for Motorola
    const blacklist = formatBlacklistStatus(
      reportData.gsmaBlacklisted, 
      reportData.blacklistStatus,
      reportData.blacklistRecords,
      reportData.blacklistData,
      lang
    );
    const knox = null; // Not applicable for Motorola
    
    // Extract MDM status
    let mdmStatus = null;
    let mdmLocked = null;
    if (parsedResults.additionalResults && parsedResults.additionalResults.length > 0) {
      for (const result of parsedResults.additionalResults) {
        if (result.parsedData) {
          if (result.parsedData.mdmStatus !== undefined) {
            mdmStatus = result.parsedData.mdmStatus;
          }
          if (result.parsedData.mdmLocked !== undefined) {
            mdmLocked = result.parsedData.mdmLocked;
          }
        }
      }
    }
    if (mainOrder.object && mainOrder.object.mdmStatus !== undefined) {
      mdmStatus = mainOrder.object.mdmStatus;
    }
    if (mainOrder.object && mainOrder.object.mdmLocked !== undefined) {
      mdmLocked = mainOrder.object.mdmLocked;
    }
    
    let mdm = null;
    if (mdmStatus !== null || mdmLocked !== null) {
      mdm = formatMDMStatus(mdmStatus, mdmLocked, lang);
    }
    
    const lostMode = null; // Not applicable for Motorola
    const carrierText = motorolaParsedData.carrier || '';
    const isUnlocked = carrierText.toLowerCase().includes('world comm') || carrierText.toLowerCase().includes('unlock');
    const networkLock = formatNetworkLockStatus(!isUnlocked, carrierText, lang);
    const warranty = formatWarrantyInfo(
      motorolaParsedData.warrantyStartDate || motorolaParsedData.activationDate, 
      motorolaParsedData.activationDate, 
      'motorola',
      lang
    );
    const origin = formatOriginInfo(
      motorolaParsedData.shipToCountry || motorolaParsedData.soldByCountry || motorolaParsedData.country, 
      motorolaParsedData.soldToCustomerName || '', 
      motorolaParsedData.soldByCountry || '',
      lang
    );
    
    // Calculate risk score
    const criticalInfo = { iCloud, blacklist, knox, mdm, lostMode, networkLock };
    const riskScore = calculateRiskScore(criticalInfo);
    
    const riskDetails = getRiskDetails(riskScore, lang);
    
    templateData = {
      ...templateData,
      brand: brand, // Ensure brand is included
      motorolaParsedData: motorolaParsedData,
      iCloud: iCloud || null,
      blacklist: blacklist || formatBlacklistStatus(undefined, undefined, null, null, lang),
      knox: knox || null,
      mdm: mdm || formatMDMStatus(null, null, lang),
      lostMode: lostMode || null,
      networkLock: networkLock || formatNetworkLockStatus(null, null, lang),
      warranty: warranty || formatWarrantyInfo(null, null, brand, lang),
      origin: origin || formatOriginInfo(null, null, null, lang),
      riskScore: riskScore || 9,
      riskText: riskDetails.riskText,
      riskTexts: riskDetails.riskTexts,
      scoreColor: riskDetails.scoreColor,
      summaryText: riskDetails.summaryText,
      summaryTexts: riskDetails.summaryTexts
    };
  } else if (isXiaomi) {
    templateName = 'verify/result-xiaomi';
    const { parseXiaomiHTML } = require('./parseXiaomiHTML');
    const xiaomiParsedData = parseXiaomiHTML(mainOrder.result || '', mainOrder.object || {});

    const reportData = mainOrder.object || {};
    const miLockRaw = reportData.miActivationLock || reportData.miLockStatus || xiaomiParsedData.miLockStatus || null;
    const miAccount = formatMiLockStatus(miLockRaw, lang);
    const blacklist = formatBlacklistStatus(
      reportData.gsmaBlacklisted,
      reportData.blacklistStatus,
      reportData.blacklistRecords,
      reportData.blacklistData,
      lang
    );
    const warranty = formatWarrantyInfo(
      xiaomiParsedData.warrantyStartDate || reportData.warrantyStartDate,
      xiaomiParsedData.activationDate || reportData.activationDate,
      'xiaomi',
      lang
    );
    const origin = formatOriginInfo(
      xiaomiParsedData.purchaseCountry || reportData.purchaseCountry,
      null,
      xiaomiParsedData.activationCountry || reportData.activationCountry,
      lang
    );
    const networkLock = formatNetworkLockStatus(
      reportData.simlock || reportData.lockStatus || null,
      reportData.carrier || '',
      lang
    );

    const criticalInfo = {
      iCloud: miAccount,
      blacklist,
      knox: null,
      mdm: null,
      lostMode: null,
      networkLock
    };
    const riskScore = calculateRiskScore(criticalInfo);

    const riskDetails = getRiskDetails(riskScore, lang);

    templateData = {
      ...templateData,
      brand: brand,
      xiaomiParsedData,
      miAccount,
      iCloud: miAccount, // for compatibility with calculateRiskScore consumers
      blacklist: blacklist || formatBlacklistStatus(undefined, undefined, null, null, lang),
      mdm: null,
      knox: null,
      lostMode: null,
      networkLock: networkLock || formatNetworkLockStatus(null, null, lang),
      warranty: warranty || formatWarrantyInfo(null, null, brand, lang),
      origin: origin || formatOriginInfo(null, null, null, lang),
      riskScore: riskScore || 9,
      riskText: riskDetails.riskText,
      riskTexts: riskDetails.riskTexts,
      scoreColor: riskDetails.scoreColor,
      summaryText: riskDetails.summaryText,
      summaryTexts: riskDetails.summaryTexts
    };
  } else if (isPixel) {
    templateName = 'verify/result-pixel';
    const { parsePixelHTML } = require('./parsePixelHTML');
    const pixelParsedData = parsePixelHTML(mainOrder.result || '');
    
    // Format critical information for Pixel
    const reportData = mainOrder.object || {};
    const iCloud = null; // Not applicable for Pixel
    const blacklist = formatBlacklistStatus(
      reportData.gsmaBlacklisted, 
      reportData.blacklistStatus,
      reportData.blacklistRecords,
      reportData.blacklistData,
      lang
    );
    const knox = null; // Not applicable for Pixel
    
    // Extract MDM status
    let mdmStatus = null;
    let mdmLocked = null;
    if (parsedResults.additionalResults && parsedResults.additionalResults.length > 0) {
      for (const result of parsedResults.additionalResults) {
        if (result.parsedData) {
          if (result.parsedData.mdmStatus !== undefined) {
            mdmStatus = result.parsedData.mdmStatus;
          }
          if (result.parsedData.mdmLocked !== undefined) {
            mdmLocked = result.parsedData.mdmLocked;
          }
        }
      }
    }
    if (mainOrder.object && mainOrder.object.mdmStatus !== undefined) {
      mdmStatus = mainOrder.object.mdmStatus;
    }
    if (mainOrder.object && mainOrder.object.mdmLocked !== undefined) {
      mdmLocked = mainOrder.object.mdmLocked;
    }
    
    let mdm = null;
    if (mdmStatus !== null || mdmLocked !== null) {
      mdm = formatMDMStatus(mdmStatus, mdmLocked, lang);
    }
    
    const lostMode = null; // Not applicable for Pixel
    const modelText = pixelParsedData.model || '';
    const isUnlocked = modelText.toLowerCase().includes('(unlocked)') || modelText.toLowerCase().includes('unlocked');
    const networkLock = formatNetworkLockStatus(!isUnlocked, isUnlocked ? 'Unlocked' : '', lang);
    // For Pixel, warranty is typically 2 years from activation
    // If warranty expired, calculate start date by subtracting 2 years from end date
    let warrantyStartDate = null;
    if (pixelParsedData.warrantyEndDateFormatted) {
      try {
        const endDate = new Date(pixelParsedData.warrantyEndDateFormatted);
        if (!isNaN(endDate.getTime())) {
          const startDate = new Date(endDate);
          startDate.setFullYear(startDate.getFullYear() - 2);
          warrantyStartDate = startDate.toISOString().split('T')[0];
        }
      } catch (e) {
        console.warn('Could not parse warranty end date for Pixel:', e);
      }
    } else if (pixelParsedData.warrantyEndDate) {
      const dateParts = pixelParsedData.warrantyEndDate.split(/[.\/]/);
      if (dateParts.length === 3) {
        const day = dateParts[0].padStart(2, '0');
        const month = dateParts[1].padStart(2, '0');
        const year = dateParts[2].length === 2 ? '20' + dateParts[2] : dateParts[2];
        try {
          const endDate = new Date(`${year}-${month}-${day}`);
          if (!isNaN(endDate.getTime())) {
            const startDate = new Date(endDate);
            startDate.setFullYear(startDate.getFullYear() - 2);
            warrantyStartDate = startDate.toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn('Could not parse warranty end date for Pixel:', e);
        }
      }
    }
    const warranty = formatWarrantyInfo(
      warrantyStartDate, 
      pixelParsedData.activationStatus === 'Activated' ? warrantyStartDate : null, 
      'pixel',
      lang
    );
    const origin = formatOriginInfo(null, null, null, lang);
    
    // Calculate risk score
    const criticalInfo = { iCloud, blacklist, knox, mdm, lostMode, networkLock };
    const riskScore = calculateRiskScore(criticalInfo);
    
    const riskDetails = getRiskDetails(riskScore, lang);
    
    templateData = {
      ...templateData,
      brand: brand, // Ensure brand is included
      pixelParsedData: pixelParsedData,
      iCloud: iCloud || null,
      blacklist: blacklist || formatBlacklistStatus(undefined, undefined, null, null, lang),
      knox: knox || null,
      mdm: mdm || formatMDMStatus(null, null, lang),
      lostMode: lostMode || null,
      networkLock: networkLock || formatNetworkLockStatus(null, null, lang),
      warranty: warranty || formatWarrantyInfo(null, null, brand, lang),
      origin: origin || formatOriginInfo(null, null, null, lang),
      riskScore: riskScore || 9,
      riskText: riskDetails.riskText,
      riskTexts: riskDetails.riskTexts,
      scoreColor: riskDetails.scoreColor,
      summaryText: riskDetails.summaryText,
      summaryTexts: riskDetails.summaryTexts
    };
  } else if (isHuawei) {
    templateName = 'verify/result-huawei';
    const { parseHuaweiHTML } = require('./parseHuaweiHTML');
    const huaweiParsedData = parseHuaweiHTML(mainOrder.result || '');
    
    // Format critical information for Huawei
    const reportData = mainOrder.object || {};
    const iCloud = null; // Not applicable for Huawei
    const blacklist = formatBlacklistStatus(
      reportData.gsmaBlacklisted, 
      reportData.blacklistStatus,
      reportData.blacklistRecords,
      reportData.blacklistData,
      lang
    );
    const knox = null; // Not applicable for Huawei
    
    // Extract MDM status
    let mdmStatus = null;
    let mdmLocked = null;
    if (parsedResults.additionalResults && parsedResults.additionalResults.length > 0) {
      for (const result of parsedResults.additionalResults) {
        if (result.parsedData) {
          if (result.parsedData.mdmStatus !== undefined) {
            mdmStatus = result.parsedData.mdmStatus;
          }
          if (result.parsedData.mdmLocked !== undefined) {
            mdmLocked = result.parsedData.mdmLocked;
          }
        }
      }
    }
    if (mainOrder.object && mainOrder.object.mdmStatus !== undefined) {
      mdmStatus = mainOrder.object.mdmStatus;
    }
    if (mainOrder.object && mainOrder.object.mdmLocked !== undefined) {
      mdmLocked = mainOrder.object.mdmLocked;
    }
    
    let mdm = null;
    if (mdmStatus !== null || mdmLocked !== null) {
      mdm = formatMDMStatus(mdmStatus, mdmLocked, lang);
    }
    
    const lostMode = null; // Not applicable for Huawei
    const networkLock = formatNetworkLockStatus(false, '', lang); // Default to unlocked for Huawei
    
    // Warranty info - use warranty start date and end date from Huawei data
    let warranty = null;
    if (huaweiParsedData.warrantyStartDate || huaweiParsedData.warrantyEndDate) {
      warranty = formatWarrantyInfo(
        huaweiParsedData.warrantyStartDate, 
        null, 
        'huawei',
        lang
      );
      
      // If we have end date, update warranty info
      if (huaweiParsedData.warrantyEndDate) {
        try {
          const endDate = new Date(huaweiParsedData.warrantyEndDate);
          const now = new Date();
          const isExpired = endDate < now;
          
          if (isExpired) {
            warranty.status = 'expired';
            const roExpired = `Garanție expirată (până la ${huaweiParsedData.warrantyEndDateOriginal || huaweiParsedData.warrantyEndDate})`;
            const enExpired = `Warranty expired (until ${huaweiParsedData.warrantyEndDateOriginal || huaweiParsedData.warrantyEndDate})`;
            warranty.texts = { ro: roExpired, en: enExpired };
            warranty.text = warranty.texts[lang];
          } else {
            warranty.status = 'active';
            const roActive = `În garanție până la ${huaweiParsedData.warrantyEndDateOriginal || huaweiParsedData.warrantyEndDate}`;
            const enActive = `In warranty until ${huaweiParsedData.warrantyEndDateOriginal || huaweiParsedData.warrantyEndDate}`;
            warranty.texts = { ro: roActive, en: enActive };
            warranty.text = warranty.texts[lang];
          }
          warranty.hasInfo = true;
          warranty.endDate = endDate;
        } catch (e) {
          // If date parsing fails, use warranty status from API
          if (huaweiParsedData.warrantyStatus) {
            warranty.hasInfo = true;
            warranty.status = huaweiParsedData.warrantyStatus.toLowerCase().includes('out') ? 'expired' : 'active';
            warranty.texts = { ro: huaweiParsedData.warrantyStatus, en: huaweiParsedData.warrantyStatus };
            warranty.text = warranty.texts[lang];
          }
        }
      } else if (huaweiParsedData.warrantyStatus) {
        warranty.hasInfo = true;
        warranty.status = huaweiParsedData.warrantyStatus.toLowerCase().includes('out') ? 'expired' : 'active';
        warranty.texts = { ro: huaweiParsedData.warrantyStatus, en: huaweiParsedData.warrantyStatus };
        warranty.text = warranty.texts[lang];
      }
    } else {
      warranty = formatWarrantyInfo(null, null, 'huawei', lang);
    }
    const origin = formatOriginInfo(null, null, null, lang);
    
    // Calculate risk score
    const criticalInfo = { iCloud, blacklist, knox, mdm, lostMode, networkLock };
    const riskScore = calculateRiskScore(criticalInfo);
    
    const riskDetails = getRiskDetails(riskScore, lang);
    
    templateData = {
      ...templateData,
      brand: brand, // Ensure brand is included
      huaweiParsedData: huaweiParsedData,
      iCloud: iCloud || null,
      blacklist: blacklist || formatBlacklistStatus(undefined, undefined, null, null, lang),
      knox: knox || null,
      mdm: mdm || formatMDMStatus(null, null, lang),
      lostMode: lostMode || null,
      networkLock: networkLock || formatNetworkLockStatus(null, null, lang),
      warranty: warranty || formatWarrantyInfo(null, null, 'huawei', lang),
      origin: origin || formatOriginInfo(null, null, null, lang),
      riskScore: riskScore || 9,
      riskText: riskDetails.riskText,
      riskTexts: riskDetails.riskTexts,
      scoreColor: riskDetails.scoreColor,
      summaryText: riskDetails.summaryText,
      summaryTexts: riskDetails.summaryTexts
    };
  } else {
    // Generic/Apple template
    templateName = 'verify/result';
    const reportData = mainOrder.object || {};
    const isApple = brand === 'apple' || brand === 'iphone';
    let appleMdmCheck = reportData.appleMdmCheck || null;
    if (appleMdmCheck && typeof appleMdmCheck === 'string') {
      try {
        appleMdmCheck = JSON.parse(appleMdmCheck);
      } catch (err) {
        appleMdmCheck = null;
      }
    }

    const appleMdmFields = appleMdmCheck && appleMdmCheck.fields ? appleMdmCheck.fields : {};
    const appleMdmEntries = APPLE_MDM_FIELD_KEYS.map((key) => {
      if (!appleMdmFields || !(key in appleMdmFields)) {
        return null;
      }
      const value = appleMdmFields[key];
      if (value === null || value === undefined || value === '') {
        return null;
      }
      if (typeof value === 'object' && value !== null) {
        const raw = value.raw !== undefined ? value.raw : '';
        const normalized = value.normalized !== undefined ? value.normalized : null;
        return {
          key,
          raw: (raw || normalized || '').toString(),
          normalized,
          isPositive: value.isPositive ?? (normalized === 'on'),
          isNegative: value.isNegative ?? (normalized === 'off')
        };
      }
      return {
        key,
        raw: value,
        normalized: null,
        isPositive: null,
        isNegative: null
      };
    }).filter(Boolean);
    const appleMdmHasData = appleMdmEntries.length > 0;
    
    const iCloud = isApple ? formatiCloudStatus(reportData.fmiOn, reportData.fmiON, lang) : null;
    const blacklist = formatBlacklistStatus(
      reportData.gsmaBlacklisted, 
      reportData.blacklistStatus,
      reportData.blacklistRecords,
      reportData.blacklistData,
      lang
    );
    const warranty = formatWarrantyInfo(reportData.estPurchaseDate, reportData.activationDate, brand, lang);
    
    let mdm = null;
    if (appleMdmCheck && appleMdmCheck.mdmLock && appleMdmCheck.mdmLock.normalized) {
      const normalized = appleMdmCheck.mdmLock.normalized;
      mdm = formatMDMStatus(normalized, normalized, lang);
    } else if (reportData.mdmStatus !== undefined || reportData.mdmLocked !== undefined) {
      mdm = formatMDMStatus(reportData.mdmStatus, reportData.mdmLocked, lang);
    }
    
    const lostMode = isApple ? formatLostModeStatus(reportData.lostMode, lang) : null;
    const networkLock = formatNetworkLockStatus(reportData.simlock, reportData.carrier, lang);
    const origin = formatOriginInfo(reportData.country, reportData.soldBy, reportData.soldByCountry, lang);
    
    const criticalInfo = { iCloud, blacklist, mdm, lostMode, networkLock };
    const riskScore = calculateRiskScore(criticalInfo);
    
    const riskDetails = getRiskDetails(riskScore, lang);
    
    templateData = {
      ...templateData,
      brand: brand, // Ensure brand is included
      isApple: isApple,
      iCloud: iCloud || null,
      blacklist: blacklist || formatBlacklistStatus(undefined, undefined, null, null, lang),
      mdm: mdm || formatMDMStatus(null, null, lang),
      lostMode: lostMode || null,
      networkLock: networkLock || formatNetworkLockStatus(null, null, lang),
      warranty: warranty || formatWarrantyInfo(null, null, brand, lang),
      origin: origin || formatOriginInfo(null, null, null, lang),
      riskScore: riskScore || 9,
      riskText: riskDetails.riskText,
      riskTexts: riskDetails.riskTexts,
      scoreColor: riskDetails.scoreColor,
      summaryText: riskDetails.summaryText,
      summaryTexts: riskDetails.summaryTexts,
      appleMdm: {
        hasData: appleMdmHasData,
        entries: appleMdmEntries,
        mdmLock: appleMdmCheck ? appleMdmCheck.mdmLock : null,
        rawHtml: appleMdmCheck ? appleMdmCheck.rawHtml : '',
        fetchedAt: appleMdmCheck ? appleMdmCheck.fetchedAt : null
      },
      showAppleMdmButton: isApple && !appleMdmHasData,
      appleMdmButtonDisabled: appleMdmHasData
    };
  }

  const riskScoreMax = riskWeights.baseScore || 10;
  templateData.riskScoreMax = riskScoreMax;
  if (!templateData.appleMdm) {
    templateData.appleMdm = { hasData: false, entries: [] };
  }
  if (typeof templateData.showAppleMdmButton === 'undefined') {
    templateData.showAppleMdmButton = false;
  }
  if (typeof templateData.appleMdmButtonDisabled === 'undefined') {
    templateData.appleMdmButtonDisabled = false;
  }
  
  const templatePath = path.join(viewsPath, `${templateName}.ejs`);
  const emailTemplatePath = path.join(viewsPath, 'email/verification-result.ejs');

  const emailData = buildEmailData(templateName, templateData, translate);
  const emailHTML = await ejs.renderFile(emailTemplatePath, emailData, {
    root: viewsPath,
    views: viewsPath
  });
  
  let fullHTML = emailHTML;
  
  if (includeLayout) {
    const resultHTMLForLayout = await ejs.renderFile(templatePath, { ...templateData, isEmail: false }, {
      root: viewsPath,
      views: viewsPath
    });
    
    const layoutPath = path.join(viewsPath, 'layout.ejs');
    const layoutData = {
      ...templateData,
      csrfToken: '',
      body: resultHTMLForLayout
    };
    
    fullHTML = await ejs.renderFile(layoutPath, layoutData, {
      root: viewsPath,
      views: viewsPath
    });
  }
  
  return {
    emailHTML,
    fullHTML,
    templateName,
    templateData
  };
}

module.exports = {
  generateResultHTML
};

