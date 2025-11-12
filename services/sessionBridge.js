const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET || 'insecure-development-secret';
const DEFAULT_TTL_SECONDS = parseInt(process.env.SESSION_BRIDGE_TTL || '60', 10);

const base64UrlEncode = (input) => {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const base64UrlDecode = (input) => {
  const padLength = (4 - (input.length % 4)) % 4;
  const normalized = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(input.length + padLength, '=');
  return Buffer.from(normalized, 'base64').toString('utf8');
};

const sanitizeRedirectPath = (redirectPath) => {
  if (!redirectPath || typeof redirectPath !== 'string') {
    return '/';
  }
  if (!redirectPath.startsWith('/')) {
    return '/';
  }
  try {
    const url = new URL(redirectPath, 'http://example.com');
    const safePath = url.pathname || '/';
    const safeSearch = url.search || '';
    return `${safePath}${safeSearch}`;
  } catch (err) {
    return '/';
  }
};

const createSessionBridgeToken = ({
  userId,
  lang,
  redirectPath = '/',
  targetDomain,
  expiresIn = DEFAULT_TTL_SECONDS
}) => {
  if (!userId) {
    throw new Error('Cannot create session bridge token without userId');
  }

  const issuedAt = Date.now();
  const expiresAt = issuedAt + Math.max(10, expiresIn) * 1000;
  const payload = {
    userId: String(userId),
    lang: lang || null,
    redirectPath: sanitizeRedirectPath(redirectPath),
    targetDomain: targetDomain || null,
    issuedAt
  };

  const payloadString = JSON.stringify(payload);
  const signatureInput = `${payloadString}.${expiresAt}`;
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(signatureInput).digest('hex');

  const token = `${base64UrlEncode(payloadString)}.${expiresAt}.${signature}`;
  return token;
};

const verifySessionBridgeToken = (token, currentHost) => {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'TOKEN_MISSING' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'TOKEN_MALFORMED' };
  }

  const [payloadPart, expiresPart, signaturePart] = parts;
  const expiresAt = parseInt(expiresPart, 10);

  if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
    return { valid: false, error: 'TOKEN_EXPIRED' };
  }

  let payloadString;
  try {
    payloadString = base64UrlDecode(payloadPart);
  } catch (err) {
    return { valid: false, error: 'TOKEN_DECODE_FAILED' };
  }

  const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET)
    .update(`${payloadString}.${expiresAt}`)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signaturePart), Buffer.from(expectedSignature))) {
    return { valid: false, error: 'TOKEN_INVALID_SIGNATURE' };
  }

  let payload;
  try {
    payload = JSON.parse(payloadString);
  } catch (err) {
    return { valid: false, error: 'TOKEN_PAYLOAD_INVALID' };
  }

  if (!payload || !payload.userId) {
    return { valid: false, error: 'TOKEN_PAYLOAD_MISSING_USER' };
  }

  if (payload.targetDomain && currentHost) {
    const normalizedHost = currentHost.toLowerCase();
    if (!normalizedHost.endsWith(payload.targetDomain.toLowerCase())) {
      return { valid: false, error: 'TOKEN_DOMAIN_MISMATCH' };
    }
  }

  payload.redirectPath = sanitizeRedirectPath(payload.redirectPath);

  return {
    valid: true,
    payload,
    expiresAt
  };
};

module.exports = {
  createSessionBridgeToken,
  verifySessionBridgeToken
};

