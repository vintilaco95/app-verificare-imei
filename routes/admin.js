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
    const searchQuery = (req.query.search || '').trim();
    const searchLimit = searchQuery ? 120 : 50;

    let orderFilter = {};
    if (searchQuery) {
      const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      const numericQuery = Number.parseInt(searchQuery, 10);

      orderFilter = {
        $or: [
          { imei: regex },
          { email: regex },
          { brand: regex },
          { serviceName: regex }
        ]
      };

      if (!Number.isNaN(numericQuery)) {
        orderFilter.$or.push({ orderId: numericQuery });
      }
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const guestMatch = [{ userId: null }, { userId: { $exists: false } }];

    const [
      pricingConfig,
      usersRaw,
      ordersRaw,
      totalUsers,
      bannedUsers,
      totalVerifications,
      completedVerifications,
      todaysVerifications,
      creditUsageAgg,
      totalOrdersMatching,
      completedLogged,
      completedGuest,
      todaysLogged,
      todaysGuest
    ] = await Promise.all([
      pricingService.getPricingConfig(),
      User.find({}).sort({ createdAt: -1 }).lean(),
      Order.find(orderFilter)
        .sort({ createdAt: -1 })
        .limit(searchLimit)
        .populate('userId', 'email isBanned')
        .lean(),
      User.countDocuments({}),
      User.countDocuments({ isBanned: true }),
      Order.countDocuments({}),
      Order.countDocuments({ status: 'success' }),
      Order.countDocuments({ createdAt: { $gte: startOfDay } }),
      CreditTransaction.aggregate([
        { $match: { type: 'usage' } },
        { $group: { _id: null, totalUsage: { $sum: '$amount' } } }
      ]),
      searchQuery ? Order.countDocuments(orderFilter) : null,
      Order.countDocuments({ status: 'success', userId: { $ne: null } }),
      Order.countDocuments({
        status: 'success',
        $or: guestMatch
      }),
      Order.countDocuments({ createdAt: { $gte: startOfDay }, userId: { $ne: null } }),
      Order.countDocuments({
        createdAt: { $gte: startOfDay },
        $or: guestMatch
      })
    ]);

    const currentUserId = req.user ? req.user._id.toString() : '';
    const totalCreditsSpent = creditUsageAgg.length ? creditUsageAgg[0].totalUsage : 0;

    const users = usersRaw.map((u) => ({
      ...u,
      id: u._id.toString(),
      credits: Number(u.credits || 0),
      createdAt: u.createdAt ? new Date(u.createdAt) : null,
      isSelf: currentUserId === u._id.toString()
    }));

    const verifications = ordersRaw.map((order) => {
      const populatedUser = order.userId && typeof order.userId === 'object' ? order.userId : null;
      return {
        ...order,
        id: order._id.toString(),
        createdAt: order.createdAt ? new Date(order.createdAt) : null,
        userId: populatedUser && populatedUser._id ? populatedUser._id.toString() : order.userId ? order.userId.toString() : null,
        userEmail: populatedUser ? populatedUser.email : null,
        displayEmail: order.email || (populatedUser ? populatedUser.email : 'Guest'),
        userLabel: populatedUser ? (populatedUser.email || 'Utilizator') : (order.email || 'Guest')
      };
    });

    const dashboardStats = {
      totalUsers,
      activeUsers: totalUsers - bannedUsers,
      bannedUsers,
      totalVerifications,
      completedVerifications,
      todaysVerifications,
      totalCreditsSpent,
      completedLogged,
      completedGuest,
      todaysLogged,
      todaysGuest
    };

    res.render('admin/dashboard', {
      title: 'Panou administrator',
      user: req.user,
      users,
      verifications,
      pricingConfig,
      dashboardStats,
      searchQuery,
      verificationsCount: searchQuery ? totalOrdersMatching || 0 : verifications.length,
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

router.get('/users/:id/details', async (req, res) => {
  try {
    const userId = req.params.id;

    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'ID utilizator invalid.' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ error: 'Utilizatorul nu a fost găsit.' });
    }

    const [orderStats, creditUsageStats, recentOrders, creditHistory] = await Promise.all([
      Order.aggregate([
        { $match: { userId: user._id } },
        {
          $group: {
            _id: '$userId',
            totalVerifications: {
              $sum: {
                $cond: [{ $eq: ['$status', 'success'] }, 1, 0]
              }
            },
            totalOrders: { $sum: 1 },
            lastVerificationAt: { $max: '$createdAt' }
          }
        }
      ]),
      CreditTransaction.aggregate([
        { $match: { userId: user._id, type: 'usage' } },
        { $group: { _id: '$userId', totalUsage: { $sum: '$amount' } } }
      ]),
      Order.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      CreditTransaction.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    const stats = orderStats.length ? orderStats[0] : null;
    const totalCreditsUsed = creditUsageStats.length ? creditUsageStats[0].totalUsage : 0;

    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        credits: Number(user.credits || 0),
        isBanned: Boolean(user.isBanned),
        isAdmin: Boolean(user.isAdmin),
        createdAt: user.createdAt,
        verifiedAt: user.verifiedAt || null,
        bannedReason: user.bannedReason || null,
        bannedAt: user.bannedAt || null,
        isSelf: req.user && req.user._id.toString() === user._id.toString()
      },
      stats: {
        totalVerifications: stats ? stats.totalVerifications : 0,
        totalOrders: stats ? stats.totalOrders : 0,
        lastVerificationAt: stats ? stats.lastVerificationAt : null,
        totalCreditsUsed
      },
      recentOrders: recentOrders.map((order) => ({
        id: order._id.toString(),
        imei: order.imei,
        brand: order.brand,
        status: order.status,
        price: order.price,
        createdAt: order.createdAt,
        orderId: order.orderId
      })),
      creditHistory: creditHistory.map((tx) => ({
        id: tx._id.toString(),
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        createdAt: tx.createdAt
      }))
    });
  } catch (error) {
    console.error('[Admin] Failed to load user details:', error);
    res.status(500).json({ error: 'Eroare la încărcarea detaliilor utilizatorului.' });
  }
});

module.exports = router;
