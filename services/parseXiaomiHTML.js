/**
 * Parse Xiaomi result from API (supports both JSON object and HTML)
 */

function parseXiaomiHTML(html, jsonObject = null) {
  // If we have a JSON object, use it directly (preferred)
  if (jsonObject && typeof jsonObject === 'object') {
    return {
      model: jsonObject.modelName || '',
      modelCode: jsonObject.modelCode || '',
      imei: jsonObject.imei || '',
      imei2: jsonObject.imei2 || '',
      serial: jsonObject.serial || '',
      unlockNumber: jsonObject.unlockNumber || '',
      skuNumber: jsonObject.skuNumber || '',
      purchaseCountry: jsonObject.purchaseCountry || '',
      activationCountry: jsonObject.activationCountry || '',
      warrantyStatus: jsonObject.warrantyStatus || '',
      warrantyDescription: jsonObject.warrantyDescription || '',
      warrantyStartDate: jsonObject.warrantyStartDate || '',
      warrantyEndDate: jsonObject.warrantyEndDate || '',
      deliveryDate: jsonObject.deliveryDate || '',
      activationDate: jsonObject.activationDate || '',
      productionDate: jsonObject.productionDate || '',
      miLockStatus: jsonObject.miActivationLock || '',
      imageUrl: '',
      // Extract color, RAM, ROM from model name if available
      deviceColor: extractColorFromModel(jsonObject.modelName || ''),
      deviceRAM: extractRAMFromModel(jsonObject.modelName || ''),
      deviceROM: extractROMFromModel(jsonObject.modelName || '')
    };
  }
  
  // Fallback to HTML parsing if no JSON object
  if (!html) return null;
  
  const data = {
    model: '',
    modelCode: '',
    imei: '',
    imei2: '',
    serial: '',
    unlockNumber: '',
    skuNumber: '',
    purchaseCountry: '',
    activationCountry: '',
    warrantyStatus: '',
    warrantyDescription: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    deliveryDate: '',
    activationDate: '',
    productionDate: '',
    miLockStatus: '',
    imageUrl: '',
    deviceColor: '',
    deviceROM: '',
    deviceRAM: ''
  };
  
  // Try to extract image URL
  const imageMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imageMatch) {
    data.imageUrl = imageMatch[1];
  }
  
  // Extract Model Name
  const modelMatch = html.match(/Model Name[^:]*:\s*([^<\n]+)/i);
  if (modelMatch) {
    data.model = modelMatch[1].trim();
    data.deviceColor = extractColorFromModel(data.model);
    data.deviceRAM = extractRAMFromModel(data.model);
    data.deviceROM = extractROMFromModel(data.model);
  }
  
  // Extract Model Code
  const modelCodeMatch = html.match(/Model Code[^:]*:\s*([^<\n]+)/i);
  if (modelCodeMatch) {
    data.modelCode = modelCodeMatch[1].trim();
  }
  
  // Extract IMEI
  const imeiMatch = html.match(/IMEI Number[^:]*:\s*([0-9]+)/i);
  if (imeiMatch) {
    data.imei = imeiMatch[1].trim();
  }
  
  // Extract IMEI2
  const imei2Match = html.match(/IMEI2 Number[^:]*:\s*([0-9]+)/i);
  if (imei2Match) {
    data.imei2 = imei2Match[1].trim();
  }
  
  // Extract Serial Number
  const serialMatch = html.match(/Serial Number[^:]*:\s*([^<\n]+)/i);
  if (serialMatch) {
    data.serial = serialMatch[1].trim();
  }
  
  // Extract Unlock Number
  const unlockMatch = html.match(/Unlock Number[^:]*:\s*([^<\n]+)/i);
  if (unlockMatch) {
    data.unlockNumber = unlockMatch[1].trim();
  }
  
  // Extract SKU Number
  const skuMatch = html.match(/SKU Number[^:]*:\s*([^<\n]+)/i);
  if (skuMatch) {
    data.skuNumber = skuMatch[1].trim();
  }
  
  // Extract Purchase Country
  const purchaseCountryMatch = html.match(/Purchase Country[^:]*:\s*([^<\n]+)/i);
  if (purchaseCountryMatch) {
    data.purchaseCountry = purchaseCountryMatch[1].trim();
  }
  
  // Extract Activation Country
  const activationCountryMatch = html.match(/Activation Country[^:]*:\s*([^<\n]+)/i);
  if (activationCountryMatch) {
    data.activationCountry = activationCountryMatch[1].trim();
  }
  
  // Extract Warranty Status
  const warrantyMatch = html.match(/Warranty Status[^:]*:\s*([^<\n]+)/i);
  if (warrantyMatch) {
    data.warrantyStatus = warrantyMatch[1].trim();
  }
  
  // Extract Warranty Description
  const warrantyDescMatch = html.match(/Warranty Description[^:]*:\s*([^<\n]+)/i);
  if (warrantyDescMatch) {
    data.warrantyDescription = warrantyDescMatch[1].trim();
  }
  
  // Extract Warranty Start Date
  const warrantyStartMatch = html.match(/Warranty Start Date[^:]*:\s*([^<\n]+)/i);
  if (warrantyStartMatch) {
    data.warrantyStartDate = warrantyStartMatch[1].trim();
  }
  
  // Extract Warranty End Date
  const warrantyEndMatch = html.match(/Warranty End Date[^:]*:\s*([^<\n]+)/i);
  if (warrantyEndMatch) {
    data.warrantyEndDate = warrantyEndMatch[1].trim();
  }
  
  // Extract Delivery Date
  const deliveryMatch = html.match(/Delivery Date[^:]*:\s*([^<\n]+)/i);
  if (deliveryMatch) {
    data.deliveryDate = deliveryMatch[1].trim();
  }
  
  // Extract Activation Date
  const activationMatch = html.match(/Activation Date[^:]*:\s*([^<\n]+)/i);
  if (activationMatch) {
    data.activationDate = activationMatch[1].trim();
  }
  
  // Extract Production Date
  const prodDateMatch = html.match(/Production Date[^:]*:\s*([^<\n]+)/i);
  if (prodDateMatch) {
    data.productionDate = prodDateMatch[1].trim();
  }
  
  // Extract MI Activation Lock (handle HTML span tags)
  const miLockMatch = html.match(/MI Activation Lock[^:]*:\s*<span[^>]*>([^<]+)<\/span>/i) ||
                      html.match(/MI Activation Lock[^:]*:\s*([^<\n]+)/i);
  if (miLockMatch) {
    data.miLockStatus = miLockMatch[1].trim();
  }
  
  return data;
}

/**
 * Extract color from model name (e.g., "Redmi 14C Midnight Black 4GB RAM 128GB ROM")
 */
function extractColorFromModel(modelName) {
  if (!modelName) return '';
  const colors = ['Black', 'White', 'Blue', 'Red', 'Green', 'Yellow', 'Purple', 'Pink', 'Gold', 'Silver', 'Grey', 'Gray', 'Midnight', 'Ocean', 'Sunset', 'Aurora'];
  for (const color of colors) {
    if (modelName.includes(color)) {
      return color;
    }
  }
  return '';
}

/**
 * Extract RAM from model name
 */
function extractRAMFromModel(modelName) {
  if (!modelName) return '';
  const ramMatch = modelName.match(/(\d+)\s*GB\s*RAM/i);
  return ramMatch ? `${ramMatch[1]}GB` : '';
}

/**
 * Extract ROM from model name
 */
function extractROMFromModel(modelName) {
  if (!modelName) return '';
  const romMatch = modelName.match(/(\d+)\s*GB\s*ROM/i);
  return romMatch ? `${romMatch[1]}GB` : '';
}

module.exports = { parseXiaomiHTML };

