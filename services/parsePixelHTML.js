/**
 * Parse Google Pixel HTML result from API
 */
function parsePixelHTML(html) {
  if (!html) return null;
  
  const data = {
    model: '',
    description: '',
    imei: '',
    serial: '',
    modelNumber: '',
    size: '',
    color: '',
    yearManufactured: '',
    activationStatus: '',
    warranty: '',
    warrantyStatus: '',
    warrantyEndDate: '',
    imageUrl: ''
  };
  
  // Try to extract image URL
  const imageMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imageMatch) {
    data.imageUrl = imageMatch[1];
  }
  
  // Extract Model
  const modelMatch = html.match(/Model[^:]*:\s*([^<\n]+?)(?:<br|$)/i);
  if (modelMatch) {
    data.model = modelMatch[1].trim();
    // Remove any HTML tags
    data.model = data.model.replace(/<[^>]+>/g, '').trim();
  }
  
  // Extract Description
  const descMatch = html.match(/Description[^:]*:\s*([^<\n]+?)(?:<br|$)/i);
  if (descMatch) {
    data.description = descMatch[1].trim();
    // Remove any HTML tags
    data.description = data.description.replace(/<[^>]+>/g, '').trim();
  }
  
  // Extract IMEI
  const imeiMatch = html.match(/IMEI[^:]*:\s*([0-9]+)/i);
  if (imeiMatch) {
    data.imei = imeiMatch[1].trim();
  }
  
  // Extract Serial Number
  const serialMatch = html.match(/Serial[^:]*:\s*([^<\n]+?)(?:<br|$)/i);
  if (serialMatch) {
    data.serial = serialMatch[1].trim();
    // Remove any HTML tags
    data.serial = data.serial.replace(/<[^>]+>/g, '').trim();
  }
  
  // Extract Model Number
  const modelNumMatch = html.match(/Model Number[^:]*:\s*([^<\n]+?)(?:<br|$)/i);
  if (modelNumMatch) {
    data.modelNumber = modelNumMatch[1].trim();
    // Remove any HTML tags
    data.modelNumber = data.modelNumber.replace(/<[^>]+>/g, '').trim();
  }
  
  // Extract Size
  const sizeMatch = html.match(/Size[^:]*:\s*([^<\n]+?)(?:<br|$)/i);
  if (sizeMatch) {
    data.size = sizeMatch[1].trim();
    // Remove any HTML tags
    data.size = data.size.replace(/<[^>]+>/g, '').trim();
  }
  
  // Extract Color
  const colorMatch = html.match(/Color[^:]*:\s*([^<\n]+?)(?:<br|$)/i);
  if (colorMatch) {
    let colorValue = colorMatch[1].trim();
    // Remove any HTML tags
    colorValue = colorValue.replace(/<[^>]+>/g, '').trim();
    // Remove any style attributes
    colorValue = colorValue.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
    // Remove any HTML entities
    colorValue = colorValue.replace(/&[^;]+;/g, '').trim();
    // Remove any text that looks like HTML attributes
    colorValue = colorValue.replace(/[a-z]+:\s*[^;]+;?/gi, '').trim();
    // Clean up any extra whitespace
    colorValue = colorValue.replace(/\s+/g, ' ').trim();
    data.color = colorValue;
  }
  
  // Extract Year Manufactured
  const yearMatch = html.match(/Year manufactured[^:]*:\s*([^<\n]+?)(?:<br|$)/i);
  if (yearMatch) {
    data.yearManufactured = yearMatch[1].trim();
    // Remove any HTML tags
    data.yearManufactured = data.yearManufactured.replace(/<[^>]+>/g, '').trim();
  }
  
  // Extract Activation Status
  const activationMatch = html.match(/Activation Status[^:]*:\s*([^<\n]+?)(?:<br|$)/i);
  if (activationMatch) {
    data.activationStatus = activationMatch[1].trim();
    // Remove any HTML tags
    data.activationStatus = data.activationStatus.replace(/<[^>]+>/g, '').trim();
  }
  
  // Extract Warranty
  const warrantyMatch = html.match(/Warranty[^:]*:\s*([^<\n]+?)(?:<br|$)/i);
  if (warrantyMatch) {
    let warrantyValue = warrantyMatch[1].trim();
    // Remove any HTML tags
    warrantyValue = warrantyValue.replace(/<[^>]+>/g, '').trim();
    data.warranty = warrantyValue;
    
    // Parse warranty status and end date
    if (warrantyValue.toLowerCase().includes('expired')) {
      data.warrantyStatus = 'Out of Warranty';
      // Try to extract date from warranty string (e.g., "Warranty expired 30.01.2024")
      const dateMatch = warrantyValue.match(/(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/);
      if (dateMatch) {
        data.warrantyEndDate = dateMatch[1];
        // Convert DD.MM.YYYY to a more standard format for warranty calculation
        const dateParts = dateMatch[1].split(/[.\/]/);
        if (dateParts.length === 3) {
          const day = dateParts[0].padStart(2, '0');
          const month = dateParts[1].padStart(2, '0');
          const year = dateParts[2].length === 2 ? '20' + dateParts[2] : dateParts[2];
          // Store as YYYY-MM-DD for easier parsing
          data.warrantyEndDateFormatted = `${year}-${month}-${day}`;
        }
      }
    } else if (warrantyValue.toLowerCase().includes('warranty') && !warrantyValue.toLowerCase().includes('expired')) {
      data.warrantyStatus = 'In Warranty';
    }
  }
  
  return data;
}

module.exports = { parsePixelHTML };

