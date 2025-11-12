const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireGuest } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { sendVerificationEmail } = require('../services/emailService');

const emailNormalizeOptions = {
  gmail_remove_dots: false,
  gmail_remove_subaddress: false,
  gmail_remove_extension: false
};

const CODE_TTL = parseInt(process.env.EMAIL_VERIFICATION_CODE_TTL || '600000', 10);
const CODE_TTL_MINUTES = Math.max(1, Math.round(CODE_TTL / 60000));
const MAX_CODE_ATTEMPTS = Math.max(3, parseInt(process.env.EMAIL_VERIFICATION_MAX_ATTEMPTS || '5', 10));

const getTranslator = (res) => (typeof res.locals.t === 'function' ? res.locals.t : (key) => key);
const generateVerificationCode = () => String(crypto.randomInt(100000, 1000000)).padStart(6, '0');
const codeExpiresAt = () => new Date(Date.now() + CODE_TTL);

const renderVerifyCodeView = (res, payload = {}) => {
  const t = getTranslator(res);
  return res.render('auth/verify-code', {
    title: t('auth.verifyCode.pageTitle'),
    email: payload.email || '',
    errors: payload.errors || null,
    success: payload.success || null,
    user: null
  });
};

async function sendVerificationCodeForExistingUser(user, res) {
  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, 10);
  const emailResult = await sendVerificationEmail(user.email, code, {
    lang: res.locals.currentLang || 'ro',
    ttlMinutes: CODE_TTL_MINUTES
  });

  if (emailResult.success) {
    user.verificationCode = codeHash;
    user.verificationCodeExpires = codeExpiresAt();
    user.verificationAttempts = 0;
    await user.save();
  }

  return emailResult;
}

// Register
router.get('/register', requireGuest, (req, res) => {
  res.render('auth/register', {
    title: 'Înregistrare',
    errors: null,
    user: null
  });
});

router.post('/register', requireGuest, [
  body('email').isEmail().normalizeEmail(emailNormalizeOptions),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('auth/register', {
      title: 'Înregistrare',
      errors: errors.array(),
      user: null
    });
  }

  try {
    const { email, password } = req.body;
    const t = getTranslator(res);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (!existingUser.isVerified) {
        const emailResult = await sendVerificationCodeForExistingUser(existingUser, res);
        if (!emailResult.success) {
          console.error('[Auth] Failed to resend verification code:', emailResult.error);
          return renderVerifyCodeView(res, {
            email: existingUser.email,
            errors: [{ msg: t('auth.verifyCode.error.sendFailed') }]
          });
        }

        return renderVerifyCodeView(res, {
          email: existingUser.email,
          success: t('auth.verifyCode.success.resent')
        });
      }

      return res.render('auth/register', {
        title: 'Înregistrare',
        errors: [{ msg: t('auth.register.errors.emailExists') || 'Email-ul este deja înregistrat' }],
        user: null
      });
    }

    const verificationCodeRaw = generateVerificationCode();
    const verificationCodeHash = await bcrypt.hash(verificationCodeRaw, 10);

    const user = new User({
      email,
      password,
      isVerified: false,
      verificationCode: verificationCodeHash,
      verificationCodeExpires: codeExpiresAt(),
      verificationAttempts: 0
    });
    await user.save();

    const emailResult = await sendVerificationEmail(email, verificationCodeRaw, {
      lang: res.locals.currentLang || 'ro',
      ttlMinutes: CODE_TTL_MINUTES
    });

    const viewPayload = {
      email,
      success: emailResult.success ? t('auth.verifyCode.success.sent') : null,
      errors: emailResult.success ? null : [{ msg: t('auth.verifyCode.error.sendFailed') }]
    };

    return renderVerifyCodeView(res, viewPayload);
  } catch (error) {
    console.error('Registration error:', error);
    return res.render('auth/register', {
      title: 'Înregistrare',
      errors: [{ msg: 'Eroare la înregistrare. Încearcă din nou.' }],
      user: null
    });
  }
});

// Login
router.get('/login', requireGuest, (req, res) => {
  res.render('auth/login', {
    title: 'Autentificare',
    errors: null,
    user: null
  });
});

router.post('/login', requireGuest, [
  body('email').isEmail().normalizeEmail(emailNormalizeOptions),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('auth/login', {
      title: 'Autentificare',
      errors: errors.array(),
      user: null
    });
  }

  try {
    const { email, password } = req.body;
    const t = getTranslator(res);
    
    const user = await User.findOne({ email });
    if (!user) {
      console.warn(`[AUTH] Failed login attempt for unknown email: ${email}`);
      return res.render('auth/login', {
        title: 'Autentificare',
        errors: [{ msg: 'Email sau parolă incorectă' }],
        user: null
      });
    }

    if (user.isBanned) {
      console.warn(`[AUTH] Banned user login attempt: ${email}`);
      return res.render('auth/login', {
        title: 'Autentificare',
        errors: [{ msg: 'Contul tău a fost dezactivat. Contactează suportul.' }],
        user: null
      });
    }
    
    if (!user.isVerified) {
      console.warn(`[AUTH] Unverified user login attempt: ${email}`);
      const emailResult = await sendVerificationCodeForExistingUser(user, res);
      return renderVerifyCodeView(res, {
        email,
        errors: emailResult.success ? null : [{ msg: t('auth.verifyCode.error.sendFailed') }],
        success: emailResult.success ? t('auth.verifyCode.success.resent') : null
      });
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.warn(`[AUTH] Failed login attempt for email: ${email}`);
      return res.render('auth/login', {
        title: 'Autentificare',
        errors: [{ msg: 'Email sau parolă incorectă' }],
        user: null
      });
    }
    
    req.session.userId = user._id;
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    return res.render('auth/login', {
      title: 'Autentificare',
      errors: [{ msg: 'Eroare la autentificare. Încearcă din nou.' }],
      user: null
    });
  }
});

router.get('/verify-code', requireGuest, (req, res) => {
  const email = req.query.email ? req.query.email.toString().trim() : '';
  const status = req.query.status || '';
  const t = getTranslator(res);

  const payload = { email };
  if (status === 'sent') {
    payload.success = t('auth.verifyCode.success.sent');
  } else if (status === 'resent') {
    payload.success = t('auth.verifyCode.success.resent');
  }

  return renderVerifyCodeView(res, payload);
});

router.post('/verify-code', requireGuest, [
  body('email').isEmail().normalizeEmail(emailNormalizeOptions),
  body('code').trim().matches(/^[0-9]{6}$/).withMessage('Codul trebuie să conțină 6 cifre')
], async (req, res) => {
  const t = getTranslator(res);
  const { email, code } = req.body;
  const validationErrors = validationResult(req);

  if (!validationErrors.isEmpty()) {
    return renderVerifyCodeView(res, {
      email,
      errors: validationErrors.array()
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return renderVerifyCodeView(res, {
        email,
        errors: [{ msg: t('auth.verifyCode.error.userNotFound') }]
      });
    }

    if (user.isVerified) {
      return res.render('auth/login', {
        title: t('auth.login.pageTitle'),
        success: t('auth.verifyCode.success.alreadyVerified'),
        errors: null,
        user: null
      });
    }

    if (!user.verificationCode || !user.verificationCodeExpires || user.verificationCodeExpires < new Date()) {
      const emailResult = await sendVerificationCodeForExistingUser(user, res);
      return renderVerifyCodeView(res, {
        email,
        errors: [{ msg: t('auth.verifyCode.error.expired') }],
        success: emailResult.success ? t('auth.verifyCode.success.resent') : null
      });
    }

    const isMatch = await bcrypt.compare(code, user.verificationCode);
    if (!isMatch) {
      user.verificationAttempts = (user.verificationAttempts || 0) + 1;
      await user.save();

      if (user.verificationAttempts >= MAX_CODE_ATTEMPTS) {
        const emailResult = await sendVerificationCodeForExistingUser(user, res);
        return renderVerifyCodeView(res, {
          email,
          errors: [{ msg: t('auth.verifyCode.error.tooManyAttempts') }],
          success: emailResult.success ? t('auth.verifyCode.success.resent') : null
        });
      }

      return renderVerifyCodeView(res, {
        email,
        errors: [{ msg: t('auth.verifyCode.error.invalid') }]
      });
    }

    user.isVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    user.verificationAttempts = 0;
    user.verifiedAt = new Date();
    await user.save();

    return res.render('auth/login', {
      title: t('auth.login.pageTitle'),
      success: t('auth.verifyCode.success.verified'),
      errors: null,
      user: null
    });
  } catch (error) {
    console.error('Verify code error:', error);
    return renderVerifyCodeView(res, {
      email,
      errors: [{ msg: t('auth.verifyCode.error.generic') }]
    });
  }
});

router.post('/resend-verification', requireGuest, [
  body('email').isEmail().normalizeEmail(emailNormalizeOptions)
], async (req, res) => {
  const validationErrors = validationResult(req);
  const t = getTranslator(res);
  const { email } = req.body;

  if (!validationErrors.isEmpty()) {
    return renderVerifyCodeView(res, {
      email,
      errors: validationErrors.array()
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return renderVerifyCodeView(res, {
        email,
        errors: [{ msg: t('auth.verifyCode.error.userNotFound') }]
      });
    }

    if (user.isVerified) {
      return res.render('auth/login', {
        title: t('auth.login.pageTitle'),
        success: t('auth.verifyCode.success.alreadyVerified'),
        errors: null,
        user: null
      });
    }

    const emailResult = await sendVerificationCodeForExistingUser(user, res);

    return renderVerifyCodeView(res, {
      email,
      errors: emailResult.success ? null : [{ msg: t('auth.verifyCode.error.sendFailed') }],
      success: emailResult.success ? t('auth.verifyCode.success.resent') : null
    });
  } catch (error) {
    console.error('Resend verification code error:', error);
    return renderVerifyCodeView(res, {
      email,
      errors: [{ msg: t('auth.verifyCode.error.generic') }]
    });
  }
});

router.get('/verify/:token', requireGuest, (req, res) => {
  const t = getTranslator(res);
  return renderVerifyCodeView(res, {
    email: '',
    errors: [{ msg: t('auth.verifyCode.error.deprecatedLink') }]
  });
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

module.exports = router;
