/**
 * Parse Samsung service 21 result (new format with detailed information)
 * This service returns HTML with more detailed information than service 37
 */
function parseSamsung21(html) {
  const data = {
    manufacturer: '',
    marketingName: '',
    fullName: '',
    modelCode: '',
    imei: '',
    imei2: '',
    serial: '',
    modelNumber: '',
    doNumber: '',
    productionDate: '',
    purchaseDate: '',
    warrantyUntil: '',
    warrantyStatus: '',
    salesBuyerCode: '',
    salesBuyerName: '',
    carrier: '',
    soldByCountry: '',
    shipToCountry: '',
    soldDate: '',
    shipDate: '',
    knoxGuard: false,
    knoxGuardText: '',
    imageUrl: ''
  };

  if (!html) return data;

  // Extract image URL if present
  const imgMatch = html.match(/<img[^>]+src=([^>"\s]+)/);
  if (imgMatch) {
    data.imageUrl = imgMatch[1].replace(/['"]/g, '');
  }

  // Extract Manufacturer
  const manufacturerMatch = html.match(/Manufacturer:\s*([^<]+)/i);
  if (manufacturerMatch) {
    data.manufacturer = manufacturerMatch[1].trim();
  }

  // Extract Marketing Name
  const marketingNameMatch = html.match(/Marketing Name:\s*([^<]+)/i);
  if (marketingNameMatch) {
    data.marketingName = marketingNameMatch[1].trim();
  }

  // Extract Full Name
  const fullNameMatch = html.match(/Full Name:\s*([^<]+)/i);
  if (fullNameMatch) {
    data.fullName = fullNameMatch[1].trim();
  }

  // Extract Model Code
  const modelCodeMatch = html.match(/Model Code:\s*([^<]+)/i);
  if (modelCodeMatch) {
    data.modelCode = modelCodeMatch[1].trim();
  }

  // Extract IMEI1
  const imei1Match = html.match(/IMEI1:\s*([^<]+)/i);
  if (imei1Match) {
    data.imei = imei1Match[1].trim();
  }

  // Extract IMEI2
  const imei2Match = html.match(/IMEI2:\s*([^<]+)/i);
  if (imei2Match) {
    data.imei2 = imei2Match[1].trim();
  }

  // Extract Serial Number
  const serialMatch = html.match(/Serial Number:\s*([^<]+)/i);
  if (serialMatch) {
    data.serial = serialMatch[1].trim();
  }

  // Extract Model Number
  const modelNumberMatch = html.match(/Model Number:\s*([^<]+)/i);
  if (modelNumberMatch) {
    data.modelNumber = modelNumberMatch[1].trim();
  }

  // Extract DO Number
  const doNumberMatch = html.match(/DO Number:\s*([^<]+)/i);
  if (doNumberMatch) {
    data.doNumber = doNumberMatch[1].trim();
  }

  // Extract Production Date
  const productionDateMatch = html.match(/Production Date:\s*([^<]+)/i);
  if (productionDateMatch) {
    data.productionDate = productionDateMatch[1].trim();
  }

  // Extract Purchase Date
  const purchaseDateMatch = html.match(/Purchase Date:\s*([^<]+)/i);
  if (purchaseDateMatch) {
    data.purchaseDate = purchaseDateMatch[1].trim();
  }

  // Extract Warranty Until
  const warrantyUntilMatch = html.match(/Warranty Until:\s*([^<]+)/i);
  if (warrantyUntilMatch) {
    data.warrantyUntil = warrantyUntilMatch[1].trim();
  }

  // Extract Warranty Status
  const warrantyStatusMatch = html.match(/Warranty Status:\s*([^<]+)/i);
  if (warrantyStatusMatch) {
    data.warrantyStatus = warrantyStatusMatch[1].trim();
  }

  // Extract Sales Buyer Code
  const salesBuyerCodeMatch = html.match(/Sales Buyer Code:\s*([^<]+)/i);
  if (salesBuyerCodeMatch) {
    data.salesBuyerCode = salesBuyerCodeMatch[1].trim();
  }

  // Extract Sales Buyer Name
  const salesBuyerNameMatch = html.match(/Sales Buyer Name:\s*([^<]+)/i);
  if (salesBuyerNameMatch) {
    data.salesBuyerName = salesBuyerNameMatch[1].trim();
  }

  // Extract Carrier
  const carrierMatch = html.match(/Carrier:\s*([^<]+)/i);
  if (carrierMatch) {
    data.carrier = carrierMatch[1].trim();
  }

  // Extract Sold By Country
  const soldByCountryMatch = html.match(/Sold By Country:\s*([^<]+)/i);
  if (soldByCountryMatch) {
    data.soldByCountry = soldByCountryMatch[1].trim();
  }

  // Extract Ship To Country
  const shipToCountryMatch = html.match(/Ship To Country:\s*([^<]+)/i);
  if (shipToCountryMatch) {
    data.shipToCountry = shipToCountryMatch[1].trim();
  }

  // Extract Sold Date
  const soldDateMatch = html.match(/Sold Date:\s*([^<]+)/i);
  if (soldDateMatch) {
    data.soldDate = soldDateMatch[1].trim();
  }

  // Extract Ship Date
  const shipDateMatch = html.match(/Ship Date:\s*([^<]+)/i);
  if (shipDateMatch) {
    data.shipDate = shipDateMatch[1].trim();
  }

  // Extract Knox Guard status
  const knoxMatch = html.match(/Knox Guard:\s*([^<]+)/i);
  if (knoxMatch) {
    const knoxStatus = knoxMatch[1].trim().toUpperCase();
    data.knoxGuard = knoxStatus === 'ON';
    data.knoxGuardText = knoxStatus === 'ON' ? 'ACTIV' : 'DEZACTIVAT';
  }

  return data;
}

/**
 * Merge data from service 21 and service 37 (if service 21 is missing some fields)
 */
function mergeSamsungData(data21, data37) {
  const merged = { ...data21 };
  
  // If service 21 doesn't have certain fields, use service 37
  if (!merged.imageUrl && data37.imageUrl) {
    merged.imageUrl = data37.imageUrl;
  }
  
  // For Knox Guard, prioritize service 21 data (even if false)
  // Only use service 37 if service 21 doesn't have knoxGuard at all
  if (merged.knoxGuard === undefined && data37.knoxRegistered !== undefined) {
    merged.knoxGuard = data37.knoxRegistered;
  }
  
  if (!merged.knoxGuardText && data37.knoxMessage) {
    merged.knoxGuardText = data37.knoxMessage;
  }
  
  // Use service 37 data as fallback for any missing fields
  if (!merged.model && data37.model) {
    merged.model = data37.model;
  }
  
  if (!merged.modelDesc && data37.modelDesc) {
    merged.modelDesc = data37.modelDesc;
  }
  
  if (!merged.warrantyStatus && data37.warrantyStatus) {
    merged.warrantyStatus = data37.warrantyStatus;
  }
  
  return merged;
}

module.exports = { parseSamsung21, mergeSamsungData };

