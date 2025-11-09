const User = require('../models/User');

// Check if user is authenticated
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/auth/login');
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
      req.user = user;
      res.locals.user = user;
    } catch (error) {
      console.error('Error attaching user:', error);
    }
  }
  next();
};

module.exports = {
  requireAuth,
  requireGuest,
  attachUser
};
