const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');

/**
 * Process a Stripe Checkout session for credit top-up.
 * Adds credits to the associated user and records a transaction.
 * @param {Object} session Stripe checkout session object
 * @returns {Object} result { processed, transaction, alreadyProcessed, error }
 */
async function processCreditTopupSession(session) {
  const metadata = session && session.metadata ? session.metadata : {};

  if (!metadata || metadata.type !== 'credit_topup') {
    return { processed: false };
  }

  try {
    const userId = metadata.userId;
    if (!userId) {
      console.warn('[CreditTopup] Missing userId in session metadata');
      return { processed: false };
    }

    const user = await User.findById(userId);
    if (!user) {
      console.warn('[CreditTopup] User not found for ID:', userId);
      return { processed: false };
    }

    const paymentIntentId = session.payment_intent;
    if (paymentIntentId) {
      const existingTransaction = await CreditTransaction.findOne({ stripePaymentIntentId: paymentIntentId });
      if (existingTransaction) {
        console.log('[CreditTopup] Transaction already recorded for payment intent:', paymentIntentId);
        return { processed: true, transaction: existingTransaction, alreadyProcessed: true };
      }
    }

    const chargedAmount = metadata.chargedAmount
      ? parseFloat(metadata.chargedAmount)
      : session.amount_total / 100;

    if (isNaN(chargedAmount) || chargedAmount <= 0) {
      console.warn('[CreditTopup] Invalid charged amount:', metadata.chargedAmount);
      return { processed: false };
    }

    user.credits += chargedAmount;
    await user.save();

    const transaction = await CreditTransaction.create({
      userId: user._id,
      type: 'purchase',
      amount: chargedAmount,
      description: `Încărcare credite cu cardul (${chargedAmount.toFixed(2)} credite)`,
      stripePaymentIntentId: paymentIntentId || null,
      stripeSessionId: session.id
    });

    console.log('[CreditTopup] Credited user', user.email, 'amount:', chargedAmount);
    return { processed: true, transaction, alreadyProcessed: false };
  } catch (error) {
    console.error('[CreditTopup] Error processing credit top-up:', error);
    return { processed: false, error };
  }
}

module.exports = {
  processCreditTopupSession
};

