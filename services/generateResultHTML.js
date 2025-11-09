const ejs = require('ejs');
const path = require('path');
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
  calculateRiskScore
} = require('./emailFormatter');

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

function buildAlerts(data) {
  const alerts = [];

  if (data.iCloud && data.iCloud.status === 'on') {
    alerts.push({
      title: 'iCloud (Find My iPhone) este activ',
      text: 'Dispozitivul este legat de un cont iCloud. Nu achiziționa fără a-l dezactiva în fața ta.'
    });
  }

  if (data.lostMode && data.lostMode.status === 'active') {
    alerts.push({
      title: 'Dispozitiv în mod pierdut',
      text: 'Dispozitivul este raportat ca pierdut/furat. Nu recomandăm achiziția.'
    });
  }

  if (data.blacklist && data.blacklist.status === 'blacklisted') {
    alerts.push({
      title: 'Dispozitiv blocat/furat',
      text: 'IMEI-ul apare în bazele de date blacklist. Evită achiziția.'
    });
  }

  if (data.mdm && data.mdm.status === 'locked') {
    alerts.push({
      title: 'MDM Lock activ',
      text: 'Dispozitivul este gestionat de o companie (Mobile Device Management). Poate fi re-blocat ulterior.'
    });
  }

  if (data.networkLock && data.networkLock.status === 'locked') {
    alerts.push({
      title: 'Blocare de rețea',
      text: data.networkLock.text || 'Dispozitivul este blocat pe o anumită rețea.'
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

function buildEmailData(templateName, templateData) {
  const order = templateData.order || {};
  const device = getDeviceInfo(templateName, templateData);
  const criticalInfo = [];

  if (templateData.miAccount) {
    addCriticalInfo(criticalInfo, 'Mi Account (Mi Activation Lock)', templateData.miAccount);
    if (templateData.iCloud && templateData.iCloud !== templateData.miAccount) {
      addCriticalInfo(criticalInfo, 'iCloud (Find My iPhone)', templateData.iCloud);
    }
  } else {
    addCriticalInfo(criticalInfo, 'iCloud (Find My iPhone)', templateData.iCloud);
  }
  addCriticalInfo(criticalInfo, 'Status blacklist', templateData.blacklist);
  addCriticalInfo(criticalInfo, 'Knox Guard', templateData.knox);
  addCriticalInfo(criticalInfo, 'MDM Lock', templateData.mdm);
  addCriticalInfo(criticalInfo, 'Mod pierdut', templateData.lostMode);
  addCriticalInfo(criticalInfo, 'Blocare rețea', templateData.networkLock);
  addCriticalInfo(criticalInfo, 'Garanție', templateData.warranty);

  if (templateData.origin && templateData.origin.text) {
    addCriticalInfo(criticalInfo, 'Proveniență', {
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
    title: 'Rezultat verificare IMEI',
    brand: device.brand,
    device,
    riskScore: templateData.riskScore || 0,
    riskText: templateData.riskText || 'Status necunoscut',
    scoreColor: templateData.scoreColor || '#22c55e',
    summaryText: templateData.summaryText || '',
    criticalInfo,
    alerts: buildAlerts(templateData),
    additionalResults: mapAdditionalResults(templateData.additionalResults),
    order: {
      id: order._id ? order._id.toString() : '',
      imei: device.imei,
      createdAt: generatedAt
    }
  };
}

/**
 * Generate the complete HTML for a verification result
 * Uses the same logic as routes/verify.js to prepare data and render template
 */
async function generateResultHTML(order, options = {}) {
  const viewsPath = path.join(__dirname, '../views');
  const includeLayout = options.includeLayout !== undefined ? options.includeLayout : true;
  
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
    title: 'Rezultat verificare IMEI',
    order: mainOrder,
    user: null, // No user in email context
    brand: brand, // Add brand to template data
    additionalResults: parsedResults.additionalResults,
    formatDate: formatDateHelper || ((date) => date || 'Data necunoscută')
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
      reportData.blacklistData
    );
    
    let knoxValue = null;
    if (samsungParsedData && samsungParsedData.knoxGuard !== undefined) {
      knoxValue = samsungParsedData.knoxGuard;
    } else if (samsungParsedData && samsungParsedData.knoxRegistered !== undefined) {
      knoxValue = samsungParsedData.knoxRegistered;
    } else if (reportData && reportData.knoxRegistered !== undefined) {
      knoxValue = reportData.knoxRegistered;
    }
    const knox = knoxValue !== null ? formatKnoxStatus(knoxValue) : formatKnoxStatus(null);
    
    const warranty = formatWarrantyInfo(
      samsungParsedData.purchaseDate || samsungParsedData.productionDate || reportData.estPurchaseDate, 
      null, 
      'samsung'
    );
    
    let mdm = null;
    if (mdmStatus !== null || mdmLocked !== null) {
      mdm = formatMDMStatus(mdmStatus, mdmLocked);
    }
    
    const lostMode = null;
    const carrierText = samsungParsedData.carrier || reportData.carrier || '';
    const isUnlocked = carrierText.toLowerCase() === 'open' || carrierText.toLowerCase().includes('unlock');
    const networkLock = formatNetworkLockStatus(!isUnlocked, carrierText);
    const origin = formatOriginInfo(
      samsungParsedData.soldByCountry || samsungParsedData.shipToCountry || reportData.country, 
      samsungParsedData.salesBuyerName || reportData.soldBy, 
      samsungParsedData.soldByCountry || reportData.soldByCountry
    );
    
    // Calculate risk score
    const criticalInfo = { iCloud, blacklist, knox, mdm, lostMode, networkLock };
    const riskScore = calculateRiskScore(criticalInfo);
    
    let riskText = 'Telefon sigur';
    let scoreColor = '#22c55e';
    let summaryText = 'Dispozitivul este în regulă pentru achiziție.';
    
    if (riskScore <= 2) {
      riskText = 'Dispozitiv PERICULOS';
      scoreColor = '#ef4444';
      summaryText = 'Dispozitivul are probleme critice — NU CUMPĂRA.';
    } else if (riskScore <= 4) {
      riskText = 'Dispozitiv cu RISC RIDICAT';
      scoreColor = '#f97316';
      summaryText = 'Dispozitivul are probleme importante — amână achiziția.';
    } else if (riskScore <= 6) {
      riskText = 'Dispozitiv cu RISC MODERAT';
      scoreColor = '#f59e0b';
      summaryText = 'Dispozitivul are probleme minore — verifică înainte de cumpărare.';
    }
    
      templateData = {
        ...templateData,
        brand: brand, // Ensure brand is included
        samsungParsedData: samsungParsedData,
        iCloud: iCloud || null,
        blacklist: blacklist || { status: 'unknown', text: 'Nu avem informații despre statusul blacklist' },
        knox: knox || null,
        mdm: mdm || null,
        lostMode: lostMode || null,
        networkLock: networkLock || { status: 'unknown', text: 'Nu avem informații despre blocarea rețelei' },
        warranty: warranty || { hasInfo: false, text: 'Nu avem informații despre garanție' },
        origin: origin || { hasInfo: false, text: 'Nu avem informații despre proveniență' },
        riskScore: riskScore || 9,
        riskText: riskText || 'Telefon sigur',
        scoreColor: scoreColor || '#22c55e',
        summaryText: summaryText || 'Dispozitivul este în regulă pentru achiziție.'
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
      reportData.blacklistData
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
      mdm = formatMDMStatus(mdmStatus, mdmLocked);
    }
    
    const lostMode = null; // Not applicable for Honor
    const networkLock = formatNetworkLockStatus(false, ''); // Default to unlocked for Honor
    const warranty = formatWarrantyInfo(
      honorParsedData.warrantyStartDate || honorParsedData.bindDate, 
      null, 
      'honor'
    );
    const origin = formatOriginInfo(
      honorParsedData.countryName || '', 
      honorParsedData.companyName || '', 
      honorParsedData.countryName || ''
    );
    
    // Calculate risk score
    const criticalInfo = { iCloud, blacklist, knox, mdm, lostMode, networkLock };
    const riskScore = calculateRiskScore(criticalInfo);
    
    let riskText = 'Telefon sigur';
    let scoreColor = '#22c55e';
    let summaryText = 'Dispozitivul este în regulă pentru achiziție.';
    
    if (riskScore <= 2) {
      riskText = 'Dispozitiv PERICULOS';
      scoreColor = '#ef4444';
      summaryText = 'Dispozitivul are probleme critice — NU CUMPĂRA.';
    } else if (riskScore <= 4) {
      riskText = 'Dispozitiv cu RISC RIDICAT';
      scoreColor = '#f97316';
      summaryText = 'Dispozitivul are probleme importante — amână achiziția.';
    } else if (riskScore <= 6) {
      riskText = 'Dispozitiv cu RISC MODERAT';
      scoreColor = '#f59e0b';
      summaryText = 'Dispozitivul are probleme minore — verifică înainte de cumpărare.';
    }
    
    templateData = {
      ...templateData,
      brand: brand, // Ensure brand is included
      honorParsedData: honorParsedData,
      iCloud: iCloud || null,
      blacklist: blacklist || { status: 'unknown', text: 'Nu avem informații despre statusul blacklist' },
      knox: knox || null,
      mdm: mdm || null,
      lostMode: lostMode || null,
      networkLock: networkLock || { status: 'unknown', text: 'Nu avem informații despre blocarea rețelei' },
      warranty: warranty || { hasInfo: false, text: 'Nu avem informații despre garanție' },
      origin: origin || { hasInfo: false, text: 'Nu avem informații despre proveniență' },
      riskScore: riskScore || 9,
      riskText: riskText || 'Telefon sigur',
      scoreColor: scoreColor || '#22c55e',
      summaryText: summaryText || 'Dispozitivul este în regulă pentru achiziție.'
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
      reportData.blacklistData
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
      mdm = formatMDMStatus(mdmStatus, mdmLocked);
    }
    
    const lostMode = null; // Not applicable for Motorola
    const carrierText = motorolaParsedData.carrier || '';
    const isUnlocked = carrierText.toLowerCase().includes('world comm') || carrierText.toLowerCase().includes('unlock');
    const networkLock = formatNetworkLockStatus(!isUnlocked, carrierText);
    const warranty = formatWarrantyInfo(
      motorolaParsedData.warrantyStartDate || motorolaParsedData.activationDate, 
      motorolaParsedData.activationDate, 
      'motorola'
    );
    const origin = formatOriginInfo(
      motorolaParsedData.shipToCountry || motorolaParsedData.soldByCountry || motorolaParsedData.country, 
      motorolaParsedData.soldToCustomerName || '', 
      motorolaParsedData.soldByCountry || ''
    );
    
    // Calculate risk score
    const criticalInfo = { iCloud, blacklist, knox, mdm, lostMode, networkLock };
    const riskScore = calculateRiskScore(criticalInfo);
    
    let riskText = 'Telefon sigur';
    let scoreColor = '#22c55e';
    let summaryText = 'Dispozitivul este în regulă pentru achiziție.';
    
    if (riskScore <= 2) {
      riskText = 'Dispozitiv PERICULOS';
      scoreColor = '#ef4444';
      summaryText = 'Dispozitivul are probleme critice — NU CUMPĂRA.';
    } else if (riskScore <= 4) {
      riskText = 'Dispozitiv cu RISC RIDICAT';
      scoreColor = '#f97316';
      summaryText = 'Dispozitivul are probleme importante — amână achiziția.';
    } else if (riskScore <= 6) {
      riskText = 'Dispozitiv cu RISC MODERAT';
      scoreColor = '#f59e0b';
      summaryText = 'Dispozitivul are probleme minore — verifică înainte de cumpărare.';
    }
    
    templateData = {
      ...templateData,
      brand: brand, // Ensure brand is included
      motorolaParsedData: motorolaParsedData,
      iCloud: iCloud || null,
      blacklist: blacklist || { status: 'unknown', text: 'Nu avem informații despre statusul blacklist' },
      knox: knox || null,
      mdm: mdm || null,
      lostMode: lostMode || null,
      networkLock: networkLock || { status: 'unknown', text: 'Nu avem informații despre blocarea rețelei' },
      warranty: warranty || { hasInfo: false, text: 'Nu avem informații despre garanție' },
      origin: origin || { hasInfo: false, text: 'Nu avem informații despre proveniență' },
      riskScore: riskScore || 9,
      riskText: riskText || 'Telefon sigur',
      scoreColor: scoreColor || '#22c55e',
      summaryText: summaryText || 'Dispozitivul este în regulă pentru achiziție.'
    };
  } else if (isXiaomi) {
    templateName = 'verify/result-xiaomi';
    const { parseXiaomiHTML } = require('./parseXiaomiHTML');
    const xiaomiParsedData = parseXiaomiHTML(mainOrder.result || '', mainOrder.object || {});

    const reportData = mainOrder.object || {};
    const miLockRaw = reportData.miActivationLock || reportData.miLockStatus || xiaomiParsedData.miLockStatus || null;
    const miAccount = formatMiLockStatus(miLockRaw);
    const blacklist = formatBlacklistStatus(
      reportData.gsmaBlacklisted,
      reportData.blacklistStatus,
      reportData.blacklistRecords,
      reportData.blacklistData
    );
    const warranty = formatWarrantyInfo(
      xiaomiParsedData.warrantyStartDate || reportData.warrantyStartDate,
      xiaomiParsedData.activationDate || reportData.activationDate,
      'xiaomi'
    );
    const origin = formatOriginInfo(
      xiaomiParsedData.purchaseCountry || reportData.purchaseCountry,
      null,
      xiaomiParsedData.activationCountry || reportData.activationCountry
    );
    const networkLock = formatNetworkLockStatus(
      reportData.simlock || reportData.lockStatus || null,
      reportData.carrier || ''
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

    let riskText = 'Telefon sigur';
    let scoreColor = '#22c55e';
    let summaryText = 'Dispozitivul este în regulă pentru achiziție.';

    if (riskScore <= 2) {
      riskText = 'Dispozitiv PERICULOS';
      scoreColor = '#ef4444';
      summaryText = 'Dispozitivul are probleme critice — NU CUMPĂRA.';
    } else if (riskScore <= 4) {
      riskText = 'Dispozitiv cu RISC RIDICAT';
      scoreColor = '#f97316';
      summaryText = 'Dispozitivul are probleme importante — verifică atent Mi Activation Lock și istoricul.';
    } else if (riskScore <= 6) {
      riskText = 'Dispozitiv cu RISC MODERAT';
      scoreColor = '#f59e0b';
      summaryText = 'Există unele atenționări — verifică documentele și statusul contului Mi.';
    }

    templateData = {
      ...templateData,
      brand: brand,
      xiaomiParsedData,
      miAccount,
      iCloud: miAccount, // for compatibility with calculateRiskScore consumers
      blacklist: blacklist || { status: 'unknown', text: 'Nu avem informații despre statusul blacklist' },
      mdm: null,
      knox: null,
      lostMode: null,
      networkLock: networkLock || { status: 'unknown', text: 'Nu avem informații despre blocarea rețelei' },
      warranty: warranty || { hasInfo: false, text: 'Nu avem informații despre garanție' },
      origin: origin || { hasInfo: false, text: 'Nu avem informații despre proveniență' },
      riskScore: riskScore || 9,
      riskText: riskText,
      scoreColor: scoreColor,
      summaryText: summaryText
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
      reportData.blacklistData
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
      mdm = formatMDMStatus(mdmStatus, mdmLocked);
    }
    
    const lostMode = null; // Not applicable for Pixel
    const modelText = pixelParsedData.model || '';
    const isUnlocked = modelText.toLowerCase().includes('(unlocked)') || modelText.toLowerCase().includes('unlocked');
    const networkLock = formatNetworkLockStatus(!isUnlocked, isUnlocked ? 'Unlocked' : '');
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
      'pixel'
    );
    const origin = formatOriginInfo(null, null, null);
    
    // Calculate risk score
    const criticalInfo = { iCloud, blacklist, knox, mdm, lostMode, networkLock };
    const riskScore = calculateRiskScore(criticalInfo);
    
    let riskText = 'Telefon sigur';
    let scoreColor = '#22c55e';
    let summaryText = 'Dispozitivul este în regulă pentru achiziție.';
    
    if (riskScore <= 2) {
      riskText = 'Dispozitiv PERICULOS';
      scoreColor = '#ef4444';
      summaryText = 'Dispozitivul are probleme critice — NU CUMPĂRA.';
    } else if (riskScore <= 4) {
      riskText = 'Dispozitiv cu RISC RIDICAT';
      scoreColor = '#f97316';
      summaryText = 'Dispozitivul are probleme importante — amână achiziția.';
    } else if (riskScore <= 6) {
      riskText = 'Dispozitiv cu RISC MODERAT';
      scoreColor = '#f59e0b';
      summaryText = 'Dispozitivul are probleme minore — verifică înainte de cumpărare.';
    }
    
    templateData = {
      ...templateData,
      brand: brand, // Ensure brand is included
      pixelParsedData: pixelParsedData,
      iCloud: iCloud || null,
      blacklist: blacklist || { status: 'unknown', text: 'Nu avem informații despre statusul blacklist' },
      knox: knox || null,
      mdm: mdm || null,
      lostMode: lostMode || null,
      networkLock: networkLock || { status: 'unknown', text: 'Nu avem informații despre blocarea rețelei' },
      warranty: warranty || { hasInfo: false, text: 'Nu avem informații despre garanție' },
      origin: origin || { hasInfo: false, text: 'Nu avem informații despre proveniență' },
      riskScore: riskScore || 9,
      riskText: riskText || 'Telefon sigur',
      scoreColor: scoreColor || '#22c55e',
      summaryText: summaryText || 'Dispozitivul este în regulă pentru achiziție.'
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
      reportData.blacklistData
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
      mdm = formatMDMStatus(mdmStatus, mdmLocked);
    }
    
    const lostMode = null; // Not applicable for Huawei
    const networkLock = formatNetworkLockStatus(false, ''); // Default to unlocked for Huawei
    
    // Warranty info - use warranty start date and end date from Huawei data
    let warranty = null;
    if (huaweiParsedData.warrantyStartDate || huaweiParsedData.warrantyEndDate) {
      warranty = formatWarrantyInfo(
        huaweiParsedData.warrantyStartDate, 
        null, 
        'huawei'
      );
      
      // If we have end date, update warranty info
      if (huaweiParsedData.warrantyEndDate) {
        try {
          const endDate = new Date(huaweiParsedData.warrantyEndDate);
          const now = new Date();
          const isExpired = endDate < now;
          
          if (isExpired) {
            warranty.status = 'expired';
            warranty.text = `Garanție expirată (până la ${huaweiParsedData.warrantyEndDateOriginal || huaweiParsedData.warrantyEndDate})`;
          } else {
            warranty.status = 'active';
            warranty.text = `În garanție până la ${huaweiParsedData.warrantyEndDateOriginal || huaweiParsedData.warrantyEndDate}`;
          }
          warranty.hasInfo = true;
          warranty.endDate = endDate;
        } catch (e) {
          // If date parsing fails, use warranty status from API
          if (huaweiParsedData.warrantyStatus) {
            warranty.hasInfo = true;
            warranty.status = huaweiParsedData.warrantyStatus.toLowerCase().includes('out') ? 'expired' : 'active';
            warranty.text = huaweiParsedData.warrantyStatus;
          }
        }
      } else if (huaweiParsedData.warrantyStatus) {
        warranty.hasInfo = true;
        warranty.status = huaweiParsedData.warrantyStatus.toLowerCase().includes('out') ? 'expired' : 'active';
        warranty.text = huaweiParsedData.warrantyStatus;
      }
    } else {
      warranty = formatWarrantyInfo(null, null, 'huawei');
    }
    const origin = formatOriginInfo(null, null, null);
    
    // Calculate risk score
    const criticalInfo = { iCloud, blacklist, knox, mdm, lostMode, networkLock };
    const riskScore = calculateRiskScore(criticalInfo);
    
    let riskText = 'Telefon sigur';
    let scoreColor = '#22c55e';
    let summaryText = 'Dispozitivul este în regulă pentru achiziție.';
    
    if (riskScore <= 2) {
      riskText = 'Dispozitiv PERICULOS';
      scoreColor = '#ef4444';
      summaryText = 'Dispozitivul are probleme critice — NU CUMPĂRA.';
    } else if (riskScore <= 4) {
      riskText = 'Dispozitiv cu RISC RIDICAT';
      scoreColor = '#f97316';
      summaryText = 'Dispozitivul are probleme importante — amână achiziția.';
    } else if (riskScore <= 6) {
      riskText = 'Dispozitiv cu RISC MODERAT';
      scoreColor = '#f59e0b';
      summaryText = 'Dispozitivul are probleme minore — verifică înainte de cumpărare.';
    }
    
    templateData = {
      ...templateData,
      brand: brand, // Ensure brand is included
      huaweiParsedData: huaweiParsedData,
      iCloud: iCloud || null,
      blacklist: blacklist || { status: 'unknown', text: 'Nu avem informații despre statusul blacklist' },
      knox: knox || null,
      mdm: mdm || null,
      lostMode: lostMode || null,
      networkLock: networkLock || { status: 'unknown', text: 'Nu avem informații despre blocarea rețelei' },
      warranty: warranty || { hasInfo: false, text: 'Nu avem informații despre garanție' },
      origin: origin || { hasInfo: false, text: 'Nu avem informații despre proveniență' },
      riskScore: riskScore || 9,
      riskText: riskText || 'Telefon sigur',
      scoreColor: scoreColor || '#22c55e',
      summaryText: summaryText || 'Dispozitivul este în regulă pentru achiziție.'
    };
  } else {
    // Generic/Apple template
    templateName = 'verify/result';
    const reportData = mainOrder.object || {};
    const isApple = brand === 'apple' || brand === 'iphone';
    
    const iCloud = isApple ? formatiCloudStatus(reportData.fmiOn, reportData.fmiON) : null;
    const blacklist = formatBlacklistStatus(
      reportData.gsmaBlacklisted, 
      reportData.blacklistStatus,
      reportData.blacklistRecords,
      reportData.blacklistData
    );
    const warranty = formatWarrantyInfo(reportData.estPurchaseDate, reportData.activationDate, brand);
    
    let mdm = null;
    if (reportData.mdmStatus !== undefined || reportData.mdmLocked !== undefined) {
      mdm = formatMDMStatus(reportData.mdmStatus, reportData.mdmLocked);
    }
    
    const lostMode = isApple ? formatLostModeStatus(reportData.lostMode) : null;
    const networkLock = formatNetworkLockStatus(reportData.simlock, reportData.carrier);
    const origin = formatOriginInfo(reportData.country, reportData.soldBy, reportData.soldByCountry);
    
    const criticalInfo = { iCloud, blacklist, mdm, lostMode, networkLock };
    const riskScore = calculateRiskScore(criticalInfo);
    
    let riskText = 'Telefon sigur';
    let scoreColor = '#22c55e';
    let summaryText = 'Dispozitivul este în regulă pentru achiziție.';
    
    if (riskScore <= 2) {
      riskText = 'Dispozitiv PERICULOS';
      scoreColor = '#ef4444';
      summaryText = 'Dispozitivul are probleme critice — NU CUMPĂRA.';
    } else if (riskScore <= 4) {
      riskText = 'Dispozitiv cu RISC RIDICAT';
      scoreColor = '#f97316';
      summaryText = 'Dispozitivul are probleme importante — amână achiziția.';
    } else if (riskScore <= 6) {
      riskText = 'Dispozitiv cu RISC MODERAT';
      scoreColor = '#f59e0b';
      summaryText = 'Dispozitivul are probleme minore — verifică înainte de cumpărare.';
    }
    
      templateData = {
        ...templateData,
        brand: brand, // Ensure brand is included
        isApple: isApple,
        iCloud: iCloud || null,
        blacklist: blacklist || { status: 'unknown', text: 'Nu avem informații despre statusul blacklist' },
        mdm: mdm || null,
        lostMode: lostMode || null,
        networkLock: networkLock || { status: 'unknown', text: 'Nu avem informații despre blocarea rețelei' },
        warranty: warranty || { hasInfo: false, text: 'Nu avem informații despre garanție' },
        origin: origin || { hasInfo: false, text: 'Nu avem informații despre proveniență' },
        riskScore: riskScore || 9,
        riskText: riskText || 'Telefon sigur',
        scoreColor: scoreColor || '#22c55e',
        summaryText: summaryText || 'Dispozitivul este în regulă pentru achiziție.'
      };
  }
  
  const templatePath = path.join(viewsPath, `${templateName}.ejs`);
  const emailTemplatePath = path.join(viewsPath, 'email/verification-result.ejs');

  const emailData = buildEmailData(templateName, templateData);
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
    fullHTML
  };
}

module.exports = {
  generateResultHTML
};

