/**
 * Parse Motorola HTML result from API
 */

function parseMotorolaHTML(html) {
  if (!html) return null;
  
  const data = {
    model: '',
    marketName: '',
    imei: '',
    imei2: '',
    serial: '',
    warrantyStatus: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    activationDate: '',
    productionDate: '',
    country: '',
    shipToCountry: '',
    soldByCountry: '',
    carrier: '',
    deviceColor: '',
    deviceROM: '',
    deviceRAM: '',
    modelNumber: '',
    mtm: '',
    hsn: '',
    factoryCode: '',
    organizationCode: '',
    regionId: '',
    soldToCustomerName: '',
    shipToCity: '',
    shipToDate: '',
    recentActivation: '',
    softwareVersion: '',
    imageUrl: ''
  };
  
  // Try to extract image URL
  const imageMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imageMatch) {
    data.imageUrl = imageMatch[1];
  }
  
  // Extract Model Name
  const modelNameMatch = html.match(/Model Name[^:]*:\s*([^<\n]+)/i);
  if (modelNameMatch) {
    data.model = modelNameMatch[1].trim();
  }
  
  // Extract Market Name
  const marketNameMatch = html.match(/Market Name[^:]*:\s*([^<\n]+)/i);
  if (marketNameMatch) {
    data.marketName = marketNameMatch[1].trim();
  }
  
  // Use Market Name as primary model if available
  if (data.marketName) {
    data.model = data.marketName;
  }
  
  // Extract IMEI
  const imeiMatch = html.match(/IMEI[^:]*:\s*([0-9]+)/i);
  if (imeiMatch) {
    data.imei = imeiMatch[1].trim();
  }
  
  // Extract IMEI2
  const imei2Match = html.match(/IMEI2[^:]*:\s*([0-9]+)/i);
  if (imei2Match) {
    data.imei2 = imei2Match[1].trim();
  }
  
  // Extract Serial Number
  const serialMatch = html.match(/Serial[^:]*:\s*([^<\n]+)/i);
  if (serialMatch) {
    data.serial = serialMatch[1].trim();
  }
  
  // Extract Warranty Status
  const warrantyMatch = html.match(/Phone[^:]*:\s*([^<\n]+)/i);
  if (warrantyMatch) {
    data.warrantyStatus = warrantyMatch[1].trim();
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
  
  // Extract Activation Date
  const activationMatch = html.match(/Activation Date[^:]*:\s*([^<\n]+)/i);
  if (activationMatch) {
    data.activationDate = activationMatch[1].trim();
  }
  
  // Extract Ship To Country
  const shipToCountryMatch = html.match(/Ship To Country[^:]*:\s*([^<\n]+)/i);
  if (shipToCountryMatch) {
    data.shipToCountry = shipToCountryMatch[1].trim();
  }
  
  // Extract Sold By Country
  const soldByCountryMatch = html.match(/Sold By Country[^:]*:\s*([^<\n]+)/i);
  if (soldByCountryMatch) {
    data.soldByCountry = soldByCountryMatch[1].trim();
  }
  
  // Extract Carrier
  const carrierMatch = html.match(/SIM Card Carrier[^:]*:\s*([^<\n]+)/i);
  if (carrierMatch) {
    data.carrier = carrierMatch[1].trim();
  }
  
  // Extract Device Color - stop at <br> or next field
  // Match pattern: "Color: VALUE<br>" or "Color: VALUE\n" or "Color: VALUE" (end of string)
  const colorMatch = html.match(/Color[^:]*:\s*([^<\n]+?)(?:<br|$)/i);
  if (colorMatch) {
    let colorValue = colorMatch[1].trim();
    // Remove any HTML tags that might have been captured
    colorValue = colorValue.replace(/<[^>]+>/g, '').trim();
    // Remove any style attributes or other HTML artifacts (including inline styles)
    colorValue = colorValue.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
    // Remove any remaining HTML entities
    colorValue = colorValue.replace(/&[^;]+;/g, '').trim();
    // Remove any text that looks like HTML attributes (e.g., "green;">)
    colorValue = colorValue.replace(/[a-z]+:\s*[^;]+;?/gi, '').trim();
    // Clean up any extra whitespace
    colorValue = colorValue.replace(/\s+/g, ' ').trim();
    data.deviceColor = colorValue;
  }
  
  // Extract ROM (from model name or separate field)
  const romMatch = html.match(/ROM[^:]*:\s*([^<\n]+)/i);
  if (romMatch) {
    data.deviceROM = romMatch[1].trim();
  } else {
    // Try to extract from model name like "8+256"
    const romFromModel = data.model.match(/(\d+)\+(\d+)/);
    if (romFromModel) {
      data.deviceRAM = romFromModel[1] + 'GB';
      data.deviceROM = romFromModel[2] + 'GB';
    }
  }
  
  // Extract RAM
  const ramMatch = html.match(/RAM[^:]*:\s*([^<\n]+)/i);
  if (ramMatch) {
    data.deviceRAM = ramMatch[1].trim();
  }
  
  // Extract Model Number / MTM
  const mtmMatch = html.match(/MTM[^:]*:\s*([^<\n]+)/i);
  if (mtmMatch) {
    data.mtm = mtmMatch[1].trim();
    data.modelNumber = data.mtm;
  }
  
  // Extract HSN
  const hsnMatch = html.match(/HSN[^:]*:\s*([^<\n]+)/i);
  if (hsnMatch) {
    data.hsn = hsnMatch[1].trim();
  }
  
  // Extract Factory Code
  const factoryCodeMatch = html.match(/Factory Code[^:]*:\s*([^<\n]+)/i);
  if (factoryCodeMatch) {
    data.factoryCode = factoryCodeMatch[1].trim();
  }
  
  // Extract Organization Code
  const orgCodeMatch = html.match(/Organization Code[^:]*:\s*([^<\n]+)/i);
  if (orgCodeMatch) {
    data.organizationCode = orgCodeMatch[1].trim();
  }
  
  // Extract Region Id
  const regionMatch = html.match(/Region Id[^:]*:\s*([^<\n]+)/i);
  if (regionMatch) {
    data.regionId = regionMatch[1].trim();
  }
  
  // Extract Sold To Customer Name
  const soldToMatch = html.match(/Sold To Customer Name[^:]*:\s*([^<\n]+)/i);
  if (soldToMatch) {
    data.soldToCustomerName = soldToMatch[1].trim();
  }
  
  // Extract Ship To City
  const shipToCityMatch = html.match(/Ship To City[^:]*:\s*([^<\n]+)/i);
  if (shipToCityMatch) {
    data.shipToCity = shipToCityMatch[1].trim();
  }
  
  // Extract Ship To Date
  const shipToDateMatch = html.match(/Ship To Date[^:]*:\s*([^<\n]+)/i);
  if (shipToDateMatch) {
    data.shipToDate = shipToDateMatch[1].trim();
  }
  
  // Extract Recent Activation
  const recentActivationMatch = html.match(/Recent Activation[^:]*:\s*([^<\n]+)/i);
  if (recentActivationMatch) {
    data.recentActivation = recentActivationMatch[1].trim();
  }
  
  // Extract Software Version
  const swVersionMatch = html.match(/Software Version[^:]*:\s*([^<\n]+)/i);
  if (swVersionMatch) {
    data.softwareVersion = swVersionMatch[1].trim();
  }
  
  // Use shipToCountry as country if available
  if (data.shipToCountry) {
    data.country = data.shipToCountry;
  }
  
  return data;
}

module.exports = { parseMotorolaHTML };

