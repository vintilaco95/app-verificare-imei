const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const imeiService = require('../services/imeiService');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');

// Get account balance
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const balance = await imeiService.getBalance();
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add credits to user account (temporary endpoint for testing)
router.post('/add-credits', requireAuth, async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount) || 100;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Add credits
    user.credits += amount;
    await user.save();
    
    // Record transaction
    const transaction = new CreditTransaction({
      userId: user._id,
      type: 'purchase',
      amount: amount,
      description: `Credite adăugate: ${amount}`
    });
    await transaction.save();
    
    res.json({ 
      success: true, 
      message: `Adăugate ${amount} credite în cont`,
      newBalance: user.credits 
    });
  } catch (error) {
    console.error('Add credits error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
