const Order = require('../models/Order');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const imeiService = require('./imeiService');
const emailService = require('./emailService');
const pricingService = require('./pricingService');
const { DEFAULT_LANGUAGE, normalizeLang } = require('./emailFormatter');
const { CREDIT_VALUE, BASE_CURRENCY } = require('../config/currency');

async function processOrder(jobData) {
  const {
    orderId,
    imei,
    userId = null,
    email = null,
    detectedBrand = null,
    additionalServiceIds = [],
    language: jobLanguage = null
  } = jobData;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      console.warn(`[OrderProcessor] Order ${orderId} not found. Skipping job.`);
      return;
    }

    if (!userId && order.paymentStatus !== 'paid') {
      console.warn(`[OrderProcessor] Guest order ${orderId} payment incomplete. Marking as failed.`);
      order.status = 'failed';
      order.model = 'Plata nu a fost finalizată';
      await order.save();
      return;
    }

    const lang = normalizeLang((order && order.language) || jobLanguage || DEFAULT_LANGUAGE);
    order.language = lang;

    const result = await imeiService.verifyIMEI(
      imei,
      userId,
      email,
      detectedBrand,
      additionalServiceIds
    );

    if (!result.success) {
      await markOrderFailed(order, imei, userId, 'Eroare verificare IMEI');
      return;
    }

    const initialPrice = order.price || 0;
    const effectiveBrandForPricing = (result.brand || order.brand || 'default');
    const baseCalculatedCost = await pricingService.calculateTotalCredits(effectiveBrandForPricing, additionalServiceIds);
    let computedPrice = baseCalculatedCost;

    if (!userId) {
      const baseCredits = await pricingService.getBasePrice(effectiveBrandForPricing);
      const additionalCredits = Math.max(0, parseFloat((baseCalculatedCost - baseCredits).toFixed(2)));
      const guestBaseAmount = await pricingService.getGuestPrice(effectiveBrandForPricing);
      order.currency = BASE_CURRENCY;
      order.currencyAmount = parseFloat((guestBaseAmount + additionalCredits * CREDIT_VALUE).toFixed(2));
    }

    let priceDifference = 0;
    if (Math.abs(computedPrice - initialPrice) > 0.0001) {
      priceDifference = parseFloat((computedPrice - initialPrice).toFixed(2));
      order.price = computedPrice;
    } else if (order.price !== computedPrice) {
      order.price = computedPrice;
    }

    order.orderId = result.data.orderId || order.orderId;
    order.serviceId = result.data.service || order.serviceId;
    order.serviceName = 'IMEI Verification';
    order.status = result.data.status === 'success' ? 'success' : 'failed';
    order.result = result.data.result || '';
    order.object = result.data.object || null;
    order.brand = result.brand || order.brand;
    order.model = result.model || order.model;

    if (!userId && !order.currencyAmount) {
      order.currency = BASE_CURRENCY;
      order.currencyAmount = parseFloat((order.price * CREDIT_VALUE).toFixed(2));
    }

    await order.save();

    if (userId && Math.abs(priceDifference) > 0.0001) {
      await handlePriceAdjustment(userId, order, imei, priceDifference);
    }

    if (userId && (order.status === 'failed' || order.status === 'error')) {
      await refundUser(userId, order, `Refund pentru verificare eșuată IMEI: ${imei}`);
    }

    if (result.data && result.data.status === 'success') {
      await sendEmailResult(userId, email, order, result.data, lang);
    }
  } catch (error) {
    console.error('[OrderProcessor] Error while processing order:', error);
    await handleProcessingError(jobData, error);
  }
}

async function markOrderFailed(order, imei, userId, reason) {
  order.status = 'failed';
  order.model = 'Error';
  await order.save();

  if (userId) {
    await refundUser(userId, order, `${reason}: ${imei}`);
  }
}

async function handlePriceAdjustment(userId, order, imei, priceDifference) {
  const user = await User.findById(userId);
  if (!user) return;

  const adjustmentDescription = `Ajustare preț verificare IMEI: ${imei}`;

  if (priceDifference > 0) {
    user.credits -= priceDifference;
    await user.save();

    await CreditTransaction.create({
      userId: user._id,
      type: 'usage',
      amount: -priceDifference,
      description: adjustmentDescription,
      orderId: order._id
    });
  } else if (priceDifference < 0) {
    const refundAmount = Math.abs(priceDifference);
    user.credits += refundAmount;
    await user.save();

    await CreditTransaction.create({
      userId: user._id,
      type: 'refund',
      amount: refundAmount,
      description: adjustmentDescription,
      orderId: order._id
    });
  }
}

async function refundUser(userId, order, description) {
  const user = await User.findById(userId);
  if (!user) return;

  user.credits += order.price;
  await user.save();

  await CreditTransaction.create({
    userId: user._id,
    type: 'refund',
    amount: order.price,
    description,
    orderId: order._id
  });
}

async function sendEmailResult(userId, email, order, resultData, lang) {
  const { generateResultHTML } = require('./generateResultHTML');
  const { emailHTML, fullHTML } = await generateResultHTML(order, { lang });

  let targetEmail = email;
  if (!targetEmail && userId) {
    const user = await User.findById(userId);
    targetEmail = user ? user.email : null;
  }

  if (!targetEmail) {
    console.warn(`[OrderProcessor] No email available for order ${order._id}. Skipping notification.`);
    return;
  }

  await emailService.sendVerificationResult(targetEmail, order, resultData, {
    emailHTML,
    fullHTML
  }, {
    lang
  });
  order.emailSent = true;
  await order.save();
}

async function handleProcessingError(jobData, error) {
  const { orderId, imei, userId } = jobData;

  try {
    const order = await Order.findById(orderId);
    if (!order) return;

    order.status = 'error';
    order.model = 'Error';
    await order.save();

    if (userId) {
      await refundUser(userId, order, `Refund pentru eroare verificare IMEI: ${imei}`);
    }
  } catch (err) {
    console.error('[OrderProcessor] Failed to update order after error:', err);
  }
}

module.exports = {
  processOrder
};

