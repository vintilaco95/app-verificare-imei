const express = require('express');
const router = express.Router();
// Note: Webhook route uses express.raw() which is configured in server.js
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const imeiService = require('../services/imeiService');
const User = require('../models/User');
const Order = require('../models/Order');
const CreditTransaction = require('../models/CreditTransaction');
const { PRICING, getBasePrice, calculateTotalPrice } = require('../config/pricing');
const stripeService = require('../services/stripeService');
const {
  formatWarrantyInfo,
  formatDate,
  formatiCloudStatus,
  formatBlacklistStatus,
  formatKnoxStatus,
  formatMDMStatus,
  formatLostModeStatus,
  formatNetworkLockStatus,
  formatOriginInfo,
  formatMiLockStatus,
  calculateRiskScore,
  getRiskDetails,
  normalizeLang,
  DEFAULT_LANGUAGE
} = require('../services/emailFormatter');
const { generateResultHTML } = require('../services/generateResultHTML');
const { parseAppleMdmHTML } = require('../services/parseAppleMdmHTML');
const {
  CREDIT_VALUE,
  BASE_CURRENCY,
  GUEST_VERIFICATION_CREDITS
} = require('../config/currency');
const { processCreditTopupSession } = require('../services/creditTopupService');
const { addVerificationJob } = require('../services/verificationQueue');

const guestPricing = Object.keys(PRICING.base).reduce((acc, key) => {
  acc[key] = GUEST_VERIFICATION_CREDITS;
  return acc;
}, {});

function getPricingForUser(user) {
  return user ? PRICING.base : guestPricing;
}

// Show verification form
router.get('/imei', (req, res) => {
  res.render('verify/form', {
    title: 'Verificare IMEI',
    user: req.user || null,
    errors: null,
    pricing: getPricingForUser(req.user),
    selectedBrand: null,
    creditValue: CREDIT_VALUE,
    currencyCode: BASE_CURRENCY,
    guestVerificationCredits: GUEST_VERIFICATION_CREDITS
  });
});

// API endpoint to check if IMEI was previously verified
router.get('/imei/check/:imei', requireAuth, async (req, res) => {
  try {
    const { imei } = req.params;
    
    if (!/^\d{15}$/.test(imei)) {
      return res.json({ found: false, orders: [] });
    }
    
    const orders = await Order.find({ 
      userId: req.session.userId,
      imei: imei 
    })
      .sort({ createdAt: -1 })
      .limit(10);
    
    if (orders.length === 0) {
      return res.json({ found: false, orders: [] });
    }
    
    const formattedOrders = orders.map(order => ({
      id: order._id,
      date: order.createdAt,
      status: order.status,
      model: order.model || 'Unknown',
      brand: order.brand || 'N/A'
    }));
    
    res.json({ 
      found: true, 
      orders: formattedOrders,
      count: orders.length
    });
  } catch (error) {
    console.error('Check IMEI error:', error);
    res.json({ found: false, orders: [] });
  }
});

// Process verification (authenticated user)
router.post('/imei', requireAuth, [
  body('imei').notEmpty().trim().isLength({ min: 15, max: 15 }).withMessage('IMEI-ul trebuie să aibă 15 cifre')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('verify/form', {
      title: 'Verificare IMEI',
      errors: errors.array(),
      user: req.user || null,
      pricing: getPricingForUser(req.user),
      selectedBrand: null,
      creditValue: CREDIT_VALUE,
      currencyCode: BASE_CURRENCY,
      guestVerificationCredits: GUEST_VERIFICATION_CREDITS
    });
  }
  
  try {
    const { imei, additionalServices } = req.body;
    const user = await User.findById(req.session.userId);
    
    console.log(`[POST /imei] Received IMEI: ${imei}`);
    
    // Validate IMEI format
    if (!/^\d{15}$/.test(imei)) {
      return res.render('verify/form', {
        title: 'Verificare IMEI',
        errors: [{ msg: 'IMEI-ul trebuie să aibă exact 15 cifre' }],
        user: req.user || null,
        pricing: getPricingForUser(req.user),
        selectedBrand: null,
        creditValue: CREDIT_VALUE,
        currencyCode: BASE_CURRENCY,
        guestVerificationCredits: GUEST_VERIFICATION_CREDITS
      });
    }
    
    // Parse additional services
    const additionalServiceIds = Array.isArray(additionalServices) 
      ? additionalServices.map(id => parseInt(id))
      : (additionalServices ? [parseInt(additionalServices)] : []);
    const lang = normalizeLang(res.locals.currentLang || req.session.lang || DEFAULT_LANGUAGE);
    
    // Detect brand upfront to determine correct pricing
    let pricingBrand = 'default';
    let detectedBrandForPricing = null;
    try {
      detectedBrandForPricing = await imeiService.detectBrand(imei);
      if (detectedBrandForPricing) {
        pricingBrand = detectedBrandForPricing;
      }
    } catch (error) {
      console.error('[Pricing] Brand detection error:', error);
    }
    
    // Calculate total cost using detected brand (fallback to default)
    const totalCost = calculateTotalPrice(pricingBrand, additionalServiceIds);
    
    // Check if user has enough credits
    if (user.credits < totalCost) {
      return res.render('verify/form', {
        title: 'Verificare IMEI',
        errors: [{ msg: `Credite insuficiente. Ai ${user.credits.toFixed(2)} credite, dar ai nevoie de ${totalCost.toFixed(2)} credite.` }],
        user: req.user || null,
        pricing: getPricingForUser(req.user),
        selectedBrand: null,
        creditValue: CREDIT_VALUE,
        currencyCode: BASE_CURRENCY,
        guestVerificationCredits: GUEST_VERIFICATION_CREDITS
      });
    }
    
    // Create order first with pending status
    const tempOrder = new Order({
      orderId: Date.now(),
      userId: user._id,
      email: user.email,
      imei: imei,
      serviceId: 0,
      serviceName: 'IMEI Verification',
      price: totalCost,
      status: 'pending',
      result: null,
      object: null,
      brand: detectedBrandForPricing || 'unknown', // Will be confirmed via API (service 11)
      model: 'Processing...',
      additionalServices: additionalServiceIds,
      language: lang
    });
    await tempOrder.save();
    
    // Deduct credits immediately
    user.credits -= totalCost;
    await user.save();
    
    // Record transaction
    const transaction = new CreditTransaction({
      userId: user._id,
      type: 'usage',
      amount: -totalCost,
      description: `Verificare IMEI: ${imei}${additionalServiceIds.length > 0 ? ` + ${additionalServiceIds.length} verificări suplimentare` : ''}`,
      orderId: tempOrder._id
    });
    await transaction.save();
    
    // Enqueue verification job
    try {
      await addVerificationJob({
        orderId: tempOrder._id,
        imei,
        userId: user._id,
        email: user.email,
        detectedBrand: detectedBrandForPricing,
        additionalServiceIds,
        language: lang
      });
    } catch (queueError) {
      console.error('[Queue] Failed to enqueue verification job:', queueError);
      
      // Rollback credits and delete order
      user.credits += totalCost;
      await user.save();
      
      await CreditTransaction.create({
        userId: user._id,
        type: 'refund',
        amount: totalCost,
        description: `Refund - eroare coadă verificare IMEI: ${imei}`,
        orderId: tempOrder._id
      });
      
      await Order.findByIdAndDelete(tempOrder._id);
      
      return res.render('verify/form', {
        title: 'Verificare IMEI',
        errors: [{ msg: 'Serviciul de procesare este indisponibil momentan. Te rugăm să încerci din nou.' }],
        user: req.user || null,
        pricing: getPricingForUser(req.user),
        selectedBrand: null,
        creditValue: CREDIT_VALUE,
        currencyCode: BASE_CURRENCY,
        guestVerificationCredits: GUEST_VERIFICATION_CREDITS
      });
    }
    
    // Redirect to processing page
    res.redirect(`/verify/processing/${tempOrder._id}`);
  } catch (error) {
    console.error('Verification error:', error);
    res.render('verify/form', {
      title: 'Verificare IMEI',
      errors: [{ msg: 'Eroare la verificare. Încearcă din nou.' }],
      user: req.user || null,
      pricing: getPricingForUser(req.user),
      selectedBrand: null,
      creditValue: CREDIT_VALUE,
      currencyCode: BASE_CURRENCY,
      guestVerificationCredits: GUEST_VERIFICATION_CREDITS
    });
  }
});

// Process verification (guest user - one-time payment)
router.post('/imei/guest', [
  body('imei').notEmpty().trim().isLength({ min: 15, max: 15 }).withMessage('IMEI-ul trebuie să aibă 15 cifre'),
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('verify/form', {
      title: 'Verificare IMEI',
      errors: errors.array(),
      user: null,
      pricing: getPricingForUser(null),
      selectedBrand: null,
      creditValue: CREDIT_VALUE,
      currencyCode: BASE_CURRENCY,
      guestVerificationCredits: GUEST_VERIFICATION_CREDITS
    });
  }
  
  const { brand: selectedBrandRaw } = req.body;
  
  try {
    const { imei, email, additionalServices } = req.body;
    const brand = selectedBrandRaw;
    
    console.log(`[POST /imei/guest] Received IMEI: ${imei}`);
    
    // Validate IMEI format
    if (!/^\d{15}$/.test(imei)) {
      return res.render('verify/form', {
        title: 'Verificare IMEI',
        errors: [{ msg: 'IMEI-ul trebuie să aibă exact 15 cifre' }],
        user: null,
        pricing: getPricingForUser(null),
        selectedBrand: selectedBrandRaw || null,
        creditValue: CREDIT_VALUE,
        currencyCode: BASE_CURRENCY,
        guestVerificationCredits: GUEST_VERIFICATION_CREDITS
      });
    }
    
    // Ensure brand is selected
    const availableBrands = Object.keys(PRICING.base);
    if (!brand || !availableBrands.includes(brand)) {
      return res.render('verify/form', {
        title: 'Verificare IMEI',
        errors: [{ msg: 'Te rugăm să selectezi brandul telefonului înainte de a continua.' }],
        user: null,
        pricing: getPricingForUser(null),
        selectedBrand: brand || null,
        creditValue: CREDIT_VALUE,
        currencyCode: BASE_CURRENCY,
        guestVerificationCredits: GUEST_VERIFICATION_CREDITS
      });
    }
    
    // Parse additional services
    const additionalServiceIds = Array.isArray(additionalServices) 
      ? additionalServices.map(id => parseInt(id))
      : (additionalServices ? [parseInt(additionalServices)] : []);
    const lang = normalizeLang(res.locals.currentLang || req.session.lang || DEFAULT_LANGUAGE);
    
    // Use selected brand for pricing
    const pricingBrand = brand;
    let detectedBrandForPricing = null;
    
    // Calculate guest pricing: base credits override + additional services
    const defaultTotalCredits = calculateTotalPrice(pricingBrand, additionalServiceIds);
    const baseCredits = PRICING.base[pricingBrand] || PRICING.base.default || 1;
    const additionalCredits = Math.max(0, parseFloat((defaultTotalCredits - baseCredits).toFixed(2)));
    const totalCredits = parseFloat((GUEST_VERIFICATION_CREDITS + additionalCredits).toFixed(2));
    const totalAmount = parseFloat((totalCredits * CREDIT_VALUE).toFixed(2));
    
    // Validate price (security: prevent price manipulation)
    if (totalCredits <= 0 || totalCredits > 100) {
      return res.render('verify/form', {
        title: 'Verificare IMEI',
        errors: [{ msg: 'Preț invalid. Te rugăm să reîmprospătezi pagina și să încerci din nou.' }],
        user: null,
        pricing: getPricingForUser(null),
        selectedBrand: brand || null,
        creditValue: CREDIT_VALUE,
        currencyCode: BASE_CURRENCY,
        guestVerificationCredits: GUEST_VERIFICATION_CREDITS
      });
    }
    
    // Create order first with pending payment status
    const tempOrder = new Order({
      orderId: Date.now(),
      userId: null,
      email: email,
      imei: imei,
      serviceId: 0,
      serviceName: 'IMEI Verification',
      price: totalCredits,
      currencyAmount: totalAmount,
      currency: BASE_CURRENCY,
      status: 'pending',
      paymentStatus: 'pending', // Payment required before verification
      result: null,
      object: null,
      brand: pricingBrand || 'unknown', // Will be confirmed via API
      model: 'Processing...',
      additionalServices: additionalServiceIds,
      language: lang
    });
    await tempOrder.save();
    
    // Create Stripe Checkout session
    try {
      const { session, adjustedAmount } = await stripeService.createCheckoutSession(
        tempOrder._id.toString(),
        totalAmount,
        email,
        imei,
        {
          brand: pricingBrand,
          additionalServiceIds,
          creditsAmount: totalCredits,
          currency: BASE_CURRENCY
        }
      );
      
      // If amount was adjusted due to Stripe minimum, update order price
      if (adjustedAmount && adjustedAmount > totalAmount) {
        tempOrder.currencyAmount = adjustedAmount;
        console.log(`[Payment] Order price adjusted from ${totalAmount.toFixed(2)} to ${adjustedAmount.toFixed(2)} ${BASE_CURRENCY} (Stripe minimum)`);
      }
      
      // Save Stripe session ID to order
      tempOrder.stripeSessionId = session.id;
      await tempOrder.save();
      
      // Redirect to Stripe Checkout
      res.redirect(303, session.url);
    } catch (error) {
      console.error('Stripe Checkout creation error:', error);
      // Delete the order if payment setup fails
      await Order.findByIdAndDelete(tempOrder._id);
      return res.render('verify/form', {
        title: 'Verificare IMEI',
        errors: [{ msg: 'Eroare la inițierea plății. Te rugăm să încerci din nou.' }],
        user: null,
        pricing: getPricingForUser(null),
        selectedBrand: pricingBrand,
        creditValue: CREDIT_VALUE,
        currencyCode: BASE_CURRENCY,
        guestVerificationCredits: GUEST_VERIFICATION_CREDITS
      });
    }
  } catch (error) {
    console.error('Guest verification error:', error);
    res.render('verify/form', {
      title: 'Verificare IMEI',
      errors: [{ msg: 'Eroare la verificare. Încearcă din nou.' }],
      user: null,
      pricing: getPricingForUser(null),
      selectedBrand: selectedBrandRaw || null,
      creditValue: CREDIT_VALUE,
      currencyCode: BASE_CURRENCY,
      guestVerificationCredits: GUEST_VERIFICATION_CREDITS
    });
  }
});

// Show processing page
router.get('/processing/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).render('404', { user: req.user || null });
    }
    
    // Check access
    if (order.userId && req.session.userId && order.userId.toString() !== req.session.userId.toString()) {
      return res.status(403).render('error', { 
        error: 'Nu ai acces la această verificare',
        user: req.user || null
      });
    }
    
    // For guest orders, check if payment is required
    if (!order.userId && order.paymentStatus !== 'paid' && order.status === 'pending') {
      // Payment not completed yet
      if (order.stripeSessionId) {
        // Payment session exists but not completed - show waiting message
        return res.render('verify/payment-pending', {
          title: 'Așteptare plată',
          order: order,
          user: req.user || null
        });
      } else {
        // No payment session - redirect to form
        return res.redirect('/verify/imei');
      }
    }
    
    res.render('verify/processing', {
      title: 'Verificare în proces',
      order: order,
      user: req.user || null
    });
  } catch (error) {
    console.error('Processing page error:', error);
    res.status(500).render('error', {
      error: 'Eroare la încărcarea paginii',
      user: req.user || null
    });
  }
});

// Check order status (AJAX endpoint)
router.get('/status/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Check access
    if (order.userId && req.session.userId && order.userId.toString() !== req.session.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({
      status: order.status,
      paymentStatus: order.paymentStatus,
      completed: order.status === 'success' || order.status === 'failed' || order.status === 'error',
      resultUrl: (order.status === 'success' || order.status === 'failed') ? `/verify/result/${order._id}` : null
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Error checking status' });
  }
});

// Show result
router.get('/result/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).render('404', { user: req.user || null });
    }

    if (order.status === 'pending') {
      return res.redirect(`/verify/processing/${order._id}`);
    }

    if (order.userId && req.session.userId && order.userId.toString() !== req.session.userId.toString()) {
      return res.status(403).render('error', {
        error: 'Nu ai acces la acest rezultat',
        user: req.user || null
      });
    }

    const renderCsrfToken = (typeof req.csrfToken === 'function') ? req.csrfToken() : '';
    console.log(`[VerifyResult] GET ${req.originalUrl} - csrfToken: ${renderCsrfToken || 'EMPTY'}`);

    const lang = normalizeLang(res.locals.currentLang || DEFAULT_LANGUAGE);
    const { templateName, templateData } = await generateResultHTML(order, {
      includeLayout: false,
      lang
    });

    res.render(templateName, {
      ...templateData,
      title: res.locals.t ? res.locals.t('verify.result.pageTitle') : 'Rezultat verificare IMEI',
      user: req.user || null,
      csrfToken: renderCsrfToken,
      isEmail: false
    });
  } catch (error) {
    console.error('[VerifyResult] Error rendering result:', error);
    res.status(500).render('error', {
      error: 'A apărut o eroare la afișarea rezultatului.',
      user: req.user || null
    });
  }
});

// POST endpoint for Apple MDM status check (service 47)
router.post('/apple-mdm/:orderId', requireAuth, async (req, res) => {
  const servicePrice = 5;
  try {
    const orderId = req.params.orderId;
    const userId = req.session.userId;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Verificare negăsită' });
    }

    if (order.userId && order.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Nu ai acces la această verificare' });
    }

    if (order.status !== 'success') {
      return res.status(400).json({ error: 'Verificarea nu este finalizată' });
    }

    const brand = (order.brand || '').toLowerCase();
    if (brand !== 'apple') {
      return res.status(400).json({ error: 'Funcția MDM este disponibilă doar pentru dispozitive Apple' });
    }

    if (order.object && typeof order.object === 'object' && order.object.appleMdmCheck) {
      return res.status(400).json({ error: 'Statusul MDM a fost deja verificat' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilizator negăsit' });
    }

    if (user.credits < servicePrice) {
      return res.status(400).json({ error: `Credit insuficient. Ai nevoie de ${servicePrice} credite.` });
    }

    user.credits -= servicePrice;
    await user.save();

    await CreditTransaction.create({
      userId,
      type: 'usage',
      amount: servicePrice,
      description: `Verificare MDM Lock pentru IMEI ${order.imei}`,
      orderId: orderId
    });

    console.log('[AppleMDM] Calling service 47 for IMEI:', order.imei);
    const mdmResult = await imeiService.callIMEIAPI(imeiService.SERVICES.APPLE_MDM_STATUS, order.imei);
    console.log('[AppleMDM] Raw result:', JSON.stringify(mdmResult, null, 2));

    if (!mdmResult || mdmResult.status !== 'success') {
      user.credits += servicePrice;
      await user.save();

      await CreditTransaction.create({
        userId,
        type: 'refund',
        amount: servicePrice,
        description: `Rambursare - eroare verificare MDM pentru IMEI ${order.imei}`,
        orderId: orderId
      });

      return res.status(500).json({ error: 'Eroare la verificarea statusului MDM' });
    }

    const parsed = parseAppleMdmHTML(mdmResult.result || '');

    if (!order.additionalServices) {
      order.additionalServices = [];
    }
    if (!order.additionalServices.includes(947)) {
      order.additionalServices.push(947);
    }

    const separator = '<br><br><hr><br>';
    order.result = (order.result || '') + separator + (mdmResult.result || '');

    if (!order.object || typeof order.object !== 'object') {
      if (typeof order.object === 'string') {
        try {
          order.object = JSON.parse(order.object);
        } catch (parseErr) {
          order.object = {};
        }
      } else {
        order.object = {};
      }
    }

    order.object.appleMdmCheck = {
      rawHtml: mdmResult.result || '',
      fields: parsed.fields,
      mdmLock: parsed.mdmLock,
      serviceOrderId: mdmResult.orderId || null,
      duration: mdmResult.duration || null,
      fetchedAt: new Date().toISOString()
    };
    order.markModified('object');

    await order.save();

    res.json({
      success: true,
      data: order.object.appleMdmCheck
    });
  } catch (error) {
    console.error('[AppleMDM] Error:', error);
    res.status(500).json({ error: 'Eroare la verificarea statusului MDM' });
  }
});

// POST endpoint to enhance verification with service 9 (provenance and risk)
router.post('/enhance/:orderId', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.userId;
    
    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Verificare negăsită' });
    }
    
    // Check access
    if (order.userId && order.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Nu ai acces la această verificare' });
    }
    
    // Check if order is completed
    if (order.status !== 'success') {
      return res.status(400).json({ error: 'Verificarea nu este finalizată' });
    }
    
    // Check if service 9 was already added
    if (order.additionalServices && order.additionalServices.includes(900)) {
      return res.status(400).json({ error: 'Datele au fost deja completate' });
    }
    
    // Check brand (only Apple and Samsung)
    const brand = order.brand || '';
    if (brand !== 'apple' && brand !== 'samsung') {
      return res.status(400).json({ error: 'Această funcție este disponibilă doar pentru Apple și Samsung' });
    }
    
    // Check user credits
    const user = await User.findById(userId);
    const servicePrice = 5; // 5 credits for service 9
    
    if (user.credits < servicePrice) {
      return res.status(400).json({ error: `Credit insuficient. Ai nevoie de ${servicePrice} credite.` });
    }
    
    // Deduct credits
    user.credits -= servicePrice;
    await user.save();
    
    // Create credit transaction
    await CreditTransaction.create({
      userId: userId,
      type: 'usage',
      amount: servicePrice,
      description: `Completare date proveniență și risc blocare pentru IMEI ${order.imei}`,
      orderId: orderId
    });
    
    // Call service 9
    console.log('[ENHANCE] Calling service 9 for IMEI:', order.imei);
    const service9Result = await imeiService.callIMEIAPI(9, order.imei);
    console.log('[ENHANCE] Service 9 raw result:', JSON.stringify(service9Result, null, 2));
    
    if (service9Result.status !== 'success') {
      console.log('[ENHANCE] Service 9 failed with status:', service9Result.status);
      // Refund credits on failure
      user.credits += servicePrice;
      await user.save();
      
      await CreditTransaction.create({
        userId: userId,
        type: 'refund',
        amount: servicePrice,
        description: `Rambursare - eroare serviciu 9 pentru IMEI ${order.imei}`,
        orderId: orderId
      });
      
      return res.status(500).json({ error: 'Eroare la obținerea datelor suplimentare' });
    }
    
    // Add service 9 to additional services
    if (!order.additionalServices) {
      order.additionalServices = [];
    }
    order.additionalServices.push(900);
    
    // Append service 9 result to order result
    const separator = '<br><br><hr><br>';
    order.result = (order.result || '') + separator + service9Result.result;
    
    // Store service 9 object data separately for easy access
    console.log('[ENHANCE] Service 9 result:', JSON.stringify(service9Result, null, 2));
    console.log('[ENHANCE] Service 9 object:', service9Result.object);
    
    if (service9Result.object) {
      // Ensure order.object is an object (not a string)
      if (!order.object || typeof order.object !== 'object') {
        order.object = {};
      }
      
      // If order.object is a string, parse it first
      if (typeof order.object === 'string') {
        try {
          order.object = JSON.parse(order.object);
        } catch (e) {
          order.object = {};
        }
      }
      
      order.object.service9Data = service9Result.object;
      console.log('[ENHANCE] Order object after adding service9Data:', JSON.stringify(order.object, null, 2));
      
      // Mark the object field as modified so Mongoose saves it
      order.markModified('object');
    } else {
      console.log('[ENHANCE] WARNING: service9Result.object is missing!');
    }
    
    await order.save();
    console.log('[ENHANCE] Order saved. Verifying saved data...');
    
    // Verify the data was saved
    const savedOrder = await Order.findById(orderId);
    console.log('[ENHANCE] Saved order.object:', savedOrder.object);
    console.log('[ENHANCE] Saved order.object.service9Data:', savedOrder.object?.service9Data);
    
    // Return success with service 9 data
    res.json({
      success: true,
      data: service9Result.object || {},
      result: service9Result.result || ''
    });
    
  } catch (error) {
    console.error('Enhance verification error:', error);
    res.status(500).json({ error: 'Eroare la completarea datelor' });
  }
});

// Stripe payment success callback
router.get('/payment/success', async (req, res) => {
  try {
    const { session_id, order_id } = req.query;
    
    if (!session_id || !order_id) {
      return res.status(400).render('error', {
        error: 'Parametri lipsă',
        user: req.user || null
      });
    }
    
    // Verify the session with Stripe
    const session = await stripeService.retrieveCheckoutSession(session_id);
    
    if (session.payment_status !== 'paid') {
      return res.status(400).render('error', {
        error: 'Plata nu a fost finalizată',
        user: req.user || null
      });
    }
    
    // Find the order
    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(404).render('404', { user: req.user || null });
    }
    
    // Verify session matches order
    if (order.stripeSessionId !== session_id) {
      return res.status(400).render('error', {
        error: 'Sesiune de plată invalidă',
        user: req.user || null
      });
    }
    
    // Update order payment status
    if (order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      order.stripePaymentIntentId = session.payment_intent;
      if (session.customer) {
        order.stripeCustomerId = session.customer;
      }
      await order.save();
      
      // Start verification now that payment is confirmed
      const additionalServiceIds = order.additionalServices || [];
      const jobLanguage = normalizeLang(order.language || DEFAULT_LANGUAGE);
      try {
        await addVerificationJob({
          orderId: order._id,
          imei: order.imei,
          userId: null,
          email: order.email,
          detectedBrand: order.brand || null,
          additionalServiceIds,
          language: jobLanguage
        });
      } catch (queueError) {
        if (queueError?.message && queueError.message.includes('already exists')) {
          console.log('[Queue] Job already enqueued for order', order._id);
        } else {
          console.error('[Queue] Failed to enqueue job after payment success:', queueError);
        }
      }
    }
    
    // Redirect to processing page
    res.redirect(`/verify/processing/${order._id}`);
  } catch (error) {
    console.error('Payment success handler error:', error);
    res.status(500).render('error', {
      error: 'Eroare la procesarea plății',
      user: req.user || null
    });
  }
});

// Stripe payment cancel callback
router.get('/payment/cancel', async (req, res) => {
  try {
    const { order_id } = req.query;
    
    if (order_id) {
      const order = await Order.findById(order_id);
      if (order && order.paymentStatus === 'pending') {
        // Optionally delete or mark the order as cancelled
        // For now, we'll just show a message
      }
    }
    
    res.render('verify/payment-cancelled', {
      title: 'Plată anulată',
      user: req.user || null,
      orderId: order_id
    });
  } catch (error) {
    console.error('Payment cancel handler error:', error);
    res.status(500).render('error', {
      error: 'Eroare',
      user: req.user || null
    });
  }
});

// Stripe webhook endpoint
// Note: This route is registered separately in server.js with express.raw() middleware
const webhookRouter = express.Router();
webhookRouter.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('⚠️  STRIPE_WEBHOOK_SECRET not set');
    return res.status(400).send('Webhook secret not configured');
  }
  
  let event;
  
  try {
    event = stripeService.verifyWebhookSignature(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('[WEBHOOK] Checkout session completed:', session.id);

      const topupResult = await processCreditTopupSession(session);
      if (topupResult.processed) {
        break;
      }
      
      // Handle IMEI verification payments
      const order = await Order.findOne({ stripeSessionId: session.id });
      if (order && order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        order.stripePaymentIntentId = session.payment_intent;
        if (session.customer) {
          order.stripeCustomerId = session.customer;
        }
        await order.save();
        
        // Start verification now that payment is confirmed
        const additionalServiceIds = order.additionalServices || [];
        const jobLanguage = normalizeLang(order.language || DEFAULT_LANGUAGE);
        try {
          await addVerificationJob({
            orderId: order._id,
            imei: order.imei,
            userId: null,
            email: order.email,
            detectedBrand: order.brand || null,
            additionalServiceIds,
            language: jobLanguage
          });
        } catch (queueError) {
          if (queueError?.message && queueError.message.includes('already exists')) {
            console.log('[Queue] Job already enqueued for order', order._id);
          } else {
            console.error('[Queue] Failed to enqueue job from webhook:', queueError);
          }
        }
      }
      break;
    }
      
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('[WEBHOOK] Payment intent succeeded:', paymentIntent.id);
      break;
      
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('[WEBHOOK] Payment failed:', failedPayment.id);
      
      // Find order by payment intent ID
      const failedOrder = await Order.findOne({ stripePaymentIntentId: failedPayment.id });
      if (failedOrder) {
        failedOrder.paymentStatus = 'failed';
        await failedOrder.save();
      }
      break;
      
    default:
      console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
  }
  
  res.json({ received: true });
});

module.exports = { router, webhookRouter };
