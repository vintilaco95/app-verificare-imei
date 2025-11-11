const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const { requireGuest } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { sendVerificationEmail } = require('../services/emailService');

// Register
router.get('/register', requireGuest, (req, res) => {
  res.render('auth/register', { 
    title: 'Înregistrare',
    errors: null,
    user: null
  });
});

const getTranslator = (res) => (typeof res.locals.t === 'function' ? res.locals.t : (key) => key);

router.post('/register', requireGuest, [
  body('email').isEmail().normalizeEmail(),
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
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('auth/register', {
        title: 'Înregistrare',
        errors: [{ msg: 'Email-ul este deja înregistrat' }],
        user: null
      });
    }
    
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresIn = parseInt(process.env.EMAIL_VERIFICATION_TTL || `${24 * 60 * 60 * 1000}`, 10);
    const verificationTokenExpires = new Date(Date.now() + expiresIn);

    const user = new User({
      email,
      password,
      isVerified: false,
      verificationToken,
      verificationTokenExpires
    });
    await user.save();

    try {
      await sendVerificationEmail(email, verificationToken, { lang: res.locals.currentLang || 'ro' });
    } catch (emailError) {
      console.error('[Auth] Failed to send verification email:', emailError);
    }

    res.render('auth/check-email', {
      title: t('auth.checkEmail.pageTitle'),
      email,
      user: null
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.render('auth/register', {
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
  body('email').isEmail().normalizeEmail(),
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
      return res.render('auth/login', {
        title: t('auth.login.pageTitle'),
        errors: [{ msg: t('auth.login.error.notVerified') }],
        user: null,
        pendingEmail: email,
        showResend: true,
        success: null
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
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', {
      title: 'Autentificare',
      errors: [{ msg: 'Eroare la autentificare. Încearcă din nou.' }],
      user: null
    });
  }
});

router.post('/resend-verification', requireGuest, [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  const errors = validationResult(req);
  const t = getTranslator(res);

  if (!errors.isEmpty()) {
    return res.render('auth/login', {
      title: t('auth.login.pageTitle'),
      errors: errors.array(),
      user: null
    });
  }

  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('auth/login', {
        title: t('auth.login.pageTitle'),
        errors: [{ msg: t('auth.login.error.notFound') }],
        user: null
      });
    }

    if (user.isVerified) {
      return res.render('auth/login', {
        title: t('auth.login.pageTitle'),
        errors: [{ msg: t('auth.login.error.alreadyVerified') }],
        user: null
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresIn = parseInt(process.env.EMAIL_VERIFICATION_TTL || `${24 * 60 * 60 * 1000}`, 10);
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = new Date(Date.now() + expiresIn);
    await user.save();

    try {
      await sendVerificationEmail(email, verificationToken, { lang: res.locals.currentLang || 'ro' });
    } catch (emailError) {
      console.error('[Auth] Failed to resend verification email:', emailError);
    }

    return res.render('auth/login', {
      title: t('auth.login.pageTitle'),
      success: t('auth.login.resendSuccess'),
      errors: null,
      user: null
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.render('auth/login', {
      title: t('auth.login.pageTitle'),
      errors: [{ msg: t('auth.login.error.generic') }],
      user: null
    });
  }
});

router.get('/verify/:token', requireGuest, async (req, res) => {
  const { token } = req.params;
  const t = getTranslator(res);

  try {
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.render('auth/login', {
        title: t('auth.login.pageTitle'),
        errors: [{ msg: t('auth.verify.invalidToken') }],
        user: null
      });
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    user.verifiedAt = new Date();
    await user.save();

    return res.render('auth/login', {
      title: t('auth.login.pageTitle'),
      success: t('auth.verify.success'),
      errors: null,
      user: null
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.render('auth/login', {
      title: t('auth.login.pageTitle'),
      errors: [{ msg: t('auth.login.error.generic') }],
      user: null
    });
  }
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
