const axios = require('axios');
const Order = require('../models/Order');
const { schedule: throttleSchedule } = require('./throttleManager');

const API_BASE_URL = 'https://alpha.imeicheck.com/api/php-api';
const API_KEY = process.env.IMEI_API_KEY;

if (!API_KEY) {
  throw new Error('IMEI_API_KEY environment variable is not defined.');
}

// Service mappings
const SERVICES = {
  BRAND_CHECK: 11, // IMEI to Brand/Model/Name
  BLACKLIST_CHECK: 6, // Blacklist Status Check (for all brands)
  APPLE_FULL: 19, // Apple FULL INFO [+Carrier] B
  APPLE_FULL_A: 39, // Apple FULL INFO [+Carrier] A
  APPLE_BASIC: 22, // Apple BASIC INFO (PRO)
  APPLE_MDM_STATUS: 47, // Apple extra MDM / activation details
  SAMSUNG_INFO: 8, // Samsung Info (S1)
  SAMSUNG_KNOX: 21, // Samsung Info & KNOX STATUS (S2)
  SAMSUNG_KNOX_STATUS: 37, // Samsung Info & KNOX STATUS (S1) - recommended
  HUAWEI_INFO: 17, // Huawei IMEI Info
  HONOR_INFO: 58, // Honor Info
  MOTOROLA_INFO: 63, // Motorola Info
  XIAOMI_INFO: 25, // Xiaomi MI LOCK & INFO
  ONEPLUS_INFO: 27, // OnePlus IMEI Info
  PIXEL_INFO: 57, // Google Pixel Info
  APPLE_ACQUISITION: 9 // Apple Acquisition & Provenance (GSX)
};

// Brand detection mapping
const BRAND_SERVICE_MAP = {
  'apple': [SERVICES.APPLE_FULL, SERVICES.APPLE_FULL_A, SERVICES.APPLE_BASIC],
  'samsung': [SERVICES.SAMSUNG_KNOX, SERVICES.SAMSUNG_KNOX_STATUS, SERVICES.SAMSUNG_INFO], // Service 21 first, then 37 as fallback
  'huawei': [SERVICES.HUAWEI_INFO],
  'honor': [SERVICES.HONOR_INFO],
  'motorola': [SERVICES.MOTOROLA_INFO],
  'xiaomi': [SERVICES.XIAOMI_INFO],
  'oneplus': [SERVICES.ONEPLUS_INFO],
  'google': [SERVICES.PIXEL_INFO],
  'pixel': [SERVICES.PIXEL_INFO]
};

/**
 * Make API call to IMEI service
 */
async function callIMEIAPI(serviceId, imei) {
  try {
    const url = `${API_BASE_URL}/create?key=${API_KEY}&service=${serviceId}&imei=${imei}`;
    const response = await throttleSchedule(serviceId, () => axios.get(url));
    return response.data;
  } catch (error) {
    console.error('IMEI API Error:', error.message);
    throw new Error('Eroare la comunicarea cu serviciul de verificare IMEI');
  }
}

/**
 * Get account balance
 */
async function getBalance() {
  try {
    const url = `${API_BASE_URL}/balance?key=${API_KEY}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Balance API Error:', error.message);
    return { balance: 0 };
  }
}

/**
 * Get order history
 */
async function getOrderHistory(orderId) {
  try {
    const url = `${API_BASE_URL}/history?key=${API_KEY}&orderId=${orderId}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Order History API Error:', error.message);
    return null;
  }
}

/**
 * Detect brand from IMEI using service 11
 * Returns normalized brand name (apple, samsung, honor, etc.)
 */
async function detectBrand(imei) {
  try {
    console.log(`[detectBrand] Calling service 11 for IMEI: ${imei}`);
    const result = await callIMEIAPI(SERVICES.BRAND_CHECK, imei);
    
    if (result.status === 'success') {
      // Try to get brand from object first
      if (result.object && result.object.brand) {
        const brand = result.object.brand.toLowerCase().trim();
        console.log(`[detectBrand] Brand from object: "${brand}"`);
        return normalizeBrandName(brand);
      }
      
      // Try to extract from result string if object is not available
      if (result.result) {
        const brandFromResult = extractBrandFromResult(result.result);
        if (brandFromResult) {
          console.log(`[detectBrand] Brand extracted from result: "${brandFromResult}"`);
          return normalizeBrandName(brandFromResult);
        }
      }
    }
    
    console.log(`[detectBrand] Brand detection failed for IMEI: ${imei}`);
    return null;
  } catch (error) {
    console.error('[detectBrand] Brand detection error:', error);
    return null;
  }
}

/**
 * Normalize brand name to match our brand names
 */
function normalizeBrandName(brand) {
  if (!brand) return null;
  
  const normalized = brand.toLowerCase().trim();
  
  // Map common variations to our brand names
  const brandMap = {
    'iphone': 'apple',
    'apple': 'apple',
    'samsung': 'samsung',
    'honor': 'honor',
    'huawei': 'huawei',
    'xiaomi': 'xiaomi',
    'redmi': 'xiaomi',
    'poco': 'xiaomi',
    'mi ': 'xiaomi',
    'oneplus': 'oneplus',
    'motorola': 'motorola',
    'moto': 'motorola'
  };
  
  // Check exact match
  if (brandMap[normalized]) {
    return brandMap[normalized];
  }
  
  // Check if brand contains any of our brand names
  for (const [key, value] of Object.entries(brandMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  
  return normalized;
}

/**
 * Extract brand from HTML/text result if object is not available
 */
function extractBrandFromResult(result) {
  if (!result) return null;
  
  // Try to match brand patterns in the result
  const brandPatterns = [
    /iPhone|Apple/i,
    /Samsung/i,
    /HONOR|Honor/i,
    /Huawei/i,
    /Xiaomi|Redmi|POCO|MI /i,
    /OnePlus/i,
    /Motorola|Moto/i
  ];
  
  const brandNames = ['apple', 'samsung', 'honor', 'huawei', 'xiaomi', 'oneplus', 'motorola'];
  
  for (let i = 0; i < brandPatterns.length; i++) {
    if (brandPatterns[i].test(result)) {
      return brandNames[i];
    }
  }
  
  return null;
}

/**
 * Get detailed device info based on brand
 * For Samsung: tries service 21 first, then 37 as fallback if data is missing
 */
async function getDetailedInfo(imei, brand) {
  const normalizedBrand = brand?.toLowerCase()?.trim();
  console.log(`[getDetailedInfo] IMEI: ${imei}, Brand received: "${brand}", Normalized: "${normalizedBrand}"`);
  
  const serviceIds = BRAND_SERVICE_MAP[normalizedBrand] || [];
  console.log(`[getDetailedInfo] Service IDs for brand "${normalizedBrand}":`, serviceIds);
  
  if (serviceIds.length === 0) {
    console.log(`[getDetailedInfo] No service mapping found for "${normalizedBrand}", falling back to brand check`);
    // Fallback to brand check only
    return await callIMEIAPI(SERVICES.BRAND_CHECK, imei);
  }
  
  // Special handling for Samsung: try service 21 first, then 37 if needed
  if (normalizedBrand === 'samsung' && serviceIds.length >= 2) {
    try {
      // Try service 21 first (SAMSUNG_KNOX)
      console.log(`[getDetailedInfo] Trying service ${SERVICES.SAMSUNG_KNOX} (21) for Samsung`);
      const result21 = await callIMEIAPI(SERVICES.SAMSUNG_KNOX, imei);
      
      if (result21.status === 'success') {
        console.log(`[getDetailedInfo] Service 21 succeeded for Samsung`);
        
        // Check if we need additional data from service 37
        const { parseSamsung21 } = require('./parseSamsung21');
        const parsed21 = parseSamsung21(result21.result || '');
        
        // Check if critical fields are missing
        const missingFields = !parsed21.marketingName || !parsed21.warrantyStatus || !parsed21.knoxGuardText;
        
        if (missingFields) {
          console.log(`[getDetailedInfo] Some fields missing from service 21, trying service 37 as supplement`);
          try {
            const result37 = await callIMEIAPI(SERVICES.SAMSUNG_KNOX_STATUS, imei);
            if (result37.status === 'success') {
              const { parseSamsungHTML } = require('./parseSamsungHTML');
              const parsed37 = parseSamsungHTML(result37.result || '');
              const { mergeSamsungData } = require('./parseSamsung21');
              const merged = mergeSamsungData(parsed21, parsed37);
              
              // Combine results: use result21 as base, but merge data
              return {
                ...result21,
                result: result21.result + '<br><br><hr><br>' + result37.result,
                _parsedData: merged,
                _service21Data: parsed21,
                _service37Data: parsed37
              };
            }
          } catch (error) {
            console.error(`Service 37 failed as supplement:`, error.message);
          }
        }
        
        return {
          ...result21,
          _parsedData: parsed21
        };
      }
    } catch (error) {
      console.error(`Service 21 failed for Samsung, trying service 37:`, error.message);
    }
  }
  
  // Try services in order of preference (fallback for non-Samsung or if Samsung special handling failed)
  for (const serviceId of serviceIds) {
    try {
      console.log(`[getDetailedInfo] Trying service ${serviceId} for brand "${normalizedBrand}"`);
      const result = await callIMEIAPI(serviceId, imei);
      if (result.status === 'success') {
        console.log(`[getDetailedInfo] Service ${serviceId} succeeded for brand "${normalizedBrand}"`);
        return result;
      }
    } catch (error) {
      console.error(`Service ${serviceId} failed for brand "${normalizedBrand}", trying next...`, error.message);
      continue;
    }
  }
  
  // If all detailed services fail, return brand check
  console.log(`[getDetailedInfo] All services failed for "${normalizedBrand}", falling back to brand check`);
  return await callIMEIAPI(SERVICES.BRAND_CHECK, imei);
}

/**
 * Verify IMEI with full flow
 * Always uses service 11 first to detect brand, then uses brand-specific service
 */
async function verifyIMEI(imei, userId = null, email = null, detectedBrand = null, additionalServiceIds = []) {
  try {
    // Step 1: Detect brand using service 11 (brand check) if not already provided
    let brand = detectedBrand ? normalizeBrandName(detectedBrand) : null;
    
    if (brand) {
      console.log(`[verifyIMEI] IMEI: ${imei}, Using provided brand for verification: "${brand}"`);
    } else {
      console.log(`[verifyIMEI] IMEI: ${imei}, Starting brand detection with service 11`);
      brand = await detectBrand(imei);
      console.log(`[verifyIMEI] Brand detected via API (service 11): "${brand}"`);
    }
    
    // Step 2: Get detailed info using brand-specific service
    let detailedResult;
    if (brand) {
      console.log(`[verifyIMEI] Using brand-specific service for "${brand}"`);
      detailedResult = await getDetailedInfo(imei, brand);
    } else {
      // Fallback: if brand detection fails, use generic brand check
      console.log(`[verifyIMEI] Brand detection failed, using generic service`);
      detailedResult = await callIMEIAPI(SERVICES.BRAND_CHECK, imei);
    }
    
    // Step 2.5: Always perform blacklist check (service 6) for all brands
    let blacklistResult = null;
    try {
      console.log(`[verifyIMEI] Performing blacklist check with service 6`);
      blacklistResult = await callIMEIAPI(SERVICES.BLACKLIST_CHECK, imei);
      if (blacklistResult.status === 'success') {
        console.log(`[verifyIMEI] Blacklist check successful`);
        // Merge blacklist data into combined object
        if (blacklistResult.object && typeof blacklistResult.object === 'object') {
          // Store blacklist data separately for easy access
          detailedResult.object = detailedResult.object || {};
          detailedResult.object.blacklistData = blacklistResult.object;
          // Also merge key fields directly
          if (blacklistResult.object.gsmaBlacklisted !== undefined) {
            detailedResult.object.gsmaBlacklisted = blacklistResult.object.gsmaBlacklisted;
          }
          if (blacklistResult.object.blacklistRecords !== undefined) {
            detailedResult.object.blacklistRecords = blacklistResult.object.blacklistRecords;
          }
          if (blacklistResult.object.blacklistStatus !== undefined) {
            detailedResult.object.blacklistStatus = blacklistResult.object.blacklistStatus;
          }
          if (blacklistResult.object.blacklistHistory) {
            detailedResult.object.blacklistHistory = blacklistResult.object.blacklistHistory;
          }
        }
      }
    } catch (error) {
      console.error(`[verifyIMEI] Blacklist check failed:`, error.message);
      // Continue without blacklist data
    }
    
    // Step 3: Process additional services if any
    let additionalResults = [];
    let totalAdditionalCost = 0;
    if (additionalServiceIds && additionalServiceIds.length > 0) {
      for (const serviceId of additionalServiceIds) {
        try {
          const additionalResult = await callIMEIAPI(serviceId, imei);
          if (additionalResult.status === 'success') {
            additionalResults.push(additionalResult);
            totalAdditionalCost += parseFloat(additionalResult.price || 0);
          }
        } catch (error) {
          console.error(`Additional service ${serviceId} failed:`, error);
        }
      }
    }
    
    // Brand should already be detected from service 11, but verify/refine from detailed result
    let finalBrand = brand; // Use brand detected from service 11
    
    // Refine brand detection from detailed result if needed
    if (!finalBrand && detailedResult.result) {
      if (detailedResult.result.includes('Knox Registered')) {
        finalBrand = 'samsung';
      } else if (detailedResult.result.includes('HONOR') || detailedResult.result.includes('Marketing Name:')) {
        finalBrand = 'honor';
      } else if (detailedResult.result.includes('MI Activation Lock') || detailedResult.result.includes('Xiaomi') || detailedResult.result.includes('Redmi')) {
        finalBrand = 'xiaomi';
      } else if (detailedResult.result.includes('MOTOROLA') || detailedResult.result.includes('Moto')) {
        finalBrand = 'motorola';
      }
    }
    
    if (!finalBrand && detailedResult.object) {
      // Check if object has brand field
      if (detailedResult.object.brand) {
        finalBrand = normalizeBrandName(detailedResult.object.brand);
      } else if (detailedResult.object.modelCode && detailedResult.object.modelCode.includes('XIAOMI')) {
        finalBrand = 'xiaomi';
      }
    }
    
    // If still no brand, use 'unknown'
    if (!finalBrand) {
      finalBrand = 'unknown';
      console.log(`[verifyIMEI] Warning: Could not determine brand for IMEI: ${imei}`);
    }
    
    console.log(`[verifyIMEI] Final brand determined: "${finalBrand}"`);
    
    // Combine results from additional services
    let combinedResult = detailedResult.result || '';
    let combinedObject = detailedResult.object || {};
    
    // For Samsung, preserve parsed data from service 21
    if (finalBrand === 'samsung' && detailedResult._parsedData) {
      combinedObject._parsedData = detailedResult._parsedData;
    }
    
    // Add blacklist check result to combined result if available
    if (blacklistResult && blacklistResult.status === 'success' && blacklistResult.result) {
      combinedResult += '<br><br><hr><br><strong>Blacklist Check:</strong><br>' + blacklistResult.result;
    }
    
    // Merge additional service results
    additionalResults.forEach(addResult => {
      if (addResult.result) {
        combinedResult += '<br><br><hr><br>' + addResult.result;
      }
      if (addResult.object && typeof addResult.object === 'object') {
        combinedObject = { ...combinedObject, ...addResult.object };
      }
    });
    
    // Step 4: Return data (order is already created in route handler)
    // Extract model name
    let modelName = 'Unknown';
    
    // For Samsung, use parsed data from service 21 if available
    if (finalBrand === 'samsung' && detailedResult._parsedData) {
      modelName = detailedResult._parsedData.marketingName || 
                  detailedResult._parsedData.fullName || 
                  detailedResult._parsedData.modelDesc || 
                  'Unknown';
    } else {
      // Fallback to standard extraction
      modelName = detailedResult.object?.model || detailedResult.object?.modelDesc || 
               (detailedResult.result && (
                 detailedResult.result.match(/Model Desc:\s*([^<]+)/i)?.[1]?.trim() ||
                 detailedResult.result.match(/Marketing Name:\s*([^<]+)/i)?.[1]?.trim() ||
                 detailedResult.result.match(/SKU Name:\s*([^<]+)/i)?.[1]?.trim() ||
                 detailedResult.result.match(/Model[^:]*:\s*([^<\n]+)/i)?.[1]?.trim() ||
                 detailedResult.result.match(/Model Name[^:]*:\s*([^<\n]+)/i)?.[1]?.trim()
               )) || 
               'Unknown';
    }
    
    // For Motorola devices, try to extract more info from HTML if object is not available
    if (finalBrand === 'motorola' && !detailedResult.object && detailedResult.result) {
      const modelMatch = detailedResult.result.match(/Model[^:]*:\s*([^<\n]+)/i);
      if (modelMatch && modelMatch[1]) {
        modelName = modelMatch[1].trim();
      }
      
      // Try to create a basic object structure from HTML
      const motorolaData = {
        model: modelName,
        modelDesc: modelName,
        imei: imei,
        brand: 'motorola'
      };
      
      // Extract additional fields from HTML
      const serialMatch = detailedResult.result.match(/Serial[^:]*:\s*([^<\n]+)/i);
      if (serialMatch) motorolaData.serial = serialMatch[1].trim();
      
      const warrantyMatch = detailedResult.result.match(/Warranty[^:]*:\s*([^<\n]+)/i);
      if (warrantyMatch) motorolaData.warrantyStatus = warrantyMatch[1].trim();
      
      combinedObject = { ...combinedObject, ...motorolaData };
    }
    
    // For Xiaomi devices, try to extract more info from HTML if object is not available
    if (finalBrand === 'xiaomi' && !detailedResult.object && detailedResult.result) {
      const modelMatch = detailedResult.result.match(/Model[^:]*:\s*([^<\n]+)/i) ||
                         detailedResult.result.match(/Model Name[^:]*:\s*([^<\n]+)/i) ||
                         detailedResult.result.match(/((?:Xiaomi|MI|Redmi|POCO)[^<\n]+)/i);
      if (modelMatch && (modelMatch[1] || modelMatch[0])) {
        modelName = (modelMatch[1] || modelMatch[0]).trim();
      }
      
      // Try to create a basic object structure from HTML
      const xiaomiData = {
        model: modelName,
        modelDesc: modelName,
        imei: imei,
        brand: 'xiaomi'
      };
      
      // Extract additional fields from HTML
      const serialMatch = detailedResult.result.match(/Serial[^:]*:\s*([^<\n]+)/i);
      if (serialMatch) xiaomiData.serial = serialMatch[1].trim();
      
      const miLockMatch = detailedResult.result.match(/MI[^:]*Lock[^:]*:\s*([^<\n]+)/i) ||
                          detailedResult.result.match(/MI Activation Lock[^:]*:\s*<span[^>]*>([^<]+)<\/span>/i);
      if (miLockMatch) xiaomiData.miLockStatus = miLockMatch[1].trim();
      
      const warrantyMatch = detailedResult.result.match(/Warranty[^:]*:\s*([^<\n]+)/i);
      if (warrantyMatch) xiaomiData.warrantyStatus = warrantyMatch[1].trim();
      
      combinedObject = { ...combinedObject, ...xiaomiData };
    }
    
    return {
      success: true,
      data: {
        ...detailedResult,
        result: combinedResult,
        object: combinedObject,
        additionalResults: additionalResults,
        orderId: detailedResult.orderId || Date.now(),
        service: detailedResult.service || 11,
        price: parseFloat(detailedResult.price || 0) + totalAdditionalCost,
        status: detailedResult.status || 'success'
      },
      brand: finalBrand || 'unknown',
      model: modelName,
      object: combinedObject // Include the combined object for all brands
    };
  } catch (error) {
    console.error('Verify IMEI error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  verifyIMEI,
  getBalance,
  getOrderHistory,
  detectBrand,
  getDetailedInfo,
  SERVICES,
  callIMEIAPI
};
