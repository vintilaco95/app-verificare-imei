const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const CreditTransaction = require('../models/CreditTransaction');
const pricingService = require('../services/pricingService');

const SUCCESS_MESSAGES = {
  credits: 'Creditele au fost actualizate.',
  banned: 'Utilizatorul a fost banat.',
  unbanned: 'Utilizatorul a fost deblocat.',
  deleted: 'Utilizatorul a fost șters.',
  pricing: 'Prețurile au fost actualizate.'
};

const ERROR_MESSAGES = {
  invalid_amount: 'Introduce o sumă validă.',
  user_not_found: 'Utilizatorul nu a fost găsit.',
  credits: 'Nu am putut actualiza creditele utilizatorului.',
  ban: 'Nu am putut bana utilizatorul.',
  unban: 'Nu am putut debloca utilizatorul.',
  delete: 'Nu am putut șterge utilizatorul.',
  pricing: 'Actualizarea prețurilor a eșuat.',
  self_action: 'Nu poți efectua această acțiune asupra propriului cont.'
};

router.use(requireAuth);
router.use(requireAdmin);

const toNumberOrNull = (value) => {
  if (value === null || typeof value === 'undefined') return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

router.get('/', async (req, res) => {
  try {
    const [pricingConfig, usersRaw, recentOrdersRaw] = await Promise.all([
      pricingService.getPricingConfig(),
      User.find({}).sort({ createdAt: -1 }).lean(),
      Order.find({}).sort({ createdAt: -1 }).limit(50).lean()
    ]);

    const currentUserId = req.user ? req.user._id.toString() : '';

    const users = usersRaw.map((u) => ({
      ...u,
      id: u._id.toString(),
      credits: Number(u.credits || 0),
      createdAt: u.createdAt ? new Date(u.createdAt) : null,
      isSelf: currentUserId === u._id.toString()
    }));

    const recentOrders = recentOrdersRaw.map((order) => ({
      ...order,
      id: order._id.toString(),
      createdAt: order.createdAt ? new Date(order.createdAt) : null,
      userId: order.userId ? order.userId.toString() : null
    }));

    res.render('admin/dashboard', {
      title: 'Panou administrator',
      user: req.user,
      users,
      recentOrders,
      pricingConfig,
      csrfToken: res.locals.csrfToken || '',
      alerts: {
        success: SUCCESS_MESSAGES[req.query.success] || null,
        error: ERROR_MESSAGES[req.query.error] || null
      }
    });
  } catch (error) {
    console.error('[Admin] Failed to load dashboard:', error);
    res.status(500).render('error', {
      title: 'Eroare administrare',
      message: 'A apărut o eroare la încărcarea panoului de administrare.',
      user: req.user || null
    });
  }
});

router.post('/users/:id/credits', async (req, res) => {
  try {
    const userId = req.params.id;
    const amount = toNumberOrNull(req.body.amount);
    const note = (req.body.note || '').trim();

    if (amount === null || amount === 0) {
      return res.redirect('/admin?error=invalid_amount');
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.redirect('/admin?error=user_not_found');
    }

    const startingCredits = Number(targetUser.credits || 0);
    targetUser.credits = Math.max(0, startingCredits + amount);
    await targetUser.save();

    await CreditTransaction.create({
      userId: targetUser._id,
      type: 'adjustment',
      amount: amount,
      description: note || (amount > 0 ? 'Adăugat de administrator' : 'Scăzut de administrator'),
      adminId: req.user._id,
      metadata: {
        adminEmail: req.user.email,
        previousCredits: startingCredits
      }
    });

    res.redirect('/admin?success=credits');
  } catch (error) {
    console.error('[Admin] Failed to adjust credits:', error);
    res.redirect('/admin?error=credits');
  }
});

router.post('/users/:id/ban', async (req, res) => {
  try {
    const userId = req.params.id;
    if (req.user && req.user._id.toString() === userId) {
      return res.redirect('/admin?error=self_action');
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.redirect('/admin?error=user_not_found');
    }

    targetUser.isBanned = true;
    targetUser.bannedAt = new Date();
    targetUser.bannedReason = (req.body.reason || 'Motiv nespecificat').trim();
    await targetUser.save();

    res.redirect('/admin?success=banned');
  } catch (error) {
    console.error('[Admin] Failed to ban user:', error);
    res.redirect('/admin?error=ban');
  }
});

router.post('/users/:id/unban', async (req, res) => {
  try {
    const userId = req.params.id;
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.redirect('/admin?error=user_not_found');
    }

    targetUser.isBanned = false;
    targetUser.bannedAt = null;
    targetUser.bannedReason = null;
    await targetUser.save();

    res.redirect('/admin?success=unbanned');
  } catch (error) {
    console.error('[Admin] Failed to unban user:', error);
    res.redirect('/admin?error=unban');
  }
});

router.post('/users/:id/delete', async (req, res) => {
  try {
    const userId = req.params.id;
    if (req.user && req.user._id.toString() === userId) {
      return res.redirect('/admin?error=self_action');
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.redirect('/admin?error=user_not_found');
    }

    await Promise.all([
      Order.deleteMany({ userId: targetUser._id }),
      CreditTransaction.deleteMany({ userId: targetUser._id })
    ]);
    await User.findByIdAndDelete(userId);

    res.redirect('/admin?success=deleted');
  } catch (error) {
    console.error('[Admin] Failed to delete user:', error);
    res.redirect('/admin?error=delete');
  }
});

router.post('/pricing', async (req, res) => {
  try {
    const baseCreditsInput = req.body.baseCredits || {};
    const guestPricesInput = req.body.guestPrices || {};

    const baseCredits = {};
    Object.keys(baseCreditsInput).forEach((brand) => {
      const value = toNumberOrNull(baseCreditsInput[brand]);
      if (value !== null && value >= 0) {
        baseCredits[brand] = value;
      }
    });

    const guestPrices = {};
    Object.keys(guestPricesInput).forEach((brand) => {
      const value = toNumberOrNull(guestPricesInput[brand]);
      if (value !== null && value >= 0) {
        guestPrices[brand] = value;
      }
    });

    await pricingService.updatePricingConfig({ baseCredits, guestPrices }, req.user._id);
    res.redirect('/admin?success=pricing');
  } catch (error) {
    console.error('[Admin] Failed to update pricing:', error);
    res.redirect('/admin?error=pricing');
  }
});

module.exports = router;
