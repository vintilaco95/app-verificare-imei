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
  calculateRiskScore
} = require('../services/emailFormatter');
const { processCreditTopupSession } = require('../services/creditTopupService');
const { addVerificationJob } = require('../services/verificationQueue');

// Show verification form
router.get('/imei', (req, res) => {
  res.render('verify/form', {
    title: 'Verificare IMEI',
    user: req.user || null,
    errors: null,
    pricing: PRICING.base,
    selectedBrand: null
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
      pricing: PRICING.base,
      selectedBrand: null
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
        pricing: PRICING.base,
        selectedBrand: null
      });
    }
    
    // Parse additional services
    const additionalServiceIds = Array.isArray(additionalServices) 
      ? additionalServices.map(id => parseInt(id))
      : (additionalServices ? [parseInt(additionalServices)] : []);
    
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
        pricing: PRICING.base,
        selectedBrand: null
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
      additionalServices: additionalServiceIds
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
        additionalServiceIds
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
        pricing: PRICING.base,
        selectedBrand: null
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
      pricing: PRICING.base,
      selectedBrand: null
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
      pricing: PRICING.base
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
        pricing: PRICING.base
      });
    }
    
    // Ensure brand is selected
    const availableBrands = Object.keys(PRICING.base);
    if (!brand || !availableBrands.includes(brand)) {
      return res.render('verify/form', {
        title: 'Verificare IMEI',
        errors: [{ msg: 'Te rugăm să selectezi brandul telefonului înainte de a continua.' }],
        user: null,
        pricing: PRICING.base,
        selectedBrand: brand || null
      });
    }
    
    // Parse additional services
    const additionalServiceIds = Array.isArray(additionalServices) 
      ? additionalServices.map(id => parseInt(id))
      : (additionalServices ? [parseInt(additionalServices)] : []);
    
    // Use selected brand for pricing
    const pricingBrand = brand;
    let detectedBrandForPricing = null;
    
    // Calculate total cost using selected brand
    const totalCost = calculateTotalPrice(pricingBrand, additionalServiceIds);
    
    // Validate price (security: prevent price manipulation)
    if (totalCost <= 0 || totalCost > 100) {
      return res.render('verify/form', {
        title: 'Verificare IMEI',
        errors: [{ msg: 'Preț invalid. Te rugăm să reîmprospătezi pagina și să încerci din nou.' }],
        user: null,
        pricing: PRICING.base
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
      price: totalCost,
      status: 'pending',
      paymentStatus: 'pending', // Payment required before verification
      result: null,
      object: null,
      brand: pricingBrand || 'unknown', // Will be confirmed via API
      model: 'Processing...',
      additionalServices: additionalServiceIds
    });
    await tempOrder.save();
    
    // Create Stripe Checkout session
    try {
      const { session, adjustedAmount } = await stripeService.createCheckoutSession(
        tempOrder._id.toString(),
        totalCost,
        email,
        imei,
        {
          brand: pricingBrand,
          additionalServiceIds
        }
      );
      
      // If amount was adjusted due to Stripe minimum, update order price
      if (adjustedAmount && adjustedAmount > totalCost) {
        tempOrder.price = adjustedAmount;
        console.log(`[Payment] Order price adjusted from ${totalCost.toFixed(2)} to ${adjustedAmount.toFixed(2)} RON (Stripe minimum)`);
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
        pricing: PRICING.base
      });
    }
  } catch (error) {
    console.error('Guest verification error:', error);
    res.render('verify/form', {
      title: 'Verificare IMEI',
      errors: [{ msg: 'Eroare la verificare. Încearcă din nou.' }],
      user: null,
      pricing: PRICING.base,
      selectedBrand: selectedBrandRaw || null
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
    
    // Check if order is still pending
    if (order.status === 'pending') {
      return res.redirect(`/verify/processing/${order._id}`);
    }
    
    // Check access (user must own the order or it's a guest order with email match)
    if (order.userId && req.session.userId && order.userId.toString() !== req.session.userId.toString()) {
      return res.status(403).render('error', { 
        error: 'Nu ai acces la acest rezultat',
        user: req.user || null
      });
    }
    
    // Determine template based on brand detected from service 11
    // Brand is already set in order.brand from the API verification process
    const brand = (order.brand || '').toLowerCase().trim();
    
    // Check brand-specific markers as fallback (in case brand wasn't set correctly)
    const isSamsung = brand === 'samsung' || (!order.object && order.result && order.result.includes('Knox Registered'));
    
    const isHonor = brand === 'honor' || (!order.object && order.result && (
      order.result.includes('HONOR') || 
      order.result.includes('Marketing Name:') ||
      order.result.includes('SKU Name:')
    ));
    
    const isMotorola = brand === 'motorola' || (order.result && (
      order.result.includes('MOTOROLA') ||
      order.result.includes('Moto') ||
      order.result.includes('Motorola')
    ));
    
    const isXiaomi = brand === 'xiaomi' || (order.result && (
      order.result.includes('Xiaomi') ||
      order.result.includes('MI ') ||
      order.result.includes('Redmi') ||
      order.result.includes('POCO') ||
      order.result.includes('MI Lock')
    ));
    
    const isPixel = brand === 'google' || brand === 'pixel' || (order.result && (
      order.result.includes('Pixel') ||
      order.result.includes('Google Pixel')
    ));
    
    const isHuawei = brand === 'huawei' || (order.result && (
      order.result.includes('Huawei') ||
      order.result.includes('SKU Name:') ||
      order.result.includes('nova') ||
      order.result.includes('HUAWEI')
    ));
    
    const renderCsrfToken = (typeof req.csrfToken === 'function') ? req.csrfToken() : '';
    console.log(`[VerifyResult] GET ${req.originalUrl} - csrfToken: ${renderCsrfToken || 'EMPTY'}`);
    
    // Parse additional service results
    const { parseAdditionalResults } = require('../services/parseAdditionalResults');
    const parsedResults = parseAdditionalResults(order);
    
    // Update order.result to only contain main result
    const mainOrder = { ...order.toObject() };
    mainOrder.result = parsedResults.mainResult;
    
    // Ensure order.object is properly parsed if it's a string
    if (mainOrder.object && typeof mainOrder.object === 'string') {
      try {
        mainOrder.object = JSON.parse(mainOrder.object);
      } catch (e) {
        console.error('Error parsing order.object:', e);
      }
    }
    
    if (isSamsung) {
      // Parse Samsung data - try service 21 format first, fallback to service 37 format
      const { parseSamsung21, mergeSamsungData } = require('../services/parseSamsung21');
      const { parseSamsungHTML } = require('../services/parseSamsungHTML');
      
      // Check if we have parsed data from service 21 (stored in order object or result)
      let samsungParsedData = null;
      
      // Try to get parsed data from order object if it was stored there
      if (mainOrder.object && mainOrder.object._parsedData) {
        samsungParsedData = mainOrder.object._parsedData;
      } else {
        // Parse from result HTML - try service 21 format first
        samsungParsedData = parseSamsung21(mainOrder.result || '');
        
        // If service 21 format doesn't have enough data, try service 37 format
        if (!samsungParsedData.marketingName || !samsungParsedData.warrantyStatus) {
          const data37 = parseSamsungHTML(mainOrder.result || '');
          samsungParsedData = mergeSamsungData(samsungParsedData, data37);
        }
      }
      
      // Extract MDM status from additional results if available
      let mdmStatus = null;
      let mdmLocked = null;
      if (parsedResults.additionalResults && parsedResults.additionalResults.length > 0) {
        for (const result of parsedResults.additionalResults) {
          if (result.parsedData) {
            if (result.parsedData.mdmStatus !== undefined) {
              mdmStatus = result.parsedData.mdmStatus;
            }
            if (result.parsedData.mdmLocked !== undefined) {
              mdmLocked = result.parsedData.mdmLocked;
            }
          }
        }
      }
      
      // Also check main order object for MDM
      if (mainOrder.object && mainOrder.object.mdmStatus !== undefined) {
        mdmStatus = mainOrder.object.mdmStatus;
      }
      if (mainOrder.object && mainOrder.object.mdmLocked !== undefined) {
        mdmLocked = mainOrder.object.mdmLocked;
      }
      
      // Format critical information for Samsung
      const reportData = mainOrder.object || samsungParsedData;
      const iCloud = null; // Not applicable for Samsung
      const blacklist = formatBlacklistStatus(
        reportData.gsmaBlacklisted, 
        reportData.blacklistStatus,
        reportData.blacklistRecords,
        reportData.blacklistData
      );
      // For Knox Guard, check explicitly if knoxGuard exists (even if false) in parsed data
      let knoxValue = null;
      if (samsungParsedData && samsungParsedData.knoxGuard !== undefined) {
        knoxValue = samsungParsedData.knoxGuard;
      } else if (samsungParsedData && samsungParsedData.knoxRegistered !== undefined) {
        knoxValue = samsungParsedData.knoxRegistered;
      } else if (reportData && reportData.knoxRegistered !== undefined) {
        knoxValue = reportData.knoxRegistered;
      }
      const knox = knoxValue !== null ? formatKnoxStatus(knoxValue) : formatKnoxStatus(null);
      // Use purchaseDate or productionDate for warranty calculation
      const warranty = formatWarrantyInfo(samsungParsedData.purchaseDate || samsungParsedData.productionDate || reportData.estPurchaseDate, null, 'samsung');
      
      let mdm = null;
      if (mdmStatus !== null || mdmLocked !== null) {
        mdm = formatMDMStatus(mdmStatus, mdmLocked);
      }
      
      const lostMode = null; // Not applicable for Samsung
      // Carrier from service 21: "Open" means unlocked, otherwise it's the carrier name
      const carrierText = samsungParsedData.carrier || reportData.carrier || '';
      const isUnlocked = carrierText.toLowerCase() === 'open' || carrierText.toLowerCase().includes('unlock');
      const networkLock = formatNetworkLockStatus(!isUnlocked, carrierText);
      const origin = formatOriginInfo(samsungParsedData.soldByCountry || samsungParsedData.shipToCountry || reportData.country, samsungParsedData.salesBuyerName || reportData.soldBy, samsungParsedData.soldByCountry || reportData.soldByCountry);
      
      // Calculate risk score
      const criticalInfo = {
        iCloud,
        blacklist,
        knox,
        mdm,
        lostMode,
        networkLock
      };
      
      const riskScore = calculateRiskScore(criticalInfo);
      
      // Determine risk text and color
      let riskText = 'Telefon sigur';
      let scoreColor = '#22c55e';
      let summaryText = 'Dispozitivul este în regulă pentru achiziție.';
      
      if (riskScore <= 2) {
        riskText = 'Dispozitiv PERICULOS';
        scoreColor = '#ef4444';
        summaryText = 'Dispozitivul are probleme critice — NU CUMPĂRA.';
      } else if (riskScore <= 4) {
        riskText = 'Dispozitiv cu RISC RIDICAT';
        scoreColor = '#f97316';
        summaryText = 'Dispozitivul are probleme importante — amână achiziția.';
      } else if (riskScore <= 6) {
        riskText = 'Dispozitiv cu RISC MODERAT';
        scoreColor = '#f59e0b';
        summaryText = 'Dispozitivul are probleme minore — verifică înainte de cumpărare.';
      }
      
      return res.render('verify/result-samsung', {
        title: 'Rezultat verificare IMEI',
        order: mainOrder,
        user: req.user || null,
        samsungParsedData: samsungParsedData,
        additionalResults: parsedResults.additionalResults,
        // Pass formatted critical information
        iCloud: iCloud || null,
        blacklist: blacklist || { status: 'unknown', text: 'Nu avem informații despre statusul blacklist' },
        knox: knox || null,
        mdm: mdm || null,
        lostMode: lostMode || null,
        networkLock: networkLock || { status: 'unknown', text: 'Nu avem informații despre blocarea rețelei' },
        warranty: warranty || { hasInfo: false, text: 'Nu avem informații despre garanție' },
        origin: origin || { hasInfo: false, text: 'Nu avem informații despre proveniență' },
        riskScore: riskScore || 9,
        riskText: riskText || 'Telefon sigur',
        scoreColor: scoreColor || '#22c55e',
        summaryText: summaryText || 'Dispozitivul este în regulă pentru achiziție.',
        csrfToken: renderCsrfToken,
        formatDate: formatDate || ((date) => date || 'Data necunoscută')
      });
    }
    
    if (isHonor) {
      // Parse Honor HTML data
      const { parseHonorHTML } = require('../services/parseHonorHTML');
      const honorParsedData = parseHonorHTML(mainOrder.result || '');
      
      // Format critical information for Honor
      const reportData = mainOrder.object || {};
      const iCloud = null; // Not applicable for Honor
      const blacklist = formatBlacklistStatus(
        reportData.gsmaBlacklisted, 
        reportData.blacklistStatus,
        reportData.blacklistRecords,
        reportData.blacklistData
      );
      const knox = null; // Not applicable for Honor
      
      // Extract MDM status from additional results if available
      let mdmStatus = null;
      let mdmLocked = null;
      if (parsedResults.additionalResults && parsedResults.additionalResults.length > 0) {
        for (const result of parsedResults.additionalResults) {
          if (result.parsedData) {
            if (result.parsedData.mdmStatus !== undefined) {
              mdmStatus = result.parsedData.mdmStatus;
            }
            if (result.parsedData.mdmLocked !== undefined) {
              mdmLocked = result.parsedData.mdmLocked;
            }
          }
        }
      }
      if (mainOrder.object && mainOrder.object.mdmStatus !== undefined) {
        mdmStatus = mainOrder.object.mdmStatus;
      }
      if (mainOrder.object && mainOrder.object.mdmLocked !== undefined) {
        mdmLocked = mainOrder.object.mdmLocked;
      }
      
      let mdm = null;
      if (mdmStatus !== null || mdmLocked !== null) {
        mdm = formatMDMStatus(mdmStatus, mdmLocked);
      }
      
      const lostMode = null; // Not applicable for Honor
      
      // Network lock - Honor devices are usually unlocked, but check if available
      const networkLock = formatNetworkLockStatus(false, ''); // Default to unlocked for Honor
      
      // Warranty info - use warranty start date from Honor data
      const warranty = formatWarrantyInfo(
        honorParsedData.warrantyStartDate || honorParsedData.bindDate, 
        null, 
        'honor'
      );
      
      // Origin info
      const origin = formatOriginInfo(
        honorParsedData.countryName || '', 
        honorParsedData.companyName || '', 
        honorParsedData.countryName || ''
      );
      
      // Calculate risk score
      const criticalInfo = { iCloud, blacklist, knox, mdm, lostMode, networkLock };
      const riskScore = calculateRiskScore(criticalInfo);
      
      // Determine risk text and color
      let riskText = 'Telefon sigur';
      let scoreColor = '#22c55e';
      let summaryText = 'Dispozitivul este în regulă pentru achiziție.';
      
      if (riskScore <= 2) {
        riskText = 'Dispozitiv PERICULOS';
        scoreColor = '#ef4444';
        summaryText = 'Dispozitivul are probleme critice — NU CUMPĂRA.';
      } else if (riskScore <= 4) {
        riskText = 'Dispozitiv cu RISC RIDICAT';
        scoreColor = '#f97316';
        summaryText = 'Dispozitivul are probleme importante — amână achiziția.';
      } else if (riskScore <= 6) {
        riskText = 'Dispozitiv cu RISC MODERAT';
        scoreColor = '#f59e0b';
        summaryText = 'Dispozitivul are probleme minore — verifică înainte de cumpărare.';
      }
      
      return res.render('verify/result-honor', {
        title: 'Rezultat verificare IMEI',
        order: mainOrder,
        user: req.user || null,
        honorParsedData: honorParsedData,
        additionalResults: parsedResults.additionalResults,
        // Pass formatted critical information
        iCloud: iCloud || null,
        blacklist: blacklist || { status: 'unknown', text: 'Nu avem informații despre statusul blacklist' },
        knox: knox || null,
        mdm: mdm || null,
        lostMode: lostMode || null,
        networkLock: networkLock || { status: 'unknown', text: 'Nu avem informații despre blocarea rețelei' },
        warranty: warranty || { hasInfo: false, text: 'Nu avem informații despre garanție' },
        origin: origin || { hasInfo: false, text: 'Nu avem informații despre proveniență' },
        riskScore: riskScore || 9,
        riskText: riskText || 'Telefon sigur',
        scoreColor: scoreColor || '#22c55e',
        summaryText: summaryText || 'Dispozitivul este în regulă pentru achiziție.',
        csrfToken: renderCsrfToken,
        formatDate: formatDate || ((date) => date || 'Data necunoscută')
      });
    }
    
    if (isMotorola) {
      // Parse Motorola HTML data
      const { parseMotorolaHTML } = require('../services/parseMotorolaHTML');
      const motorolaParsedData = parseMotorolaHTML(mainOrder.result || '');
      
      // Format critical information for Motorola
      const reportData = mainOrder.object || {};
      const iCloud = null; // Not applicable for Motorola
      const blacklist = formatBlacklistStatus(
        reportData.gsmaBlacklisted, 
        reportData.blacklistStatus,
        reportData.blacklistRecords,
        reportData.blacklistData
      );
      const knox = null; // Not applicable for Motorola
      
      // Extract MDM status from additional results if available
      let mdmStatus = null;
      let mdmLocked = null;
      if (parsedResults.additionalResults && parsedResults.additionalResults.length > 0) {
        for (const result of parsedResults.additionalResults) {
          if (result.parsedData) {
            if (result.parsedData.mdmStatus !== undefined) {
              mdmStatus = result.parsedData.mdmStatus;
            }
            if (result.parsedData.mdmLocked !== undefined) {
              mdmLocked = result.parsedData.mdmLocked;
            }
          }
        }
      }
      if (mainOrder.object && mainOrder.object.mdmStatus !== undefined) {
        mdmStatus = mainOrder.object.mdmStatus;
      }
      if (mainOrder.object && mainOrder.object.mdmLocked !== undefined) {
        mdmLocked = mainOrder.object.mdmLocked;
      }
      
      let mdm = null;
      if (mdmStatus !== null || mdmLocked !== null) {
        mdm = formatMDMStatus(mdmStatus, mdmLocked);
      }
      
      const lostMode = null; // Not applicable for Motorola
      
      // Network lock - check carrier, "WORLD COMM" usually means unlocked
      const carrierText = motorolaParsedData.carrier || '';
      const isUnlocked = carrierText.toLowerCase().includes('world comm') || carrierText.toLowerCase().includes('unlock');
      const networkLock = formatNetworkLockStatus(!isUnlocked, carrierText);
      
      // Warranty info - use warranty start date or activation date
      const warranty = formatWarrantyInfo(
        motorolaParsedData.warrantyStartDate || motorolaParsedData.activationDate, 
        motorolaParsedData.activationDate, 
        'motorola'
      );
      
      // Origin info
      const origin = formatOriginInfo(
        motorolaParsedData.shipToCountry || motorolaParsedData.soldByCountry || motorolaParsedData.country, 
        motorolaParsedData.soldToCustomerName || '', 
        motorolaParsedData.soldByCountry || ''
      );
      
      // Calculate risk score
      const criticalInfo = { iCloud, blacklist, knox, mdm, lostMode, networkLock };
      const riskScore = calculateRiskScore(criticalInfo);
      
      // Determine risk text and color
      let riskText = 'Telefon sigur';
      let scoreColor = '#22c55e';
      let summaryText = 'Dispozitivul este în regulă pentru achiziție.';
      
      if (riskScore <= 2) {
        riskText = 'Dispozitiv PERICULOS';
        scoreColor = '#ef4444';
        summaryText = 'Dispozitivul are probleme critice — NU CUMPĂRA.';
      } else if (riskScore <= 4) {
        riskText = 'Dispozitiv cu RISC RIDICAT';
        scoreColor = '#f97316';
        summaryText = 'Dispozitivul are probleme importante — amână achiziția.';
      } else if (riskScore <= 6) {
        riskText = 'Dispozitiv cu RISC MODERAT';
        scoreColor = '#f59e0b';
        summaryText = 'Dispozitivul are probleme minore — verifică înainte de cumpărare.';
      }
      
      return res.render('verify/result-motorola', {
        title: 'Rezultat verificare IMEI',
        order: mainOrder,
        user: req.user || null,
        motorolaParsedData: motorolaParsedData,
        additionalResults: parsedResults.additionalResults,
        // Pass formatted critical information
        iCloud: iCloud || null,
        blacklist: blacklist || { status: 'unknown', text: 'Nu avem informații despre statusul blacklist' },
        knox: knox || null,
        mdm: mdm || null,
        lostMode: lostMode || null,
        networkLock: networkLock || { status: 'unknown', text: 'Nu avem informații despre blocarea rețelei' },
        warranty: warranty || { hasInfo: false, text: 'Nu avem informații despre garanție' },
        origin: origin || { hasInfo: false, text: 'Nu avem informații despre proveniență' },
        riskScore: riskScore || 9,
        riskText: riskText || 'Telefon sigur',
        scoreColor: scoreColor || '#22c55e',
        summaryText: summaryText || 'Dispozitivul este în regulă pentru achiziție.',
        csrfToken: renderCsrfToken,
        formatDate: formatDate || ((date) => date || 'Data necunoscută')
      });
    }
    
    if (isXiaomi) {
      // Parse Xiaomi data (use JSON object if available, otherwise parse HTML)
      const { parseXiaomiHTML } = require('../services/parseXiaomiHTML');
      const xiaomiParsedData = parseXiaomiHTML(mainOrder.result || '', mainOrder.object || null);
      
      // Use Xiaomi-specific template
      return res.render('verify/result-xiaomi', {
        title: 'Rezultat verificare IMEI',
        order: mainOrder,
        user: req.user || null,
        xiaomiParsedData: xiaomiParsedData,
        additionalResults: parsedResults.additionalResults,
        csrfToken: renderCsrfToken
      });
    }
    
    if (isPixel) {
      // Parse Pixel HTML data
      const { parsePixelHTML } = require('../services/parsePixelHTML');
      const pixelParsedData = parsePixelHTML(mainOrder.result || '');
      
      // Format critical information for Pixel
      const reportData = mainOrder.object || {};
      const iCloud = null; // Not applicable for Pixel
      const blacklist = formatBlacklistStatus(
        reportData.gsmaBlacklisted, 
        reportData.blacklistStatus,
        reportData.blacklistRecords,
        reportData.blacklistData
      );
      const knox = null; // Not applicable for Pixel
      
      // Extract MDM status from additional results if available
      let mdmStatus = null;
      let mdmLocked = null;
      if (parsedResults.additionalResults && parsedResults.additionalResults.length > 0) {
        for (const result of parsedResults.additionalResults) {
          if (result.parsedData) {
            if (result.parsedData.mdmStatus !== undefined) {
              mdmStatus = result.parsedData.mdmStatus;
            }
            if (result.parsedData.mdmLocked !== undefined) {
              mdmLocked = result.parsedData.mdmLocked;
            }
          }
        }
      }
      if (mainOrder.object && mainOrder.object.mdmStatus !== undefined) {
        mdmStatus = mainOrder.object.mdmStatus;
      }
      if (mainOrder.object && mainOrder.object.mdmLocked !== undefined) {
        mdmLocked = mainOrder.object.mdmLocked;
      }
      
      let mdm = null;
      if (mdmStatus !== null || mdmLocked !== null) {
        mdm = formatMDMStatus(mdmStatus, mdmLocked);
      }
      
      const lostMode = null; // Not applicable for Pixel
      
      // Network lock - check if model includes "(Unlocked)" or "Unlocked"
      const modelText = pixelParsedData.model || '';
      const isUnlocked = modelText.toLowerCase().includes('(unlocked)') || modelText.toLowerCase().includes('unlocked');
      const networkLock = formatNetworkLockStatus(!isUnlocked, isUnlocked ? 'Unlocked' : '');
      
      // Warranty info - parse from warranty string
      // For Pixel, warranty is typically 2 years from activation
      // If warranty expired, calculate start date by subtracting 2 years from end date
      let warrantyStartDate = null;
      if (pixelParsedData.warrantyEndDateFormatted) {
        // Calculate start date: subtract 2 years from end date
        try {
          const endDate = new Date(pixelParsedData.warrantyEndDateFormatted);
          if (!isNaN(endDate.getTime())) {
            const startDate = new Date(endDate);
            startDate.setFullYear(startDate.getFullYear() - 2);
            warrantyStartDate = startDate.toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn('Could not parse warranty end date for Pixel:', e);
        }
      } else if (pixelParsedData.warrantyEndDate) {
        // Try to parse DD.MM.YYYY format
        const dateParts = pixelParsedData.warrantyEndDate.split(/[.\/]/);
        if (dateParts.length === 3) {
          const day = dateParts[0].padStart(2, '0');
          const month = dateParts[1].padStart(2, '0');
          const year = dateParts[2].length === 2 ? '20' + dateParts[2] : dateParts[2];
          try {
            const endDate = new Date(`${year}-${month}-${day}`);
            if (!isNaN(endDate.getTime())) {
              const startDate = new Date(endDate);
              startDate.setFullYear(startDate.getFullYear() - 2);
              warrantyStartDate = startDate.toISOString().split('T')[0];
            }
          } catch (e) {
            console.warn('Could not parse warranty end date for Pixel:', e);
          }
        }
      }
      const warranty = formatWarrantyInfo(
        warrantyStartDate, 
        pixelParsedData.activationStatus === 'Activated' ? warrantyStartDate : null, 
        'pixel'
      );
      
      // Origin info - Pixel doesn't have origin info in API response
      const origin = formatOriginInfo(null, null, null);
      
      // Calculate risk score
      const criticalInfo = { iCloud, blacklist, knox, mdm, lostMode, networkLock };
      const riskScore = calculateRiskScore(criticalInfo);
      
      // Determine risk text and color
      let riskText = 'Telefon sigur';
      let scoreColor = '#22c55e';
      let summaryText = 'Dispozitivul este în regulă pentru achiziție.';
      
      if (riskScore <= 2) {
        riskText = 'Dispozitiv PERICULOS';
        scoreColor = '#ef4444';
        summaryText = 'Dispozitivul are probleme critice — NU CUMPĂRA.';
      } else if (riskScore <= 4) {
        riskText = 'Dispozitiv cu RISC RIDICAT';
        scoreColor = '#f97316';
        summaryText = 'Dispozitivul are probleme importante — amână achiziția.';
      } else if (riskScore <= 6) {
        riskText = 'Dispozitiv cu RISC MODERAT';
        scoreColor = '#f59e0b';
        summaryText = 'Dispozitivul are probleme minore — verifică înainte de cumpărare.';
      }
      
      return res.render('verify/result-pixel', {
        title: 'Rezultat verificare IMEI',
        order: mainOrder,
        user: req.user || null,
        pixelParsedData: pixelParsedData,
        additionalResults: parsedResults.additionalResults,
        // Pass formatted critical information
        iCloud: iCloud || null,
        blacklist: blacklist || { status: 'unknown', text: 'Nu avem informații despre statusul blacklist' },
        knox: knox || null,
        mdm: mdm || null,
        lostMode: lostMode || null,
        networkLock: networkLock || { status: 'unknown', text: 'Nu avem informații despre blocarea rețelei' },
        warranty: warranty || { hasInfo: false, text: 'Nu avem informații despre garanție' },
        origin: origin || { hasInfo: false, text: 'Nu avem informații despre proveniență' },
        riskScore: riskScore || 9,
        riskText: riskText || 'Telefon sigur',
        scoreColor: scoreColor || '#22c55e',
        summaryText: summaryText || 'Dispozitivul este în regulă pentru achiziție.',
        csrfToken: renderCsrfToken,
        formatDate: formatDate || ((date) => date || 'Data necunoscută')
      });
    }
    
    if (isHuawei) {
      // Parse Huawei HTML data
      const { parseHuaweiHTML } = require('../services/parseHuaweiHTML');
      const huaweiParsedData = parseHuaweiHTML(mainOrder.result || '');
      
      // Format critical information for Huawei
      const reportData = mainOrder.object || {};
      const iCloud = null; // Not applicable for Huawei
      const blacklist = formatBlacklistStatus(
        reportData.gsmaBlacklisted, 
        reportData.blacklistStatus,
        reportData.blacklistRecords,
        reportData.blacklistData
      );
      const knox = null; // Not applicable for Huawei
      
      // Extract MDM status from additional results if available
      let mdmStatus = null;
      let mdmLocked = null;
      if (parsedResults.additionalResults && parsedResults.additionalResults.length > 0) {
        for (const result of parsedResults.additionalResults) {
          if (result.parsedData) {
            if (result.parsedData.mdmStatus !== undefined) {
              mdmStatus = result.parsedData.mdmStatus;
            }
            if (result.parsedData.mdmLocked !== undefined) {
              mdmLocked = result.parsedData.mdmLocked;
            }
          }
        }
      }
      if (mainOrder.object && mainOrder.object.mdmStatus !== undefined) {
        mdmStatus = mainOrder.object.mdmStatus;
      }
      if (mainOrder.object && mainOrder.object.mdmLocked !== undefined) {
        mdmLocked = mainOrder.object.mdmLocked;
      }
      
      let mdm = null;
      if (mdmStatus !== null || mdmLocked !== null) {
        mdm = formatMDMStatus(mdmStatus, mdmLocked);
      }
      
      const lostMode = null; // Not applicable for Huawei
      const networkLock = formatNetworkLockStatus(false, ''); // Default to unlocked for Huawei
      
      // Warranty info - use warranty start date and end date from Huawei data
      // For Huawei, warranty is 2 years from start date
      let warranty = null;
      if (huaweiParsedData.warrantyStartDate || huaweiParsedData.warrantyEndDate) {
        // Use formatWarrantyInfo with start date, but also check end date
        warranty = formatWarrantyInfo(
          huaweiParsedData.warrantyStartDate, 
          null, 
          'huawei'
        );
        
        // If we have end date, update warranty info
        if (huaweiParsedData.warrantyEndDate) {
          try {
            const endDate = new Date(huaweiParsedData.warrantyEndDate);
            const now = new Date();
            const isExpired = endDate < now;
            
            if (isExpired) {
              warranty.status = 'expired';
              warranty.text = `Garanție expirată (până la ${huaweiParsedData.warrantyEndDateOriginal || huaweiParsedData.warrantyEndDate})`;
            } else {
              warranty.status = 'active';
              warranty.text = `În garanție până la ${huaweiParsedData.warrantyEndDateOriginal || huaweiParsedData.warrantyEndDate}`;
            }
            warranty.hasInfo = true;
            warranty.endDate = endDate;
          } catch (e) {
            // If date parsing fails, use warranty status from API
            if (huaweiParsedData.warrantyStatus) {
              warranty.hasInfo = true;
              warranty.status = huaweiParsedData.warrantyStatus.toLowerCase().includes('out') ? 'expired' : 'active';
              warranty.text = huaweiParsedData.warrantyStatus;
            }
          }
        } else if (huaweiParsedData.warrantyStatus) {
          warranty.hasInfo = true;
          warranty.status = huaweiParsedData.warrantyStatus.toLowerCase().includes('out') ? 'expired' : 'active';
          warranty.text = huaweiParsedData.warrantyStatus;
        }
      } else {
        warranty = formatWarrantyInfo(null, null, 'huawei');
      }
      
      // Origin info - Huawei doesn't have origin info in API response
      const origin = formatOriginInfo(null, null, null);
      
      // Calculate risk score
      const criticalInfo = { iCloud, blacklist, knox, mdm, lostMode, networkLock };
      const riskScore = calculateRiskScore(criticalInfo);
      
      // Determine risk text and color
      let riskText = 'Telefon sigur';
      let scoreColor = '#22c55e';
      let summaryText = 'Dispozitivul este în regulă pentru achiziție.';
      
      if (riskScore <= 2) {
        riskText = 'Dispozitiv PERICULOS';
        scoreColor = '#ef4444';
        summaryText = 'Dispozitivul are probleme critice — NU CUMPĂRA.';
      } else if (riskScore <= 4) {
        riskText = 'Dispozitiv cu RISC RIDICAT';
        scoreColor = '#f97316';
        summaryText = 'Dispozitivul are probleme importante — amână achiziția.';
      } else if (riskScore <= 6) {
        riskText = 'Dispozitiv cu RISC MODERAT';
        scoreColor = '#f59e0b';
        summaryText = 'Dispozitivul are probleme minore — verifică înainte de cumpărare.';
      }
      
      return res.render('verify/result-huawei', {
        title: 'Rezultat verificare IMEI',
        order: mainOrder,
        user: req.user || null,
        huaweiParsedData: huaweiParsedData,
        additionalResults: parsedResults.additionalResults,
        // Pass formatted critical information
        iCloud: iCloud || null,
        blacklist: blacklist || { status: 'unknown', text: 'Nu avem informații despre statusul blacklist' },
        knox: knox || null,
        mdm: mdm || null,
        lostMode: lostMode || null,
        networkLock: networkLock || { status: 'unknown', text: 'Nu avem informații despre blocarea rețelei' },
        warranty: warranty || { hasInfo: false, text: 'Nu avem informații despre garanție' },
        origin: origin || { hasInfo: false, text: 'Nu avem informații despre proveniență' },
        riskScore: riskScore || 9,
        riskText: riskText || 'Telefon sigur',
        scoreColor: scoreColor || '#22c55e',
        summaryText: summaryText || 'Dispozitivul este în regulă pentru achiziție.',
        csrfToken: renderCsrfToken,
        formatDate: formatDate || ((date) => date || 'Data necunoscută')
      });
    }
    
    // Extract MDM status from additional results if available
    let mdmStatus = null;
    let mdmLocked = null;
    if (parsedResults.additionalResults && parsedResults.additionalResults.length > 0) {
      for (const result of parsedResults.additionalResults) {
        if (result.parsedData) {
          if (result.parsedData.mdmStatus !== undefined) {
            mdmStatus = result.parsedData.mdmStatus;
          }
          if (result.parsedData.mdmLocked !== undefined) {
            mdmLocked = result.parsedData.mdmLocked;
          }
        }
      }
    }
    
    // Also check main order object for MDM
    if (mainOrder.object && mainOrder.object.mdmStatus !== undefined) {
      mdmStatus = mainOrder.object.mdmStatus;
    }
    if (mainOrder.object && mainOrder.object.mdmLocked !== undefined) {
      mdmLocked = mainOrder.object.mdmLocked;
    }
    
    // Format critical information using helper functions
    const reportData = mainOrder.object || {};
    const isApple = brand === 'apple' || brand === 'iphone';
    
    const iCloud = formatiCloudStatus(reportData.fmiOn, reportData.fmiON);
    const blacklist = formatBlacklistStatus(
      reportData.gsmaBlacklisted, 
      reportData.blacklistStatus,
      reportData.blacklistRecords,
      reportData.blacklistData
    );
    const knox = (brand === 'samsung') ? formatKnoxStatus(reportData.knoxRegistered) : null;
    const warranty = formatWarrantyInfo(reportData.estPurchaseDate, reportData.activationDate, brand);
    
    let mdm = null;
    if (mdmStatus !== null || mdmLocked !== null) {
      mdm = formatMDMStatus(mdmStatus, mdmLocked);
    }
    
    const lostMode = isApple ? formatLostModeStatus(reportData.lostMode) : null;
    const networkLock = formatNetworkLockStatus(reportData.simlock, reportData.carrier);
    const origin = formatOriginInfo(reportData.country, reportData.soldBy, reportData.soldByCountry);
    
    // Calculate risk score
    const info = {
      iCloud,
      blacklist,
      knox,
      mdm,
      lostMode,
      networkLock
    };
    
    const riskScore = calculateRiskScore(info);
    
    // Determine risk text and color
    let riskText = 'Telefon sigur';
    let scoreColor = '#22c55e';
    let summaryText = 'Dispozitivul este în regulă pentru achiziție.';
    
    if (riskScore <= 2) {
      riskText = 'Dispozitiv PERICULOS';
      scoreColor = '#ef4444';
      summaryText = 'Dispozitivul are probleme critice — NU CUMPĂRA.';
    } else if (riskScore <= 4) {
      riskText = 'Dispozitiv cu RISC RIDICAT';
      scoreColor = '#f97316';
      summaryText = 'Dispozitivul are probleme importante — amână achiziția.';
    } else if (riskScore <= 6) {
      riskText = 'Dispozitiv cu RISC MODERAT';
      scoreColor = '#f59e0b';
      summaryText = 'Dispozitivul are probleme minore — verifică înainte de cumpărare.';
    }
    
    // Default to Apple/generic template if brand is not Samsung, Honor, Motorola, or Xiaomi
    res.render('verify/result', {
      title: 'Rezultat verificare IMEI',
      order: mainOrder,
      user: req.user || null,
      brand: brand || 'apple',
      additionalResults: parsedResults.additionalResults,
      // Pass formatted critical information
      iCloud,
      blacklist,
      knox,
      mdm,
      lostMode,
      networkLock,
      warranty,
      origin,
      riskScore,
      riskText,
      scoreColor,
      summaryText,
      // Helper functions
      formatDate,
      csrfToken: renderCsrfToken
    });
  } catch (error) {
    console.error('Result error:', error);
    res.status(500).render('error', {
      error: 'Eroare la încărcarea rezultatului',
      user: req.user || null
    });
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
      try {
        await addVerificationJob({
          orderId: order._id,
          imei: order.imei,
          userId: null,
          email: order.email,
          detectedBrand: order.brand || null,
          additionalServiceIds
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
        try {
          await addVerificationJob({
            orderId: order._id,
            imei: order.imei,
            userId: null,
            email: order.email,
            detectedBrand: order.brand || null,
            additionalServiceIds
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
