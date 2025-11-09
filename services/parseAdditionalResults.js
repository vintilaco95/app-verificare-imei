/**
 * Parse and format additional service results
 */

const sanitizeHtml = require('sanitize-html');
const { getAdditionalServices } = require('../config/pricing');

const SANITIZE_OPTIONS = {
  allowedTags: ['b', 'i', 'em', 'strong', 'u', 'br', 'span', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
  allowedAttributes: {
    span: ['style'],
    td: ['style'],
    th: ['style']
  },
  allowedStyles: {
    '*': {
      'color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb(a)?\([0-9,\s.]+\)$/, /^green$/i, /^red$/i, /^orange$/i, /^blue$/i],
      'text-align': [/^(left|right|center)$/]
    }
  }
};

function sanitizeContent(html) {
  return sanitizeHtml(html || '', SANITIZE_OPTIONS);
}

/**
 * Parse additional service results from order
 */
function parseAdditionalResults(order) {
  if (!order.additionalServices || order.additionalServices.length === 0) {
    return {
      mainResult: order.result || '',
      additionalResults: []
    };
  }
  
  const brand = order.brand || 'apple';
  const services = getAdditionalServices(brand);
  const additionalResults = [];
  
  // Split result by separator (we added <hr> between results)
  const resultParts = (order.result || '').split(/<br><br><hr><br>/);
  
  // First part is the main result
  const mainResult = resultParts[0] || order.result || '';
  
  // Rest are additional service results
  for (let i = 0; i < order.additionalServices.length; i++) {
    const serviceId = order.additionalServices[i];
    const service = services.find(s => s.id === serviceId);
    
    if (service) {
      const rawResult = resultParts[i + 1] || '';
      const formatted = formatAdditionalResult(service, rawResult);
      additionalResults.push(formatted);
    }
  }
  
  return {
    mainResult: mainResult,
    additionalResults: additionalResults
  };
}

/**
 * Format additional service result for display
 */
function formatAdditionalResult(service, rawResult) {
  // Try to parse as JSON first
  let parsedData = null;
  try {
    // Check if it's HTML or JSON
    if (rawResult.trim().startsWith('{')) {
      parsedData = JSON.parse(rawResult);
    }
  } catch (e) {
    // Not JSON, treat as HTML
  }
  
  const sanitizedHtml = sanitizeContent(rawResult);

  return {
    service: service,
    rawResult: rawResult,
    parsedData: parsedData,
    sanitizedHtml: sanitizedHtml,
    isHTML: !parsedData && rawResult.includes('<')
  };
}

module.exports = {
  parseAdditionalResults,
  formatAdditionalResult
};

