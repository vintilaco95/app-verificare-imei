const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const { defaultLang, supportedLangs, getTranslation } = require('./config/translations');
const { createSessionBridgeToken } = require('./services/sessionBridge');
require('dotenv').config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  app.set('trust proxy', 1);
}

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// IMPORTANT: Stripe webhook must be registered BEFORE express.json() middleware
// because it needs raw body for signature verification
const verifyRoutes = require('./routes/verify');
app.use('/verify/payment/webhook', express.raw({ type: 'application/json' }), verifyRoutes.webhookRouter);

// Middleware (after webhook)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration (MUST be before attachUser)
const sessionSecret = process.env.SESSION_SECRET || '';
if (!sessionSecret) {
  console.warn('⚠️ SESSION_SECRET is not set. Using fallback value for development purposes only.');
}

app.use(session({
  secret: sessionSecret || 'insecure-development-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/imei-verification'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'lax' : 'lax'
  }
}));

app.use((req, res, next) => {
  const host = (req.hostname || '').toLowerCase();
  const url = new URL(req.originalUrl || '/', `http://${host || 'localhost'}`);
  const originalSearchParams = new URLSearchParams(url.searchParams);

  // remove explicit lang param from toggle/base URLs
  url.searchParams.delete('lang');
  const sanitizedSearch = url.searchParams.toString();
  const sanitizedPath = `${url.pathname}${sanitizedSearch ? `?${sanitizedSearch}` : ''}`;

  let lang = defaultLang;

  if (req.session && req.session.lang && supportedLangs.includes(req.session.lang)) {
    lang = req.session.lang;
  } else if (host.endsWith('imeiguard.com')) {
    lang = 'en';
  } else if (host.endsWith('imeiguard.ro')) {
    lang = 'ro';
  }

  if (req.query.lang && supportedLangs.includes(req.query.lang)) {
    lang = req.query.lang;
    if (req.session) {
      req.session.lang = lang;
    }
  } else if (req.session && !req.session.lang) {
    req.session.lang = lang;
  }

  const sessionUserId = req.session && req.session.userId ? req.session.userId.toString() : null;
  const switchLang = lang === 'ro' ? 'en' : 'ro';
  const toggleSearchParams = new URLSearchParams(url.searchParams);
  toggleSearchParams.set('lang', switchLang);
  const togglePath = `${url.pathname}?${toggleSearchParams.toString()}`;

  if (originalSearchParams.get('lang') && originalSearchParams.get('lang') !== lang) {
    originalSearchParams.set('lang', lang);
  }

  const domainByLang = {
    ro: 'imeiguard.ro',
    en: 'imeiguard.com'
  };

  const protocol = isProduction ? 'https' : (req.protocol || 'http');
  const normalizedHost = host || '';
  const isProductionDomain = normalizedHost.endsWith('imeiguard.com') || normalizedHost.endsWith('imeiguard.ro');
  const targetDomain = domainByLang[switchLang];
  let langTogglePath = togglePath;

  if (isProductionDomain && targetDomain) {
    const redirectPath = togglePath;
    if (sessionUserId) {
      try {
        const bridgeToken = createSessionBridgeToken({
          userId: sessionUserId,
          lang: switchLang,
          redirectPath,
          targetDomain
        });
        langTogglePath = `${protocol}://${targetDomain}/auth/session-bridge?token=${encodeURIComponent(bridgeToken)}&redirect=${encodeURIComponent(redirectPath)}`;
      } catch (error) {
        console.error('[SessionBridge] Failed to create token:', error);
        langTogglePath = `${protocol}://${targetDomain}${redirectPath}`;
      }
    } else {
      langTogglePath = `${protocol}://${targetDomain}${redirectPath}`;
    }
  }

  res.locals.currentHost = host;
  res.locals.requestedPath = sanitizedPath || '/';
  res.locals.currentLang = lang;
  res.locals.currentLangLabel = getTranslation(lang, 'nav.language.current');
  res.locals.t = (key) => getTranslation(lang, key);
  res.locals.switchLang = switchLang;
  res.locals.switchLangLabel = getTranslation(switchLang, 'nav.language.current');
  res.locals.langTogglePath = langTogglePath;
  next();
});

// Attach user to all requests (MUST be after session)
const { attachUser } = require('./middleware/auth');
app.use(attachUser);

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Prea multe solicitări. Încearcă din nou în câteva momente.'
});

app.use('/verify/imei', verifyLimiter);
app.use('/verify/imei/guest', verifyLimiter);
app.use('/verify/imei/check', verifyLimiter);
app.use('/verify/enhance', verifyLimiter);

// CSRF protection
const csrfProtection = csrf({ cookie: false });
app.use((req, res, next) => {
  const skipPaths = ['/verify/payment/webhook'];
  const shouldSkip = skipPaths.some(path => req.path.startsWith(path)) || req.path.startsWith('/api/');
  if (shouldSkip) {
    return next();
  }
  return csrfProtection(req, res, next);
});

app.use((req, res, next) => {
  if (typeof req.csrfToken === 'function') {
    try {
      res.locals.csrfToken = req.csrfToken();
    } catch (err) {
      res.locals.csrfToken = '';
    }
  } else {
    res.locals.csrfToken = '';
  }
  next();
});

// CSRF error handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    const headerToken = req.headers['x-csrf-token'] || req.headers['csrf-token'] || req.headers['x-xsrf-token'];
    const bodyToken = req.body && req.body._csrf ? req.body._csrf : '';
    console.warn(`[CSRF] Invalid token for ${req.method} ${req.originalUrl}`);
    console.warn(`        header token: ${headerToken || 'N/A'}`);
    console.warn(`        body token: ${bodyToken || 'N/A'}`);
    console.warn(`        referer: ${req.headers.referer || 'N/A'}`);
    return res.status(403).render('error', {
      error: 'Tokenul de securitate a expirat sau nu este valid. Te rugăm să reîncarci pagina și să încerci din nou.',
      user: req.user || null
    });
  }
  return next(err);
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/imei-verification')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Test Redis connection at startup
try {
  const { queue } = require('./services/verificationQueue');
  console.log('✅ Redis queue initialized');
} catch (err) {
  console.error('⚠️ Redis queue initialization error:', err.message);
}

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/verify', verifyRoutes.router);
app.use('/dashboard', require('./routes/dashboard'));
app.use('/api', require('./routes/api'));
const adminRoutes = require('./routes/admin');
app.use('/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    error: err.message,
    user: req.user || null
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { user: req.user || null });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
