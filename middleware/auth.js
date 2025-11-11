const User = require('../models/User');

const clearSessionAndRedirect = (req, res, messagePath = '/auth/login') => {
  if (req.session) {
    req.session.destroy(() => {
      res.redirect(messagePath);
    });
  } else {
    res.redirect(messagePath);
  }
};

// Check if user is authenticated
const requireAuth = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/auth/login');
  }

  if (!req.user) {
    try {
      const user = await User.findById(req.session.userId).select('-password');
      if (!user) {
        return clearSessionAndRedirect(req, res);
      }
      req.user = user;
      res.locals.user = user;
    } catch (error) {
      console.error('Error verifying user session:', error);
      return clearSessionAndRedirect(req, res);
    }
  }

  if (req.user && req.user.isBanned) {
    console.warn(`[AUTH] Banned user attempted access: ${req.user.email}`);
    return clearSessionAndRedirect(req, res);
  }

  next();
};

// Check if user is not authenticated (for login/register pages)
const requireGuest = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return next();
  }
  res.redirect('/dashboard');
};

// Get current user and attach to request
const attachUser = async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).select('-password');
      if (!user || user.isBanned) {
        if (req.session) {
          req.session.destroy(() => {});
        }
      } else {
        req.user = user;
        res.locals.user = user;
      }
    } catch (error) {
      console.error('Error attaching user:', error);
    }
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  console.warn('[AUTH] Non-admin attempted to access admin route.');
  return res.status(403).render('error', {
    title: 'Acces interzis',
    message: 'Nu ai permisiunea de a accesa această secțiune.',
    user: req.user || null
  });
};

module.exports = {
  requireAuth,
  requireGuest,
  attachUser,
  requireAdmin
};
