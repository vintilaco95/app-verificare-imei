/**
 * Parse Honor HTML result and extract device information
 */
function parseHonorHTML(html) {
  const data = {
    modelFullDesc: '',
    modelShortDesc: '',
    skuName: '',
    imei: '',
    imei1: '',
    serial: '',
    modelNumber: '',
    pcbaBarcode: '',
    bluetoothMac: '',
    wirelessMac: '',
    softwareVersion: '',
    contract: '',
    companyName: '',
    countryName: '',
    factoryName: '',
    marketingName: '',
    skuCode: '',
    externalModel: '',
    deviceColor: '',
    deviceROM: '',
    deviceRAM: '',
    simType: '',
    warrantyStatus: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    warrantyType: '',
    validInCountry: '',
    bindDate: '',
    imageUrl: ''
  };

  if (!html) return data;

  // Extract Model Full Description
  const modelFullMatch = html.match(/Model Full Description:\s*([^<]+)/i);
  if (modelFullMatch) {
    data.modelFullDesc = modelFullMatch[1].trim();
  }

  // Extract Model Short Description
  const modelShortMatch = html.match(/Model Short Description:\s*([^<]+)/i);
  if (modelShortMatch) {
    data.modelShortDesc = modelShortMatch[1].trim();
  }

  // Extract SKU Name
  const skuNameMatch = html.match(/SKU Name:\s*([^<]+)/i);
  if (skuNameMatch) {
    data.skuName = skuNameMatch[1].trim();
  }

  // Extract IMEI
  const imeiMatch = html.match(/IMEI:\s*([^<]+)/i);
  if (imeiMatch) {
    data.imei = imeiMatch[1].trim();
  }

  // Extract IMEI1
  const imei1Match = html.match(/IMEI1:\s*([^<]+)/i);
  if (imei1Match) {
    data.imei1 = imei1Match[1].trim();
  }

  // Extract Serial Number
  const serialMatch = html.match(/SN:\s*([^<]+)/i);
  if (serialMatch) {
    data.serial = serialMatch[1].trim();
  }

  // Extract Model Number
  const modelNumberMatch = html.match(/Model Number:\s*([^<]+)/i);
  if (modelNumberMatch) {
    data.modelNumber = modelNumberMatch[1].trim();
  }

  // Extract PCBA Barcode
  const pcbaMatch = html.match(/PCBA Barcode:\s*([^<]+)/i);
  if (pcbaMatch) {
    data.pcbaBarcode = pcbaMatch[1].trim();
  }

  // Extract Bluetooth Mac
  const btMacMatch = html.match(/Bluetooth Mac:\s*([^<]+)/i);
  if (btMacMatch) {
    data.bluetoothMac = btMacMatch[1].trim();
  }

  // Extract Wireless Mac
  const wifiMacMatch = html.match(/Wireless Mac:\s*([^<]+)/i);
  if (wifiMacMatch) {
    data.wirelessMac = wifiMacMatch[1].trim();
  }

  // Extract Software Version
  const swVersionMatch = html.match(/Software Version:\s*([^<]+)/i);
  if (swVersionMatch) {
    data.softwareVersion = swVersionMatch[1].trim();
  }

  // Extract Contract
  const contractMatch = html.match(/Contract:\s*([^<]+)/i);
  if (contractMatch) {
    data.contract = contractMatch[1].trim();
  }

  // Extract Company Name
  const companyMatch = html.match(/Company Name:\s*([^<]+)/i);
  if (companyMatch) {
    data.companyName = companyMatch[1].trim();
  }

  // Extract Country Name
  const countryMatch = html.match(/Country Name:\s*([^<]+)/i);
  if (countryMatch) {
    data.countryName = countryMatch[1].trim();
  }

  // Extract Factory Name
  const factoryMatch = html.match(/Factory Name:\s*([^<]+)/i);
  if (factoryMatch) {
    data.factoryName = factoryMatch[1].trim();
  }

  // Extract Marketing Name
  const marketingMatch = html.match(/Marketing Name:\s*([^<]+)/i);
  if (marketingMatch) {
    data.marketingName = marketingMatch[1].trim();
  }

  // Extract SKU Code
  const skuCodeMatch = html.match(/SKU Code:\s*([^<]+)/i);
  if (skuCodeMatch) {
    data.skuCode = skuCodeMatch[1].trim();
  }

  // Extract External Model
  const externalModelMatch = html.match(/External Model:\s*([^<]+)/i);
  if (externalModelMatch) {
    data.externalModel = externalModelMatch[1].trim();
  }

  // Extract Device Color
  const colorMatch = html.match(/Device Color:\s*([^<]+)/i);
  if (colorMatch) {
    data.deviceColor = colorMatch[1].trim();
  }

  // Extract Device ROM
  const romMatch = html.match(/Device ROM:\s*([^<]+)/i);
  if (romMatch) {
    data.deviceROM = romMatch[1].trim();
  }

  // Extract Device RAM
  const ramMatch = html.match(/Device RAM:\s*([^<]+)/i);
  if (ramMatch) {
    data.deviceRAM = ramMatch[1].trim();
  }

  // Extract Sim Type
  const simTypeMatch = html.match(/Sim Type:\s*([^<]+)/i);
  if (simTypeMatch) {
    data.simType = simTypeMatch[1].trim();
  }

  // Extract Warranty Status
  const warrantyStatusMatch = html.match(/Warranty Status:\s*([^<]+)/i);
  if (warrantyStatusMatch) {
    data.warrantyStatus = warrantyStatusMatch[1].trim();
  }

  // Extract Warranty Start Date
  const warrantyStartMatch = html.match(/Warranty Start Date:\s*([^<]+)/i);
  if (warrantyStartMatch) {
    data.warrantyStartDate = warrantyStartMatch[1].trim();
  }

  // Extract Warranty End Date (first occurrence)
  const warrantyEndMatch = html.match(/Warranty End Date:\s*([^<]+)/i);
  if (warrantyEndMatch) {
    data.warrantyEndDate = warrantyEndMatch[1].trim();
  }

  // Extract Warranty Type (first occurrence - Device Warranty)
  const warrantyTypeMatch = html.match(/Warranty Type:\s*([^<]+)/i);
  if (warrantyTypeMatch) {
    data.warrantyType = warrantyTypeMatch[1].trim();
  }

  // Extract Valid in Country
  const validCountryMatch = html.match(/Valid in Country:\s*([^<]+)/i);
  if (validCountryMatch) {
    data.validInCountry = validCountryMatch[1].trim();
  }

  // Extract Bind Date
  const bindDateMatch = html.match(/Bind Date:\s*([^<]+)/i);
  if (bindDateMatch) {
    data.bindDate = bindDateMatch[1].trim();
  }

  return data;
}

module.exports = { parseHonorHTML };

