const express = require('express');
const router = express.Router();
const pricingService = require('../services/pricingService');

router.get('/', async (req, res) => {
  let pricing = {};
  try {
    const pricingConfig = await pricingService.getPricingConfig();
    pricing = pricingConfig.baseCredits || {};
  } catch (error) {
    console.error('[Index] Failed to load pricing config:', error);
  }
  
  res.render('index', { 
    title: 'Verificare IMEI - Aplicație Web',
    user: req.user || null,
    pricing: pricing
  });
});

router.get('/legal/terms', (req, res) => {
  const t = typeof res.locals.t === 'function' ? res.locals.t : (key) => key;
  res.render('legal/terms', {
    title: t('legal.terms.pageTitle'),
    user: req.user || null
  });
});

router.get('/legal/privacy', (req, res) => {
  const t = typeof res.locals.t === 'function' ? res.locals.t : (key) => key;
  res.render('legal/privacy', {
    title: t('legal.privacy.pageTitle'),
    user: req.user || null
  });
});

router.get('/legal/gdpr', (req, res) => {
  const t = typeof res.locals.t === 'function' ? res.locals.t : (key) => key;
  res.render('legal/gdpr', {
    title: t('legal.gdpr.pageTitle'),
    user: req.user || null
  });
});

router.get('/legal/cookies', (req, res) => {
  const t = typeof res.locals.t === 'function' ? res.locals.t : (key) => key;
  res.render('legal/cookies', {
    title: t('legal.cookies.pageTitle'),
    user: req.user || null
  });
});

router.get('/faq', (req, res) => {
  const t = typeof res.locals.t === 'function' ? res.locals.t : (key) => key;
  const faqs = [
    { questionKey: 'legal.faq.items.1.question', answerKey: 'legal.faq.items.1.answer' },
    { questionKey: 'legal.faq.items.2.question', answerKey: 'legal.faq.items.2.answer' },
    { questionKey: 'legal.faq.items.3.question', answerKey: 'legal.faq.items.3.answer' },
    { questionKey: 'legal.faq.items.4.question', answerKey: 'legal.faq.items.4.answer' }
  ];

  res.render('legal/faq', {
    title: t('legal.faq.pageTitle'),
    user: req.user || null,
    faqs
  });
});

module.exports = router;
