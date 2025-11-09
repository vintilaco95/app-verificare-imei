/**
 * Parse Huawei HTML result and extract device information
 */
function parseHuaweiHTML(html) {
  const data = {
    skuName: '',
    searchTerm: '',
    serial: '',
    itemCode: '',
    offerCode: '',
    warrantyStatus: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    warrantyValidInCountry: '',
    warrantyTypes: [],
    imageUrl: ''
  };

  if (!html) return data;

  // Try to extract image URL
  const imageMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imageMatch) {
    data.imageUrl = imageMatch[1];
  }

  // Extract SKU Name
  const skuNameMatch = html.match(/SKU Name[^:]*:\s*([^<\n]+)/i);
  if (skuNameMatch) {
    data.skuName = skuNameMatch[1].trim();
  }

  // Extract Search Term
  const searchTermMatch = html.match(/Search Term[^:]*:\s*([^<\n]+)/i);
  if (searchTermMatch) {
    data.searchTerm = searchTermMatch[1].trim();
  }

  // Extract Serial Number
  const serialMatch = html.match(/SN[^:]*:\s*([^<\n]+)/i);
  if (serialMatch) {
    data.serial = serialMatch[1].trim();
  }

  // Extract Item Code
  const itemCodeMatch = html.match(/Item Code[^:]*:\s*([^<\n]+)/i);
  if (itemCodeMatch) {
    data.itemCode = itemCodeMatch[1].trim();
  }

  // Extract Offer Code
  const offerCodeMatch = html.match(/Offer Code[^:]*:\s*([^<\n]+)/i);
  if (offerCodeMatch) {
    data.offerCode = offerCodeMatch[1].trim();
  }

  // Extract Warranty Status
  const warrantyStatusMatch = html.match(/Warranty Status[^:]*:\s*([^<\n]+)/i);
  if (warrantyStatusMatch) {
    data.warrantyStatus = warrantyStatusMatch[1].trim();
  }

  // Extract Warranty Start Date
  const warrantyStartMatch = html.match(/Warranty Start Date[^:]*:\s*([^<\n]+)/i);
  if (warrantyStartMatch) {
    let startDate = warrantyStartMatch[1].trim();
    // Convert from YYYY/M/D to YYYY-MM-DD format
    const dateParts = startDate.split('/');
    if (dateParts.length === 3) {
      const year = dateParts[0];
      const month = dateParts[1].padStart(2, '0');
      const day = dateParts[2].padStart(2, '0');
      data.warrantyStartDate = `${year}-${month}-${day}`;
      data.warrantyStartDateOriginal = startDate; // Keep original format too
    } else {
      data.warrantyStartDate = startDate;
    }
  }

  // Extract Warranty End Date
  const warrantyEndMatch = html.match(/Warranty End Date[^:]*:\s*([^<\n]+)/i);
  if (warrantyEndMatch) {
    let endDate = warrantyEndMatch[1].trim();
    // Convert from YYYY/M/D to YYYY-MM-DD format
    const dateParts = endDate.split('/');
    if (dateParts.length === 3) {
      const year = dateParts[0];
      const month = dateParts[1].padStart(2, '0');
      const day = dateParts[2].padStart(2, '0');
      data.warrantyEndDate = `${year}-${month}-${day}`;
      data.warrantyEndDateOriginal = endDate; // Keep original format too
    } else {
      data.warrantyEndDate = endDate;
    }
  }

  // Extract Warranty Valid in Country
  const validCountryMatch = html.match(/Warranty Valid in Country[^:]*:\s*([^<\n]+)/i);
  if (validCountryMatch) {
    data.warrantyValidInCountry = validCountryMatch[1].trim();
  }

  // Extract all Warranty Types (there can be multiple)
  const warrantyTypeMatches = html.matchAll(/Warranty Type[^:]*:\s*([^<\n]+)/gi);
  const warrantyTypes = [];
  for (const match of warrantyTypeMatches) {
    warrantyTypes.push(match[1].trim());
  }
  data.warrantyTypes = warrantyTypes;

  // Extract model from SKU Name (e.g., "nova 11 Pro Dual SIM 8GB+256GB (GOA-LX9) Black")
  if (data.skuName) {
    // Try to extract model code from parentheses
    const modelCodeMatch = data.skuName.match(/\(([^)]+)\)/);
    if (modelCodeMatch) {
      data.modelCode = modelCodeMatch[1].trim();
    }
    
    // Extract model name (everything before the first parenthesis)
    const modelNameMatch = data.skuName.match(/^([^(]+)/);
    if (modelNameMatch) {
      data.modelName = modelNameMatch[1].trim();
    }
  }

  return data;
}

module.exports = { parseHuaweiHTML };

