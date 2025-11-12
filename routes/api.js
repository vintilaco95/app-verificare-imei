const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const imeiService = require('../services/imeiService');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const Order = require('../models/Order');
const { generateFaneBotReply, ensureArray, toTitleCase } = require('../services/faneBotService');

const MAX_SESSION_HISTORY = parseInt(process.env.FANE_BOT_SESSION_LIMIT || '12', 10);
const MAX_SESSION_ORDERS = parseInt(process.env.FANE_BOT_ORDERS_LIMIT || '5', 10);

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

function getFaneSession(req) {
  if (!req.session) return {
    history: [],
    sessionOrders: [],
    currentOrder: null,
    lastAccountOrder: null
  };

  if (!req.session.faneBot) {
    req.session.faneBot = {
      history: [],
      sessionOrders: [],
      currentOrder: null,
      lastAccountOrder: null
    };
  }

  return req.session.faneBot;
}

function trimHistory(history) {
  const items = ensureArray(history);
  if (items.length <= MAX_SESSION_HISTORY) {
    return items;
  }
  return items.slice(items.length - MAX_SESSION_HISTORY);
}

function sanitizeOrder(order) {
  if (!order) return null;
  const createdAt = order.createdAt ? new Date(order.createdAt).toISOString() : null;

  return {
    orderId: order._id ? order._id.toString() : (order.orderId || null),
    imei: order.imei || null,
    imei2: order.imei2 || null,
    brand: order.brand || null,
    model: order.model || null,
    modelDesc: order.modelDesc || null,
    status: order.status || null,
    price: typeof order.price !== 'undefined' ? order.price : null,
    currency: order.currency || null,
    language: order.language || null,
    riskScore: typeof order.riskScore !== 'undefined' ? order.riskScore : null,
    riskLabel: order.riskLabel || null,
    summaryLabel: order.summaryLabel || null,
    createdAt,
    object: order.object || null,
    resultHtml: order.result || null,
    appleMdm: order.appleMdm || null,
    blacklist: order.blacklist || null,
    mdm: order.mdm || null,
    iCloud: order.iCloud || null,
    networkLock: order.networkLock || null
  };
}

function mergeOrderData(base, extra) {
  const result = { ...(base || {}) };
  if (!extra || typeof extra !== 'object') {
    return result;
  }

  Object.entries(extra).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (key === 'fullReport' || key === 'object') {
      result.object = value;
      return;
    }

    if (key === 'statuses') {
      result.statuses = { ...(result.statuses || {}), ...(value || {}) };
      return;
    }

    if (key === 'orderId' && !result.orderId) {
      result.orderId = value;
      return;
    }

    result[key] = value;
  });

  return result;
}

function recordSessionOrder(chat, orderData) {
  if (!orderData) {
    return;
  }

  chat.sessionOrders = ensureArray(chat.sessionOrders);

  if (orderData.orderId) {
    const existingIndex = chat.sessionOrders.findIndex(item => item.orderId === orderData.orderId);
    if (existingIndex >= 0) {
      chat.sessionOrders[existingIndex] = orderData;
    } else {
      chat.sessionOrders.push(orderData);
    }
  } else {
    chat.sessionOrders.push(orderData);
  }

  if (chat.sessionOrders.length > MAX_SESSION_ORDERS) {
    chat.sessionOrders = chat.sessionOrders.slice(chat.sessionOrders.length - MAX_SESSION_ORDERS);
  }
}

function getUserDisplayName(user) {
  if (!user) return null;
  if (user.name) return toTitleCase(user.name);
  if (user.profile && user.profile.name) return toTitleCase(user.profile.name);
  if (user.firstName || user.lastName) {
    return toTitleCase([user.firstName, user.lastName].filter(Boolean).join(' '));
  }
  if (user.email) {
    const localPart = user.email.split('@')[0];
    return toTitleCase(localPart.replace(/[\d._-]+/g, ' ').trim());
  }
  return null;
}

function isGreetingMessage(message) {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;
  const greetingRegex = /^(salut|salutare|bun[ăa]|servus|hei|hey|hello|hi|ciao|yo|alo|neatza|neatza|saru'?m[aă]na|buna ziua)\b/;
  return greetingRegex.test(normalized) && normalized.split(/\s+/).length <= 6;
}

function shouldReferenceOrder(message) {
  if (!message) return false;
  return /(imei|verific|telefon|device|blocaj|blacklist|icloud|mdm|network|sim|warranty|scor|risk|negoc|cumpar|vinde|rezultat|status|raport|mdm|lock|activation|detalii)/i.test(message);
}

function buildGreetingReply(userName, language) {
  const friendlyName = userName || (language === 'en' ? 'boss' : 'șefu');

  if (language === 'en') {
    return `Hey ${friendlyName}! Am I helping you with a phone or just chilling? Spit it out.`;
  }

  return `Salut, ${friendlyName}! Zii ce te roade la telefon și vedem cum îl scoatem la un preț bun.`;
}

async function fetchOrderForUser(userId, orderId) {
  if (!orderId) return null;
  const dbOrder = await Order.findOne({ _id: orderId, userId }).lean();
  if (!dbOrder) return null;
  return sanitizeOrder(dbOrder);
}

async function fetchLastAccountOrder(userId) {
  const lastOrder = await Order.findOne({ userId }).sort({ createdAt: -1 }).lean();
  return sanitizeOrder(lastOrder);
}

async function resolveCurrentOrder({ userId, providedContext, providedOrderId, chat }) {
  const contextOrderId = providedOrderId || (providedContext && providedContext.orderId);
  let resolved = null;

  if (contextOrderId) {
    resolved = await fetchOrderForUser(userId, contextOrderId);
  }

  if (providedContext && typeof providedContext === 'object') {
    resolved = mergeOrderData(resolved, providedContext);
  }

  if (!resolved) {
    resolved = chat.currentOrder || null;
  }

  return resolved;
}

router.post('/fane-bot/reset', requireAuth, (req, res) => {
  if (req.session) {
    req.session.faneBot = {
      history: [],
      sessionOrders: [],
      currentOrder: null,
      lastAccountOrder: null
    };
  }

  return res.json({ success: true });
});

router.get('/fane-bot/history', requireAuth, (req, res) => {
  try {
    const chat = getFaneSession(req);
    return res.json({
      success: true,
      history: ensureArray(chat.history),
      currentOrder: chat.currentOrder || null,
      sessionOrders: ensureArray(chat.sessionOrders)
    });
  } catch (error) {
    console.error('[API] FANE history error:', error);
    return res.status(500).json({ success: false, error: 'Nu am putut încărca conversația.' });
  }
});

router.post('/fane-bot', requireAuth, async (req, res) => {
  try {
    const { message, orderId, context, language } = req.body || {};
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';

    if (!trimmedMessage) {
      return res.status(400).json({ success: false, error: 'Mesajul este obligatoriu.' });
    }

    const chat = getFaneSession(req);
    const userLanguage = language || (req.session && req.session.lang) || 'ro';
    const userName = getUserDisplayName(req.user);

    const mentionOrder = shouldReferenceOrder(trimmedMessage);

    // Handle simple greetings without hitting the model
    if (!mentionOrder && isGreetingMessage(trimmedMessage)) {
      const reply = buildGreetingReply(userName, userLanguage);
      chat.history = trimHistory([
        ...ensureArray(chat.history),
        { role: 'user', content: trimmedMessage, createdAt: new Date() },
        { role: 'assistant', content: reply, createdAt: new Date() }
      ]);

      if (req.session) {
        req.session.faneBot = chat;
      }

      return res.json({
        success: true,
        reply,
        history: chat.history,
        currentOrder: chat.currentOrder || null,
        sessionOrders: chat.sessionOrders || []
      });
    }

    const currentOrder = await resolveCurrentOrder({
      userId: req.user._id,
      providedContext: context,
      providedOrderId: orderId,
      chat
    });

    const lastAccountOrder = await fetchLastAccountOrder(req.user._id);

    if (currentOrder) {
      recordSessionOrder(chat, currentOrder);
      chat.currentOrder = currentOrder;
    }

    if (lastAccountOrder) {
      chat.lastAccountOrder = lastAccountOrder;
    }

    const response = await generateFaneBotReply({
      message: trimmedMessage,
      history: ensureArray(chat.history),
      currentOrder: chat.currentOrder || null,
      sessionOrders: ensureArray(chat.sessionOrders),
      lastAccountOrder: chat.lastAccountOrder || null,
      language: userLanguage,
      userName,
      mentionOrder
    });

    if (!response.success) {
      return res.status(500).json({ success: false, error: response.error || 'FANE este ocupat acum.' });
    }

    chat.history = trimHistory([
      ...ensureArray(chat.history),
      { role: 'user', content: trimmedMessage, createdAt: new Date() },
      { role: 'assistant', content: response.reply.trim(), createdAt: new Date() }
    ]);

    if (req.session) {
      req.session.faneBot = chat;
    }

    return res.json({
      success: true,
      reply: response.reply,
      history: chat.history,
      currentOrder: chat.currentOrder || null,
      sessionOrders: chat.sessionOrders || [],
      usage: response.usage || null
    });
  } catch (error) {
    console.error('[API] FANE bot error:', error);
    return res.status(500).json({ success: false, error: 'FANE este prins cu un telefon greu. Încearcă din nou.' });
  }
});

module.exports = router;
