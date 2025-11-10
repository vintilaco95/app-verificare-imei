const CREDIT_VALUE = parseFloat(process.env.CREDIT_VALUE || '5');
const BASE_CURRENCY = (process.env.BASE_CURRENCY || 'RON').toUpperCase();
const GUEST_VERIFICATION_CREDITS = parseFloat(process.env.GUEST_VERIFICATION_CREDITS || '3');

module.exports = {
  CREDIT_VALUE,
  BASE_CURRENCY,
  GUEST_VERIFICATION_CREDITS
};

