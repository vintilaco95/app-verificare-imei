/**
 * Throttling configuration for external IMEI services.
 * Limits are derived from provider recommendations.
 */

const SERVICE_LIMITS = {
  1: { maxConcurrent: 3, minTime: 0 },
  2: { maxConcurrent: 5, minTime: 0 },
  3: { maxConcurrent: 6, minTime: 0 },
  4: { maxConcurrent: 4, minTime: 0 },
  5: { maxConcurrent: 4, minTime: 0 },
  6: { maxConcurrent: 3, minTime: 0 },
  8: { maxConcurrent: 6, minTime: 0 },
  9: { maxConcurrent: 2, minTime: 0 },
  10: { maxConcurrent: 10, minTime: 0 },
  11: { maxConcurrent: 15, minTime: 0 },
  12: { maxConcurrent: 2, minTime: 0 },
  13: { maxConcurrent: 3, minTime: 0 },
  14: { maxConcurrent: 10, minTime: 0 },
  15: { maxConcurrent: 3, minTime: 0 },
  16: { maxConcurrent: 4, minTime: 0 },
  17: { maxConcurrent: 5, minTime: 0 },
  18: { maxConcurrent: 2, minTime: 0 },
  19: { maxConcurrent: 3, minTime: 0 },
  20: { maxConcurrent: 4, minTime: 0 },
  21: { maxConcurrent: 5, minTime: 0 },
  22: { maxConcurrent: 5, minTime: 0 },
  23: { maxConcurrent: 3, minTime: 0 },
  25: { maxConcurrent: 4, minTime: 0 },
  27: { maxConcurrent: 2, minTime: 0 },
  33: { maxConcurrent: 4, minTime: 0 },
  34: { maxConcurrent: 4, minTime: 0 },
  36: { maxConcurrent: 2, minTime: 0 },
  37: { maxConcurrent: 3, minTime: 0 },
  39: { maxConcurrent: 3, minTime: 0 },
  41: { maxConcurrent: 2, minTime: 0 },
  46: { maxConcurrent: 3, minTime: 0 },
  47: { maxConcurrent: 2, minTime: 0 },
  51: { maxConcurrent: 15, minTime: 0 },
  52: { maxConcurrent: 3, minTime: 0 },
  53: { maxConcurrent: 3, minTime: 0 },
  55: { maxConcurrent: 4, minTime: 0 },
  57: { maxConcurrent: 3, minTime: 0 },
  58: { maxConcurrent: 3, minTime: 0 },
  61: { maxConcurrent: 3, minTime: 0 },
  62: { maxConcurrent: 3, minTime: 0 },
  63: { maxConcurrent: 3, minTime: 0 },
  64: { maxConcurrent: 2, minTime: 0 },
  67: { maxConcurrent: 5, minTime: 0 },
  69: { maxConcurrent: 3, minTime: 0 }
};

module.exports = {
  SERVICE_LIMITS
};

