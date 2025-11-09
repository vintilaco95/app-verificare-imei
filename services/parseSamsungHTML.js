/**
 * Parse Samsung HTML result and extract device information
 */
function parseSamsungHTML(html) {
  const data = {
    model: '',
    modelDesc: '',
    modelName: '',
    modelNumber: '',
    imei: '',
    imei2: '',
    serial: '',
    warrantyStatus: '',
    warrantyEndDate: '',
    productionLocation: '',
    productionDate: '',
    country: '',
    carrier: '',
    knoxRegistered: false,
    knoxMessage: '',
    imageUrl: ''
  };

  if (!html) return data;

  // Extract image URL
  const imgMatch = html.match(/<img[^>]+src=([^>"\s]+)/);
  if (imgMatch) {
    data.imageUrl = imgMatch[1].replace(/['"]/g, '');
  }

  // Extract Model Info
  const modelInfoMatch = html.match(/Model Info:\s*([^<]+)/i);
  if (modelInfoMatch) {
    data.model = modelInfoMatch[1].trim();
  }

  // Extract Model Desc
  const modelDescMatch = html.match(/Model Desc:\s*([^<]+)/i);
  if (modelDescMatch) {
    data.modelDesc = modelDescMatch[1].trim();
  }

  // Extract Model Name
  const modelNameMatch = html.match(/Model Name:\s*([^<]+)/i);
  if (modelNameMatch) {
    data.modelName = modelNameMatch[1].trim();
  }

  // Extract Model Number
  const modelNumberMatch = html.match(/Model Number:\s*([^<]+)/i);
  if (modelNumberMatch) {
    data.modelNumber = modelNumberMatch[1].trim();
  }

  // Extract IMEI 1
  const imei1Match = html.match(/IMEI 1:\s*([^<]+)/i);
  if (imei1Match) {
    data.imei = imei1Match[1].trim();
  }

  // Extract IMEI 2
  const imei2Match = html.match(/IMEI 2:\s*([^<]+)/i);
  if (imei2Match) {
    data.imei2 = imei2Match[1].trim();
  }

  // Extract Serial Number
  const serialMatch = html.match(/Serial Number:\s*([^<]+)/i);
  if (serialMatch) {
    data.serial = serialMatch[1].trim();
  }

  // Extract Warranty Status
  const warrantyMatch = html.match(/Warranty Status:\s*([^<]+)/i);
  if (warrantyMatch) {
    data.warrantyStatus = warrantyMatch[1].trim();
  }

  // Extract Warranty End Date
  const warrantyEndMatch = html.match(/Estimated Warranty End Date:\s*([^<]+)/i);
  if (warrantyEndMatch) {
    data.warrantyEndDate = warrantyEndMatch[1].trim();
  }

  // Extract Production Location
  const prodLocMatch = html.match(/Production location:\s*([^<]+)/i);
  if (prodLocMatch) {
    data.productionLocation = prodLocMatch[1].trim();
  }

  // Extract Production Date
  const prodDateMatch = html.match(/Production Date:\s*([^<]+)/i);
  if (prodDateMatch) {
    data.productionDate = prodDateMatch[1].trim();
  }

  // Extract Country
  const countryMatch = html.match(/Country:\s*([^<]+)/i);
  if (countryMatch) {
    data.country = countryMatch[1].trim();
  }

  // Extract Carrier
  const carrierMatch = html.match(/Carrier:\s*([^<]+)/i);
  if (carrierMatch) {
    data.carrier = carrierMatch[1].trim();
  }

  // Extract Knox Registered status
  const knoxMatch = html.match(/Knox Registered:.*?<span[^>]*>([^<]+)<\/span>/i);
  if (knoxMatch) {
    const knoxStatus = knoxMatch[1].trim().toUpperCase();
    data.knoxRegistered = knoxStatus === 'ON';
  }

  // Extract Knox Message
  const knoxMsgMatch = html.match(/Knox Message:\s*([^<]+)/i);
  if (knoxMsgMatch) {
    data.knoxMessage = knoxMsgMatch[1].trim();
  }

  return data;
}

module.exports = { parseSamsungHTML };

