const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireGuest } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Register
router.get('/register', requireGuest, (req, res) => {
  res.render('auth/register', { 
    title: 'Înregistrare',
    errors: null,
    user: null
  });
});

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
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('auth/register', {
        title: 'Înregistrare',
        errors: [{ msg: 'Email-ul este deja înregistrat' }],
        user: null
      });
    }
    
    // Create user
    const user = new User({ email, password });
    await user.save();
    
    // Set session
    req.session.userId = user._id;
    
    res.redirect('/dashboard');
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
