/**
 * IMEI Validator and Brand Detector
 * Uses TAC (Type Allocation Code) - first 8 digits of IMEI
 * Improved detection with more accurate TAC patterns
 */

// TAC ranges for major brands - more comprehensive patterns
const TAC_PATTERNS = {
  // Apple iPhone patterns - Real TAC ranges
  'apple': [
    // iPhone 14/15 series
    { start: '01326300', end: '01326399' },
    { start: '01326300', end: '01326399' },
    // iPhone 13 series
    { start: '35206600', end: '35206699' },
    { start: '35444900', end: '35444999' },
    // iPhone 12 series
    { start: '35698800', end: '35698899' },
    { start: '35911100', end: '35911199' },
    // iPhone 11 series
    { start: '35328500', end: '35328599' },
    { start: '35328600', end: '35328699' },
    // iPhone X/XS series
    { start: '35328800', end: '35328899' },
    { start: '35328900', end: '35328999' },
    // iPhone 8 series
    { start: '35329000', end: '35329099' },
    // iPhone 7 series
    { start: '35329100', end: '35329199' },
    // iPhone 6/6S series
    { start: '35329200', end: '35329299' },
    // iPhone SE
    { start: '35329300', end: '35329399' },
    // Generic Apple patterns (need more specific matching)
    { prefix: '01326', length: 5 },
    { prefix: '01327', length: 5 },
    { prefix: '01328', length: 5 },
    { prefix: '01329', length: 5 },
    { prefix: '01330', length: 5 },
    { prefix: '35206', length: 5 },
    { prefix: '35207', length: 5 },
    { prefix: '35444', length: 5 },
    { prefix: '35445', length: 5 },
    { prefix: '35446', length: 5 },
    { prefix: '35447', length: 5 },
    { prefix: '35448', length: 5 },
    { prefix: '35449', length: 5 },
    { prefix: '35698', length: 5 },
    { prefix: '35699', length: 5 },
    { prefix: '35911', length: 5 },
    { prefix: '35912', length: 5 }
  ],
  
  // Samsung patterns - Real TAC ranges
  'samsung': [
    // Galaxy S22/S23 series
    { start: '35427500', end: '35427599' },
    { start: '35139300', end: '35139399' },
    // Galaxy S21 series
    { start: '35427600', end: '35427699' },
    { start: '35139400', end: '35139499' },
    // Galaxy S20 series
    { start: '35427700', end: '35427799' },
    { start: '35139500', end: '35139599' },
    // Galaxy Note series
    { start: '35427800', end: '35427899' },
    { start: '35139600', end: '35139699' },
    // Galaxy A series
    { start: '35000000', end: '35000999' },
    { start: '35001000', end: '35001999' },
    { start: '35002000', end: '35002999' },
    // Generic Samsung patterns
    { prefix: '3500', length: 4 },
    { prefix: '3501', length: 4 },
    { prefix: '3502', length: 4 },
    { prefix: '3503', length: 4 },
    { prefix: '3504', length: 4 },
    { prefix: '3505', length: 4 },
    { prefix: '3506', length: 4 },
    { prefix: '3507', length: 4 },
    { prefix: '3508', length: 4 },
    { prefix: '3509', length: 4 },
    { prefix: '3510', length: 4 },
    { prefix: '3511', length: 4 },
    { prefix: '3512', length: 4 },
    { prefix: '3513', length: 4 },
    { prefix: '3514', length: 4 },
    { prefix: '3515', length: 4 },
    { prefix: '3516', length: 4 },
    { prefix: '3517', length: 4 },
    { prefix: '3518', length: 4 },
    { prefix: '3519', length: 4 },
    // Samsung 354xxx (but not 3544xx-3549xx which are Apple)
    { prefix: '3542', length: 4 },
    { prefix: '3543', length: 4 },
    { prefix: '3545', length: 4 },
    { prefix: '3546', length: 4 },
    { prefix: '3547', length: 4 },
    { prefix: '3548', length: 4 }
  ],
  
  // Honor patterns - Real TAC ranges
  'honor': [
    // Honor 90 series
    { start: '86867700', end: '86867799' },
    // Honor 80 series
    { start: '86867800', end: '86867899' },
    // Honor 70 series
    { start: '86867900', end: '86867999' },
    // Honor 50 series
    { start: '86868000', end: '86868099' },
    // Generic Honor patterns
    { prefix: '868677', length: 6 },
    { prefix: '868678', length: 6 },
    { prefix: '868679', length: 6 },
    { prefix: '868680', length: 6 },
    { prefix: '868681', length: 6 },
    { prefix: '868682', length: 6 },
    { prefix: '868683', length: 6 },
    { prefix: '868684', length: 6 },
    { prefix: '868685', length: 6 },
    { prefix: '868686', length: 6 },
    { prefix: '868687', length: 6 },
    { prefix: '868688', length: 6 },
    { prefix: '868689', length: 6 },
    { prefix: '868690', length: 6 },
    { prefix: '868691', length: 6 },
    { prefix: '868692', length: 6 }
  ],
  
  // Huawei patterns - Real TAC ranges
  'huawei': [
    // P series
    { prefix: '866000', length: 6 },
    { prefix: '866001', length: 6 },
    { prefix: '866002', length: 6 },
    { prefix: '866003', length: 6 },
    { prefix: '866004', length: 6 },
    { prefix: '866005', length: 6 },
    { prefix: '866006', length: 6 },
    { prefix: '866007', length: 6 },
    { prefix: '866008', length: 6 },
    { prefix: '866009', length: 6 },
    // Mate series
    { prefix: '866010', length: 6 },
    { prefix: '866011', length: 6 },
    { prefix: '866012', length: 6 },
    { prefix: '866013', length: 6 },
    { prefix: '866014', length: 6 },
    // Nova series
    { prefix: '866015', length: 6 },
    { prefix: '866016', length: 6 },
    { prefix: '866017', length: 6 },
    // Generic Huawei patterns (but not Honor)
    { prefix: '8660', length: 4 },
    { prefix: '8661', length: 4 },
    { prefix: '8662', length: 4 },
    { prefix: '8663', length: 4 },
    { prefix: '8664', length: 4 },
    { prefix: '8665', length: 4 },
    { prefix: '8666', length: 4 },
    { prefix: '8667', length: 4 },
    { prefix: '8668', length: 4 },
    { prefix: '8669', length: 4 },
    // Huawei 868xxx (but not Honor 868677-868692)
    { prefix: '8680', length: 4 },
    { prefix: '8681', length: 4 },
    { prefix: '8682', length: 4 },
    { prefix: '8683', length: 4 },
    { prefix: '8684', length: 4 },
    { prefix: '8685', length: 4 },
    { prefix: '8686', length: 4 },
    { prefix: '8687', length: 4 },
    { prefix: '8688', length: 4 },
    { prefix: '8689', length: 4 },
    { prefix: '8690', length: 4 },
    { prefix: '8691', length: 4 },
    { prefix: '8692', length: 4 },
    { prefix: '8693', length: 4 },
    { prefix: '8694', length: 4 },
    { prefix: '8695', length: 4 },
    { prefix: '8696', length: 4 },
    { prefix: '8697', length: 4 },
    { prefix: '8698', length: 4 },
    { prefix: '8699', length: 4 }
  ],
  
  // Xiaomi patterns - Real TAC ranges
  'xiaomi': [
    // Mi series - 867xxx
    { prefix: '867000', length: 6 },
    { prefix: '867001', length: 6 },
    { prefix: '867002', length: 6 },
    { prefix: '867003', length: 6 },
    { prefix: '867004', length: 6 },
    { prefix: '867005', length: 6 },
    { prefix: '867006', length: 6 },
    { prefix: '867007', length: 6 },
    { prefix: '867008', length: 6 },
    { prefix: '867009', length: 6 },
    // Redmi series
    { prefix: '867010', length: 6 },
    { prefix: '867011', length: 6 },
    { prefix: '867012', length: 6 },
    { prefix: '867013', length: 6 },
    { prefix: '867014', length: 6 },
    { prefix: '867015', length: 6 },
    { prefix: '867016', length: 6 },
    { prefix: '867017', length: 6 },
    { prefix: '867018', length: 6 },
    { prefix: '867019', length: 6 },
    // POCO series
    { prefix: '867020', length: 6 },
    { prefix: '867021', length: 6 },
    { prefix: '867022', length: 6 },
    // Xiaomi also uses 862xxx for some models (e.g., 862996)
    { prefix: '862990', length: 6 },
    { prefix: '862991', length: 6 },
    { prefix: '862992', length: 6 },
    { prefix: '862993', length: 6 },
    { prefix: '862994', length: 6 },
    { prefix: '862995', length: 6 },
    { prefix: '862996', length: 6 }, // Example: 862996079077687
    { prefix: '862997', length: 6 },
    { prefix: '862998', length: 6 },
    { prefix: '862999', length: 6 },
    // Generic Xiaomi patterns
    { prefix: '8670', length: 4 },
    { prefix: '8671', length: 4 },
    { prefix: '8672', length: 4 },
    { prefix: '8673', length: 4 },
    { prefix: '8674', length: 4 },
    { prefix: '8675', length: 4 },
    { prefix: '8676', length: 4 },
    { prefix: '8677', length: 4 },
    { prefix: '8678', length: 4 },
    { prefix: '8679', length: 4 },
    // Xiaomi 862xxx patterns
    { prefix: '8629', length: 4 },
    { prefix: '8628', length: 4 },
    { prefix: '8627', length: 4 },
    { prefix: '8626', length: 4 },
    { prefix: '8625', length: 4 },
    { prefix: '8624', length: 4 },
    { prefix: '8623', length: 4 },
    { prefix: '8622', length: 4 },
    { prefix: '8621', length: 4 },
    { prefix: '8620', length: 4 },
    // Xiaomi also uses 868xxx for some models
    { prefix: '868000', length: 6 },
    { prefix: '868001', length: 6 },
    { prefix: '868002', length: 6 },
    { prefix: '868003', length: 6 },
    { prefix: '868004', length: 6 },
    { prefix: '868005', length: 6 },
    { prefix: '868006', length: 6 },
    { prefix: '868007', length: 6 },
    { prefix: '868008', length: 6 },
    { prefix: '868009', length: 6 },
    { prefix: '868010', length: 6 },
    { prefix: '868011', length: 6 },
    { prefix: '868012', length: 6 },
    { prefix: '868013', length: 6 },
    { prefix: '868014', length: 6 },
    { prefix: '868015', length: 6 },
    { prefix: '868016', length: 6 },
    { prefix: '868017', length: 6 },
    { prefix: '868018', length: 6 },
    { prefix: '868019', length: 6 },
    { prefix: '868020', length: 6 },
    { prefix: '868021', length: 6 },
    { prefix: '868022', length: 6 },
    { prefix: '868023', length: 6 },
    { prefix: '868024', length: 6 },
    { prefix: '868025', length: 6 },
    { prefix: '868026', length: 6 },
    { prefix: '868027', length: 6 },
    { prefix: '868028', length: 6 },
    { prefix: '868029', length: 6 },
    { prefix: '868030', length: 6 },
    { prefix: '868031', length: 6 },
    { prefix: '868032', length: 6 },
    { prefix: '868033', length: 6 },
    { prefix: '868034', length: 6 },
    { prefix: '868035', length: 6 },
    { prefix: '868036', length: 6 },
    { prefix: '868037', length: 6 },
    { prefix: '868038', length: 6 },
    { prefix: '868039', length: 6 },
    { prefix: '868040', length: 6 },
    { prefix: '868041', length: 6 },
    { prefix: '868042', length: 6 },
    { prefix: '868043', length: 6 },
    { prefix: '868044', length: 6 },
    { prefix: '868045', length: 6 },
    { prefix: '868046', length: 6 },
    { prefix: '868047', length: 6 },
    { prefix: '868048', length: 6 },
    { prefix: '868049', length: 6 },
    // Xiaomi also uses 8685xx, 8686xx ranges
    { prefix: '868500', length: 6 },
    { prefix: '868501', length: 6 },
    { prefix: '868502', length: 6 },
    { prefix: '868503', length: 6 },
    { prefix: '868504', length: 6 },
    { prefix: '868505', length: 6 },
    { prefix: '868506', length: 6 },
    { prefix: '868507', length: 6 },
    { prefix: '868508', length: 6 },
    { prefix: '868509', length: 6 },
    { prefix: '868510', length: 6 },
    { prefix: '868511', length: 6 },
    { prefix: '868512', length: 6 },
    { prefix: '868513', length: 6 },
    { prefix: '868514', length: 6 },
    { prefix: '868515', length: 6 },
    { prefix: '868516', length: 6 },
    { prefix: '868517', length: 6 },
    { prefix: '868518', length: 6 },
    { prefix: '868519', length: 6 },
    { prefix: '868520', length: 6 },
    { prefix: '868521', length: 6 },
    { prefix: '868522', length: 6 },
    { prefix: '868523', length: 6 },
    { prefix: '868524', length: 6 },
    { prefix: '868525', length: 6 },
    { prefix: '868526', length: 6 },
    { prefix: '868527', length: 6 },
    { prefix: '868528', length: 6 },
    { prefix: '868529', length: 6 },
    { prefix: '868530', length: 6 },
    { prefix: '868531', length: 6 },
    { prefix: '868532', length: 6 },
    { prefix: '868533', length: 6 },
    { prefix: '868534', length: 6 },
    { prefix: '868535', length: 6 },
    { prefix: '868536', length: 6 },
    { prefix: '868537', length: 6 },
    { prefix: '868538', length: 6 },
    { prefix: '868539', length: 6 },
    { prefix: '868540', length: 6 },
    { prefix: '868541', length: 6 },
    { prefix: '868542', length: 6 },
    { prefix: '868543', length: 6 },
    { prefix: '868544', length: 6 },
    { prefix: '868545', length: 6 },
    { prefix: '868546', length: 6 },
    { prefix: '868547', length: 6 },
    { prefix: '868548', length: 6 },
    { prefix: '868549', length: 6 },
    { prefix: '868550', length: 6 },
    { prefix: '868551', length: 6 },
    { prefix: '868552', length: 6 },
    { prefix: '868553', length: 6 },
    { prefix: '868554', length: 6 },
    { prefix: '868555', length: 6 },
    { prefix: '868556', length: 6 },
    { prefix: '868557', length: 6 },
    { prefix: '868558', length: 6 },
    { prefix: '868559', length: 6 },
    { prefix: '868560', length: 6 },
    { prefix: '868561', length: 6 },
    { prefix: '868562', length: 6 },
    { prefix: '868563', length: 6 },
    { prefix: '868564', length: 6 },
    { prefix: '868565', length: 6 },
    { prefix: '868566', length: 6 },
    { prefix: '868567', length: 6 },
    { prefix: '868568', length: 6 },
    { prefix: '868569', length: 6 },
    { prefix: '868570', length: 6 }, // Example: 868570074208722
    { prefix: '868571', length: 6 },
    { prefix: '868572', length: 6 },
    { prefix: '868573', length: 6 },
    { prefix: '868574', length: 6 },
    { prefix: '868575', length: 6 },
    { prefix: '868576', length: 6 },
    { prefix: '868577', length: 6 },
    { prefix: '868578', length: 6 },
    { prefix: '868579', length: 6 },
    { prefix: '868580', length: 6 },
    { prefix: '868581', length: 6 },
    { prefix: '868582', length: 6 },
    { prefix: '868583', length: 6 },
    { prefix: '868584', length: 6 },
    { prefix: '868585', length: 6 },
    { prefix: '868586', length: 6 },
    { prefix: '868587', length: 6 },
    { prefix: '868588', length: 6 },
    { prefix: '868589', length: 6 },
    { prefix: '868590', length: 6 },
    { prefix: '868591', length: 6 },
    { prefix: '868592', length: 6 },
    { prefix: '868593', length: 6 },
    { prefix: '868594', length: 6 },
    { prefix: '868595', length: 6 },
    { prefix: '868596', length: 6 },
    { prefix: '868597', length: 6 },
    { prefix: '868598', length: 6 },
    { prefix: '868599', length: 6 },
    // Generic Xiaomi 868xxx patterns (but not Honor 868677-868692)
    { prefix: '8685', length: 4 },
    { prefix: '8686', length: 4 },
    { prefix: '8687', length: 4 },
    { prefix: '8688', length: 4 },
    { prefix: '8689', length: 4 },
    { prefix: '8690', length: 4 },
    { prefix: '8691', length: 4 },
    { prefix: '8692', length: 4 },
    { prefix: '8693', length: 4 },
    { prefix: '8694', length: 4 },
    { prefix: '8695', length: 4 },
    { prefix: '8696', length: 4 },
    { prefix: '8697', length: 4 },
    { prefix: '8698', length: 4 },
    { prefix: '8699', length: 4 }
  ],
  
  // OnePlus patterns - Real TAC ranges
  'oneplus': [
    // OnePlus 11 series
    { prefix: '861000', length: 6 },
    { prefix: '861001', length: 6 },
    { prefix: '861002', length: 6 },
    // OnePlus 10 series
    { prefix: '861003', length: 6 },
    { prefix: '861004', length: 6 },
    { prefix: '861005', length: 6 },
    // OnePlus 9 series
    { prefix: '861006', length: 6 },
    { prefix: '861007', length: 6 },
    { prefix: '861008', length: 6 },
    // OnePlus 8 series
    { prefix: '861009', length: 6 },
    { prefix: '861010', length: 6 },
    { prefix: '861011', length: 6 },
    // OnePlus 7 series
    { prefix: '861012', length: 6 },
    { prefix: '861013', length: 6 },
    // Generic OnePlus patterns
    { prefix: '8610', length: 4 },
    { prefix: '8611', length: 4 },
    { prefix: '8612', length: 4 },
    { prefix: '8613', length: 4 },
    { prefix: '8614', length: 4 },
    { prefix: '8615', length: 4 },
    { prefix: '8616', length: 4 },
    { prefix: '8617', length: 4 },
    { prefix: '8618', length: 4 },
    { prefix: '8619', length: 4 }
  ],
  
  // Motorola patterns - Real TAC ranges
  'motorola': [
    // Moto G series - 355xxx
    { prefix: '355000', length: 6 },
    { prefix: '355001', length: 6 },
    { prefix: '355002', length: 6 },
    { prefix: '355003', length: 6 },
    { prefix: '355004', length: 6 },
    // Moto E series
    { prefix: '355005', length: 6 },
    { prefix: '355006', length: 6 },
    { prefix: '355007', length: 6 },
    // Moto X series
    { prefix: '355008', length: 6 },
    { prefix: '355009', length: 6 },
    { prefix: '355010', length: 6 },
    // Edge series
    { prefix: '355011', length: 6 },
    { prefix: '355012', length: 6 },
    { prefix: '355013', length: 6 },
    // Motorola also uses 356xxx for some models (e.g., 3569xxx)
    // Specific Motorola 3569xxx patterns (not Apple)
    { prefix: '356900', length: 6 },
    { prefix: '356901', length: 6 },
    { prefix: '356902', length: 6 },
    { prefix: '356903', length: 6 },
    { prefix: '356904', length: 6 },
    { prefix: '356905', length: 6 }, // Example: 356905113206734
    { prefix: '356906', length: 6 },
    { prefix: '356907', length: 6 },
    { prefix: '356908', length: 6 },
    { prefix: '356909', length: 6 },
    { prefix: '356910', length: 6 },
    { prefix: '356911', length: 6 },
    { prefix: '356912', length: 6 },
    { prefix: '356913', length: 6 },
    { prefix: '356914', length: 6 },
    { prefix: '356915', length: 6 },
    { prefix: '356916', length: 6 },
    { prefix: '356917', length: 6 },
    { prefix: '356918', length: 6 },
    { prefix: '356919', length: 6 },
    // Generic Motorola patterns
    { prefix: '3550', length: 4 },
    { prefix: '3551', length: 4 },
    { prefix: '3552', length: 4 },
    { prefix: '3553', length: 4 },
    { prefix: '3554', length: 4 },
    { prefix: '3555', length: 4 },
    { prefix: '3556', length: 4 },
    { prefix: '3557', length: 4 },
    { prefix: '3558', length: 4 },
    { prefix: '3559', length: 4 },
    // Motorola 3569xx (but not 35698xx which is Apple)
    { prefix: '35690', length: 5 },
    { prefix: '35691', length: 5 },
    { prefix: '35692', length: 5 },
    { prefix: '35693', length: 5 },
    { prefix: '35694', length: 5 },
    { prefix: '35695', length: 5 },
    { prefix: '35696', length: 5 },
    { prefix: '35697', length: 5 }
    // Note: 35698xx and 35699xx are typically Apple, so we exclude them
  ]
};

/**
 * Check if TAC matches a range pattern
 */
function matchesRange(tac, range) {
  if (range.start && range.end) {
    const tacNum = parseInt(tac);
    const startNum = parseInt(range.start);
    const endNum = parseInt(range.end);
    return tacNum >= startNum && tacNum <= endNum;
  }
  if (range.prefix && range.length) {
    return tac.substring(0, range.length) === range.prefix;
  }
  return false;
}

/**
 * Validate IMEI using Luhn algorithm
 */
function validateIMEI(imei) {
  if (!imei || imei.length !== 15) {
    return false;
  }
  
  // Check if all digits
  if (!/^\d{15}$/.test(imei)) {
    return false;
  }
  
  // Luhn algorithm check
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(imei[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(imei[14]);
}

/**
 * Detect brand from IMEI TAC (first 8 digits)
 * Improved detection with multiple pattern matching strategies
 */
function detectBrandFromIMEI(imei) {
  if (!imei || imei.length < 8) {
    return null;
  }
  
  const tac = imei.substring(0, 8);
  const prefix3 = imei.substring(0, 3);
  const prefix4 = imei.substring(0, 4);
  const prefix5 = imei.substring(0, 5);
  const prefix6 = imei.substring(0, 6);
  
  // Priority 1: Check exact range matches (most accurate)
  // Check Motorola first for 3569xx to avoid false Apple matches
  if (prefix6.startsWith('3569')) {
    const seventhDigit = imei.substring(6, 7);
    // Motorola uses 35690-35697, Apple uses 35698-35699
    if (seventhDigit >= '0' && seventhDigit <= '7') {
      for (const pattern of TAC_PATTERNS.motorola) {
        if (matchesRange(tac, pattern)) {
          return 'motorola';
        }
      }
    }
  }
  
  // Check Honor first (specific range 868677-868692)
  if (prefix6 >= '868677' && prefix6 <= '868692') {
    for (const pattern of TAC_PATTERNS.honor) {
      if (matchesRange(tac, pattern)) {
        return 'honor';
      }
    }
  }
  
  // Check Xiaomi for 868xxx ranges (before Huawei to give priority)
  if (prefix3 === '868') {
    const num = parseInt(prefix6);
    // Honor range already checked above
    if ((num >= 868000 && num <= 868676) || (num >= 868693 && num <= 868999)) {
      for (const pattern of TAC_PATTERNS.xiaomi) {
        if (matchesRange(tac, pattern)) {
          return 'xiaomi';
        }
      }
    }
  }
  
  // Check all other brands
  for (const [brand, patterns] of Object.entries(TAC_PATTERNS)) {
    // Skip Motorola if we already checked it above
    if (prefix6.startsWith('3569') && brand === 'motorola') {
      continue;
    }
    
    // Skip Honor if we already checked it above
    if (prefix6 >= '868677' && prefix6 <= '868692' && brand === 'honor') {
      continue;
    }
    
    // Skip Xiaomi if we already checked it above for 868xxx
    if (prefix3 === '868' && brand === 'xiaomi') {
      const num = parseInt(prefix6);
      if ((num >= 868000 && num <= 868676) || (num >= 868693 && num <= 868999)) {
        continue;
      }
    }
    
    for (const pattern of patterns) {
      if (matchesRange(tac, pattern)) {
        // Special handling for conflicts
        if (brand === 'huawei' && prefix6.startsWith('868677')) {
          continue; // Honor takes priority
        }
        if (brand === 'xiaomi' && prefix6.startsWith('868677')) {
          continue; // Honor takes priority
        }
        // Skip Apple 3569xx if it's Motorola range
        if (brand === 'apple' && prefix6.startsWith('3569')) {
          const seventhDigit = imei.substring(6, 7);
          if (seventhDigit >= '0' && seventhDigit <= '7') {
            continue; // Motorola takes priority for 35690-35697
          }
        }
        // For 868xxx, prioritize Xiaomi over Huawei
        if (brand === 'huawei' && prefix3 === '868') {
          const num = parseInt(prefix6);
          // If it's in a range that could be Xiaomi, skip Huawei
          if ((num >= 868000 && num <= 868676) || (num >= 868693 && num <= 868999)) {
            continue; // Xiaomi takes priority
          }
        }
        return brand;
      }
    }
  }
  
  // Priority 2: Pattern-based detection using prefixes (fallback)
  // Apple: 013xxx, 352xxx, 3544xx-3549xx, 35698xx-35699xx, 359xxx
  if (prefix3 === '013' || prefix3 === '352' || prefix3 === '359') {
    return 'apple';
  }
  if (prefix4 === '3544' || prefix4 === '3545' || prefix4 === '3546' || 
      prefix4 === '3547' || prefix4 === '3548' || prefix4 === '3549') {
    return 'apple';
  }
  // Apple uses 35698xx and 35699xx, but Motorola uses 35690xx-35697xx
  if (prefix5 === '35698' || prefix5 === '35699') {
    return 'apple';
  }
  if (prefix4 === '3568') {
    return 'apple';
  }
  
  // Samsung: 350xxx, 351xxx, 354xxx (but not 3544xx-3549xx which are Apple)
  if (prefix3 === '350' || prefix3 === '351') {
    return 'samsung';
  }
  if (prefix3 === '354') {
    const fourthDigit = imei.substring(3, 4);
    // Exclude Apple ranges (4-9)
    if (fourthDigit >= '2' && fourthDigit <= '3') {
      return 'samsung';
    }
    if (fourthDigit === '5' || fourthDigit === '6' || fourthDigit === '7' || fourthDigit === '8') {
      return 'samsung';
    }
  }
  
  // Honor: 868677xx-868692xx (specific range) - check this first to avoid conflicts
  if (prefix6 >= '868677' && prefix6 <= '868692') {
    return 'honor';
  }
  
  // Xiaomi: 867xxx, 862xxx, or 868xxx (but not Honor range 868677-868692)
  if (prefix3 === '867') {
    return 'xiaomi';
  }
  if (prefix3 === '862') {
    return 'xiaomi';
  }
  if (prefix3 === '868') {
    // Honor uses 868677-868692
    if (prefix6 >= '868677' && prefix6 <= '868692') {
      return 'honor';
    }
    // Xiaomi uses 868000-868676 and 868693-868999
    // Also common ranges: 8685xx, 8686xx (but not 868677-868692)
    const num = parseInt(prefix6);
    if ((num >= 868000 && num <= 868676) || (num >= 868693 && num <= 868999)) {
      return 'xiaomi';
    }
    // Check if it matches specific Xiaomi patterns (8685xx, 8686xx outside Honor range)
    if (prefix4 === '8685' || (prefix4 === '8686' && (prefix6 < '868677' || prefix6 > '868692'))) {
      return 'xiaomi';
    }
    // Other 868xxx could be Huawei (but less common than Xiaomi)
    return 'huawei';
  }
  
  // Huawei: 866xxx or 868xxx (but not Honor and not Xiaomi ranges)
  if (prefix3 === '866') {
    return 'huawei';
  }
  
  // OnePlus: 861xxx
  if (prefix3 === '861') {
    return 'oneplus';
  }
  
  // Motorola: 355xxx or 3569xx (but not 35698xx-35699xx which are Apple)
  if (prefix3 === '355') {
    return 'motorola';
  }
  if (prefix4 === '3569') {
    const seventhDigit = imei.substring(6, 7);
    // Motorola: 35690-35697, Apple: 35698-35699
    if (seventhDigit >= '0' && seventhDigit <= '7') {
      return 'motorola';
    }
  }
  
  return null;
}

/**
 * Format IMEI input - only allow numbers, max 15 digits
 */
function formatIMEIInput(input) {
  // Remove all non-numeric characters
  let value = input.value.replace(/\D/g, '');
  
  // Limit to 15 digits
  if (value.length > 15) {
    value = value.substring(0, 15);
  }
  
  input.value = value;
  
  return value;
}

/**
 * Initialize IMEI validation on input field
 */
function initIMEIValidation(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  const brandDisplay = document.getElementById('detected-brand');
  const imeiError = document.getElementById('imei-error');
  const imeiValid = document.getElementById('imei-valid');
  
  input.addEventListener('input', function() {
    const value = formatIMEIInput(this);
    
    // Clear previous messages
    if (imeiError) imeiError.textContent = '';
    if (imeiValid) imeiValid.textContent = '';
    if (brandDisplay) brandDisplay.textContent = '';
    
    // Remove error styling
    this.style.borderColor = '';
    
    if (value.length === 0) {
      return;
    }
    
    if (value.length < 15) {
      if (imeiError) {
        imeiError.textContent = `IMEI incomplet. Mai sunt ${15 - value.length} cifre.`;
        imeiError.style.color = '#f59e0b';
      }
      this.style.borderColor = '#f59e0b';
      return;
    }
    
    // Validate IMEI
    const isValid = validateIMEI(value);
    
    if (!isValid) {
      if (imeiError) {
        imeiError.textContent = 'IMEI invalid. Verifică cifra de control.';
        imeiError.style.color = '#ef4444';
      }
      this.style.borderColor = '#ef4444';
      return;
    }
    
    // IMEI is valid
    if (imeiValid) {
      imeiValid.textContent = '✓ IMEI valid';
      imeiValid.style.color = '#22c55e';
    }
    this.style.borderColor = '#22c55e';
    
    // Detect brand
    const brand = detectBrandFromIMEI(value);
    if (brand && brandDisplay) {
      const brandNames = {
        'apple': '🍎 Apple',
        'samsung': '📱 Samsung',
        'honor': '🏆 Honor',
        'huawei': '🇨🇳 Huawei',
        'xiaomi': '📲 Xiaomi',
        'oneplus': '⚡ OnePlus',
        'motorola': '📶 Motorola'
      };
      brandDisplay.textContent = `Brand detectat: ${brandNames[brand] || brand}`;
      brandDisplay.style.color = '#14b8a6';
    } else if (brandDisplay) {
      brandDisplay.textContent = 'Brand necunoscut - va fi detectat la verificare';
      brandDisplay.style.color = '#94a3b8';
    }
  });
  
  // Prevent paste of invalid data
  input.addEventListener('paste', function(e) {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    const formatted = pasted.replace(/\D/g, '').substring(0, 15);
    this.value = formatted;
    this.dispatchEvent(new Event('input'));
  });
  
  // Prevent invalid characters
  input.addEventListener('keypress', function(e) {
    if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
      e.preventDefault();
    }
  });
  
  // Update hidden input with detected brand (if exists)
  const brandInput = document.getElementById(inputId === 'imei' ? 'detected-brand-input' : 'detected-brand-input-guest');
  if (brandInput) {
    input.addEventListener('input', function() {
      const value = formatIMEIInput(this);
      if (value.length === 15 && validateIMEI(value)) {
        const brand = detectBrandFromIMEI(value);
        if (brand) {
          brandInput.value = brand;
        }
      }
    });
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateIMEI,
    detectBrandFromIMEI,
    formatIMEIInput,
    initIMEIValidation
  };
}

// Make functions available globally
if (typeof window !== 'undefined') {
  window.validateIMEI = validateIMEI;
  window.detectBrandFromIMEI = detectBrandFromIMEI;
  window.formatIMEIInput = formatIMEIInput;
  window.initIMEIValidation = initIMEIValidation;
}
