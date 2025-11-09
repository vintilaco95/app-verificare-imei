const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Order = require('../models/Order');
const CreditTransaction = require('../models/CreditTransaction');
const stripeService = require('../services/stripeService');
const { CREDIT_PACKAGES, MIN_TOPUP_AMOUNT } = require('../config/creditPackages');
const { processCreditTopupSession } = require('../services/creditTopupService');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const user = req.user;
    
    const [ totalOrders, orders, transactions ] = await Promise.all([
      Order.countDocuments({ userId: user._id }),
      Order.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(4),
      CreditTransaction.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(4)
        .populate('orderId')
    ]);
    
    res.render('dashboard/index', {
      title: 'Dashboard',
      user: user,
      orders: orders,
      transactions: transactions,
      totalOrders: totalOrders
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', {
      error: 'Eroare la încărcarea dashboard-ului',
      user: req.user
    });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    
    // Group orders by IMEI
    const groupedOrders = {};
    orders.forEach(order => {
      const imei = order.imei;
      if (!groupedOrders[imei]) {
        groupedOrders[imei] = [];
      }
      groupedOrders[imei].push(order);
    });
    
    // Convert to array and sort by most recent order date
    const groupedArray = Object.entries(groupedOrders).map(([imei, ordersList]) => ({
      imei: imei,
      orders: ordersList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      count: ordersList.length,
      lastChecked: ordersList[0].createdAt,
      model: ordersList[0].model || 'Unknown',
      brand: ordersList[0].brand || 'N/A'
    })).sort((a, b) => new Date(b.lastChecked) - new Date(a.lastChecked));
    
    res.render('dashboard/orders', {
      title: 'Istoric verificări',
      user: req.user,
      orders: orders,
      groupedOrders: groupedArray
    });
  } catch (error) {
    console.error('Orders error:', error);
    res.status(500).render('error', {
      error: 'Eroare la încărcarea comenzilor',
      user: req.user
    });
  }
});

router.get('/credits', async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('orderId');
    
    res.render('dashboard/credits', {
      title: 'Credite',
      user: req.user,
      transactions: transactions,
      packages: CREDIT_PACKAGES,
      minAmount: MIN_TOPUP_AMOUNT,
      errors: null
    });
  } catch (error) {
    console.error('Credits error:', error);
    res.status(500).render('error', {
      error: 'Eroare la încărcarea tranzacțiilor',
      user: req.user
    });
  }
});

// Add credits endpoint (temporary - for testing)
router.post('/credits/add', async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount) || 100;
    const user = req.user;
    
    // Add credits
    user.credits += amount;
    await user.save();
    
    // Record transaction
    const transaction = new CreditTransaction({
      userId: user._id,
      type: 'purchase',
      amount: amount,
      description: `Credite adăugate manual: ${amount}`
    });
    await transaction.save();
    
    res.redirect('/dashboard/credits');
  } catch (error) {
    console.error('Add credits error:', error);
    res.status(500).render('error', {
      error: 'Eroare la adăugarea creditelor',
      user: req.user
    });
  }
});

// Show credit top-up options
router.get('/credits/topup', (req, res) => {
  res.render('dashboard/topup', {
    title: 'Încarcă credite',
    user: req.user,
    packages: CREDIT_PACKAGES,
    minAmount: MIN_TOPUP_AMOUNT,
    errors: null
  });
});

// Create Stripe checkout for selected credit package
router.post('/credits/topup', async (req, res) => {
  try {
    const { packageId, customAmount } = req.body;
    let selectedPackage = null;
    let amount = 0;

    if (packageId && packageId !== 'custom') {
      selectedPackage = CREDIT_PACKAGES.find(pkg => pkg.id === packageId);
      if (!selectedPackage) {
        return res.status(400).render('dashboard/topup', {
          title: 'Încarcă credite',
          user: req.user,
          packages: CREDIT_PACKAGES,
          minAmount: MIN_TOPUP_AMOUNT,
          errors: [{ msg: 'Pachet invalid selectat. Încearcă din nou.' }]
        });
      }
      amount = selectedPackage.price;
    } else {
      // Custom amount
      const parsed = parseFloat(customAmount);
      if (isNaN(parsed) || parsed < MIN_TOPUP_AMOUNT) {
        return res.status(400).render('dashboard/topup', {
          title: 'Încarcă credite',
          user: req.user,
          packages: CREDIT_PACKAGES,
          minAmount: MIN_TOPUP_AMOUNT,
          errors: [{ msg: `Suma minimă pentru încărcare este ${MIN_TOPUP_AMOUNT} credite.` }]
        });
      }
      amount = parsed;
    }

    const { session } = await stripeService.createCreditTopupSession(
      req.user._id,
      amount,
      req.user.email,
      {
        packageId: packageId || 'custom',
        successPath: '/dashboard/credits/success',
        cancelPath: '/dashboard/credits/cancel'
      }
    );

    return res.redirect(303, session.url);
  } catch (error) {
    console.error('Credit top-up error:', error);
    res.status(500).render('dashboard/topup', {
      title: 'Încarcă credite',
      user: req.user,
      packages: CREDIT_PACKAGES,
      minAmount: MIN_TOPUP_AMOUNT,
      errors: [{ msg: 'A apărut o eroare la inițierea plății. Încearcă din nou.' }]
    });
  }
});

// Handle success redirect after Stripe payment
router.get('/credits/success', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res.redirect('/dashboard/credits');
    }

    const session = await stripeService.retrieveCheckoutSession(session_id);
    if (!session || !session.metadata || session.metadata.type !== 'credit_topup') {
      return res.redirect('/dashboard/credits');
    }

    const topupResult = await processCreditTopupSession(session);

    let transaction = topupResult.transaction || null;
    if (!transaction && session.payment_intent) {
      transaction = await CreditTransaction.findOne({ stripePaymentIntentId: session.payment_intent });
    }

    const chargedAmount = session.metadata && session.metadata.chargedAmount
      ? parseFloat(session.metadata.chargedAmount)
      : session.amount_total / 100;

    res.render('dashboard/topup-success', {
      title: 'Plată reușită',
      user: req.user,
      chargedAmount: chargedAmount,
      transactionRecorded: !!transaction
    });
  } catch (error) {
    console.error('Credit top-up success handler error:', error);
    res.status(500).render('error', {
      error: 'Eroare la procesarea plății',
      user: req.user
    });
  }
});

// Handle cancel redirect after Stripe payment
router.get('/credits/cancel', (req, res) => {
  res.render('dashboard/topup-cancelled', {
    title: 'Plată anulată',
    user: req.user
  });
});

module.exports = router;
