const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const imeiService = require('../services/imeiService');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const Order = require('../models/Order');
const { generateFaneBotReply, ensureArray, toTitleCase } = require('../services/faneBotService');
const FaneConversation = require('../models/FaneConversation');
const { lookupAveragePrice } = require('../services/priceLookupService');

const MAX_SESSION_HISTORY = parseInt(process.env.FANE_BOT_SESSION_LIMIT || '12', 10);
const FANE_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PRICE_INTENT_REGEX = /(pre[tț]|cat|how)(.*)(cost|valoare|value|price|pret|preț|mediu|average)/i;

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

function createEmptyChat() {
  return {
    history: [],
    latestVerification: null,
    expiresAt: Date.now() + FANE_SESSION_TTL_MS
  };
}

async function loadFaneSession(req) {
  if (!req.session) {
    return createEmptyChat();
  }

  if (req.session.faneBot && req.session.faneBot.expiresAt && req.session.faneBot.expiresAt > Date.now()) {
    return req.session.faneBot;
  }

  try {
    const existing = await FaneConversation.findOne({ userId: req.user._id }).lean();
    if (existing && existing.expiresAt && existing.expiresAt.getTime() > Date.now()) {
      const chat = {
        history: ensureArray(existing.history),
        latestVerification: existing.latestVerification
          || existing.currentOrder
          || null,
        expiresAt: existing.expiresAt.getTime()
      };
      req.session.faneBot = chat;
      return chat;
    }
  } catch (error) {
    console.error('[API] Failed to load FANE conversation:', error);
  }

  const chat = createEmptyChat();
  req.session.faneBot = chat;
  return chat;
}

async function persistFaneSession(req, chat) {
  if (!req.session) {
    return;
  }

  const expiresAt = new Date(Date.now() + FANE_SESSION_TTL_MS);
  const payload = {
    history: ensureArray(chat.history),
    latestVerification: chat.latestVerification || null,
    expiresAt
  };

  req.session.faneBot = {
    ...payload,
    expiresAt: expiresAt.getTime()
  };

  try {
    await FaneConversation.findOneAndUpdate(
      { userId: req.user._id },
      {
        ...payload,
        userId: req.user._id,
        updatedAt: new Date()
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.error('[API] Failed to persist FANE conversation:', error);
  }
}

function trimHistory(history) {
  const items = ensureArray(history);
  if (items.length <= MAX_SESSION_HISTORY) {
    return items;
  }
  return items.slice(items.length - MAX_SESSION_HISTORY);
}

function buildVerificationSnapshot(order) {
  if (!order) {
    return null;
  }

  const createdAt = order.createdAt ? new Date(order.createdAt).toISOString() : null;
  const updatedAt = order.updatedAt ? new Date(order.updatedAt).toISOString() : null;

  return {
    orderId: order._id ? order._id.toString() : (order.orderId ? String(order.orderId) : null),
    imei: order.imei || null,
    imei2: order.imei2 || null,
    brand: order.brand || (order.object && order.object.brand) || null,
    model: order.model || (order.object && order.object.model) || null,
    modelDesc: order.modelDesc || (order.object && order.object.modelDesc) || null,
    status: order.status || null,
    servicePrice: order.price !== undefined ? Number(order.price) : null,
    serviceCurrency: order.currency || null,
    currency: order.currency || null,
    language: order.language || null,
    riskScore: typeof order.riskScore === 'number'
      ? order.riskScore
      : (order.object && typeof order.object.riskScore === 'number' ? order.object.riskScore : null),
    riskLabel: order.riskLabel || (order.object && order.object.riskLabel) || null,
    summaryLabel: order.summaryLabel || (order.object && order.object.summaryLabel) || null,
    statuses: order.statuses || (order.object && order.object.statuses) || null,
    blacklist: order.blacklist || (order.object && order.object.blacklist) || null,
    mdm: order.mdm || (order.object && order.object.mdm) || null,
    iCloud: order.iCloud || (order.object && order.object.iCloud) || null,
    networkLock: order.networkLock || (order.object && order.object.networkLock) || null,
    verificationRaw: order.object || null,
    resultHtml: order.result || null,
    meta: {
      serviceId: order.serviceId || null,
      serviceName: order.serviceName || null
    },
    createdAt,
    updatedAt
  };
}

async function fetchLatestVerification(userId) {
  if (!userId) {
    return null;
  }

  const latestOrder = await Order.findOne({ userId }).sort({ createdAt: -1 }).lean();
  return buildVerificationSnapshot(latestOrder);
}

async function ensureLatestVerification(req, chat) {
  const latest = await fetchLatestVerification(req.user ? req.user._id : null);
  if (!latest) {
    chat.latestVerification = null;
    return null;
  }

  const hasChanged = !chat.latestVerification
    || chat.latestVerification.orderId !== latest.orderId
    || chat.latestVerification.createdAt !== latest.createdAt
    || chat.latestVerification.updatedAt !== latest.updatedAt
    || chat.latestVerification.status !== latest.status;

  if (hasChanged) {
    chat.latestVerification = latest;
  }

  return chat.latestVerification;
}

function hasPriceIntent(message) {
  if (!message) return false;
  return PRICE_INTENT_REGEX.test(message.toLowerCase());
}

function buildFallbackQuery(latestVerification, message) {
  if (latestVerification && (latestVerification.brand || latestVerification.model || latestVerification.modelDesc)) {
    return [latestVerification.brand, latestVerification.modelDesc || latestVerification.model]
      .filter(Boolean)
      .join(' ');
  }
  return message;
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

function shouldReferenceVerification(message, latestVerification) {
  if (!message) return false;
  const matchKeywords = /(imei|verific|raport|rezultat|blocaj|blacklist|icloud|mdm|network|sim|warranty|scor|risk|negoc|detalii|telefonul (meu|ala)|device-ul (meu|ăla)|momentan|ultim(ul)?)/i;
  if (!matchKeywords.test(message)) {
    return false;
  }

  if (!latestVerification) {
    return false;
  }

  return true;
}

function buildGreetingReply(userName, language) {
  const friendlyName = userName || (language === 'en' ? 'boss' : 'șefu');

  if (language === 'en') {
    return `Hey ${friendlyName}! Ce te interesează azi la telefoane? Sunt aici să te ajut.`;
  }

  return `Salut, ${friendlyName}! Spune-mi cu ce telefon te pot ajuta și vedem ce soluție găsim.`;
}


router.post('/fane-bot/reset', requireAuth, async (req, res) => {
  if (req.session) {
    req.session.faneBot = createEmptyChat();
  }

  try {
    await FaneConversation.deleteOne({ userId: req.user._id });
  } catch (error) {
    console.error('[API] Failed to reset FANE conversation:', error);
  }

  return res.json({ success: true });
});

router.get('/fane-bot/history', requireAuth, async (req, res) => {
  try {
    const chat = await loadFaneSession(req);
    await ensureLatestVerification(req, chat);
    await persistFaneSession(req, chat);
    return res.json({
      success: true,
      history: ensureArray(chat.history),
      latestVerification: chat.latestVerification || null
    });
  } catch (error) {
    console.error('[API] FANE history error:', error);
    return res.status(500).json({ success: false, error: 'Nu am putut încărca conversația.' });
  }
});

router.post('/fane-bot', requireAuth, async (req, res) => {
  try {
    const { message, language } = req.body || {};
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';

    if (!trimmedMessage) {
      return res.status(400).json({ success: false, error: 'Mesajul este obligatoriu.' });
    }

    const chat = await loadFaneSession(req);
    const userLanguage = language || (req.session && req.session.lang) || 'ro';
    const userName = getUserDisplayName(req.user);

    const latestVerification = await ensureLatestVerification(req, chat);
    const mentionVerification = shouldReferenceVerification(trimmedMessage, latestVerification);
    const wantsPrice = hasPriceIntent(trimmedMessage);
    let priceInsight = null;

    // Handle simple greetings without hitting the model
    if (!mentionVerification && isGreetingMessage(trimmedMessage)) {
      const reply = buildGreetingReply(userName, userLanguage);
      chat.history = trimHistory([
        ...ensureArray(chat.history),
        { role: 'user', content: trimmedMessage, createdAt: new Date() },
        { role: 'assistant', content: reply, createdAt: new Date() }
      ]);

      await persistFaneSession(req, chat);

      return res.json({
        success: true,
        reply,
        history: chat.history,
        latestVerification: chat.latestVerification || null
      });
    }

    if (wantsPrice) {
      const fallbackQuery = buildFallbackQuery(latestVerification, trimmedMessage);
      const priceResult = await lookupAveragePrice({
        brand: latestVerification ? latestVerification.brand : null,
        model: latestVerification ? (latestVerification.modelDesc || latestVerification.model) : null,
        language: userLanguage,
        fallbackQuery
      });

      if (priceResult.success && priceResult.summary) {
        priceInsight = priceResult.summary;
      }
    }

    const response = await generateFaneBotReply({
      message: trimmedMessage,
      history: ensureArray(chat.history),
      language: userLanguage,
      userName,
      verification: chat.latestVerification || null,
      mentionVerification,
      priceInsight
    });

    if (!response.success) {
      return res.status(500).json({ success: false, error: response.error || 'FANE este ocupat acum.' });
    }

    chat.history = trimHistory([
      ...ensureArray(chat.history),
      { role: 'user', content: trimmedMessage, createdAt: new Date() },
      { role: 'assistant', content: response.reply.trim(), createdAt: new Date() }
    ]);

    await persistFaneSession(req, chat);

    return res.json({
      success: true,
      reply: response.reply,
      history: chat.history,
      latestVerification: chat.latestVerification || null,
      usage: response.usage || null
    });
  } catch (error) {
    console.error('[API] FANE bot error:', error);
    return res.status(500).json({ success: false, error: 'FANE este prins cu un telefon greu. Încearcă din nou.' });
  }
});

module.exports = router;
