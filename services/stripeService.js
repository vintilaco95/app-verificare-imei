/**
 * Stripe payment service
 * Handles Stripe Checkout sessions and webhook verification
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { BASE_CURRENCY } = require('../config/currency');

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY not set in .env file');
}

/**
 * Create a Stripe Checkout session for one-time payment
 * Stripe requires minimum 2.00 RON per transaction
 */
async function createCheckoutSession(orderId, amount, email, imei, options = {}) {
  try {
    // Stripe minimum amount is 2.00 RON (200 cents)
    const MINIMUM_AMOUNT = 2.00;
    const finalAmount = Math.max(amount, MINIMUM_AMOUNT);
    
    // If amount was adjusted, log it
    if (finalAmount > amount) {
      console.log(`[Stripe] Amount adjusted from ${amount.toFixed(2)} to ${finalAmount.toFixed(2)} RON (Stripe minimum)`);
    }
    
    const {
      brand = null,
      additionalServiceIds = [],
      creditsAmount = null,
      currency: rawCurrency = BASE_CURRENCY,
      baseUrl = null, // Allow passing the original domain
      originDomain = null // Alternative: pass origin domain directly
    } = options || {};
    const currency = (rawCurrency || BASE_CURRENCY).toLowerCase();
    
    // Determine base URL: use provided baseUrl, or originDomain, or fallback to BASE_URL
    let checkoutBaseUrl = baseUrl;
    if (!checkoutBaseUrl && originDomain) {
      const protocol = originDomain.includes('localhost') ? 'http' : 'https';
      checkoutBaseUrl = `${protocol}://${originDomain}`;
    }
    if (!checkoutBaseUrl) {
      checkoutBaseUrl = process.env.BASE_URL || 'http://localhost:3000';
    }
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: 'Verificare IMEI',
              description: `Verificare IMEI pentru telefon: ${imei}`,
            },
            unit_amount: Math.round(finalAmount * 100), // Convert to cents (amount is in credits, 1 credit = 1 RON)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${checkoutBaseUrl}/verify/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${checkoutBaseUrl}/verify/payment/cancel?order_id=${orderId}`,
      customer_email: email,
      metadata: {
        orderId: orderId.toString(),
        imei: imei,
        type: 'imei_verification',
        brand: brand || 'unknown',
        additionalServices: Array.isArray(additionalServiceIds) && additionalServiceIds.length > 0
          ? additionalServiceIds.join(',')
          : '',
        creditsAmount: creditsAmount !== null ? creditsAmount.toString() : '',
        currency: currency.toUpperCase(),
        originalAmount: amount.toString(),
        finalAmount: finalAmount.toString(),
        originDomain: originDomain || '' // Store origin domain for reference
      },
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes expiry
    });

    return { session, adjustedAmount: finalAmount > amount ? finalAmount : null };
  } catch (error) {
    console.error('Stripe Checkout Session creation error:', error);
    throw new Error('Eroare la crearea sesiunii de plată');
  }
}

/**
 * Create a Stripe Checkout session for credit top-up
 * @param {String} userId
 * @param {Number} amount - Credits to add (1 credit = 1 RON)
 * @param {String} email
 * @param {Object} options - { packageId, successPath, cancelPath }
 */
async function createCreditTopupSession(userId, amount, email, options = {}) {
  try {
    const { packageId = 'custom', successPath = '/dashboard/credits/success', cancelPath = '/dashboard/credits/cancel' } = options;
    
    const MINIMUM_AMOUNT = 2.00;
    const finalAmount = Math.max(amount, MINIMUM_AMOUNT);

    if (finalAmount > amount) {
      console.log(`[Stripe] Credit top-up amount adjusted from ${amount.toFixed(2)} to ${finalAmount.toFixed(2)} RON (Stripe minimum)`);
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: BASE_CURRENCY.toLowerCase(),
            product_data: {
              name: 'Încărcare credite IMEI Check',
              description: `Pachet ${packageId !== 'custom' ? packageId : 'personalizat'} - ${finalAmount.toFixed(2)} credite`
            },
            unit_amount: Math.round(finalAmount * 100)
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${baseUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${cancelPath}`,
      customer_email: email,
      metadata: {
        type: 'credit_topup',
        userId: userId.toString(),
        packageId,
        requestedAmount: amount.toString(),
        chargedAmount: finalAmount.toString(),
        currency: BASE_CURRENCY
      },
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60)
    });

    return { session, adjustedAmount: finalAmount > amount ? finalAmount : null };
  } catch (error) {
    console.error('Stripe Credit Top-up Session error:', error);
    throw new Error('Eroare la crearea sesiunii de plată pentru credite');
  }
}

/**
 * Verify Stripe webhook signature
 */
function verifyWebhookSignature(payload, signature, secret) {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message);
    throw new Error('Invalid webhook signature');
  }
}

/**
 * Retrieve Stripe Checkout session
 */
async function retrieveCheckoutSession(sessionId) {
  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error('Error retrieving Stripe session:', error);
    throw error;
  }
}

/**
 * Retrieve Stripe Payment Intent
 */
async function retrievePaymentIntent(paymentIntentId) {
  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    console.error('Error retrieving Payment Intent:', error);
    throw error;
  }
}

module.exports = {
  createCheckoutSession,
  createCreditTopupSession,
  verifyWebhookSignature,
  retrieveCheckoutSession,
  retrievePaymentIntent
};

