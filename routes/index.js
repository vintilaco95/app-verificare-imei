const express = require('express');
const router = express.Router();
const { getBasePrice } = require('../config/pricing');

router.get('/', (req, res) => {
  // Get pricing for display
  const pricing = {
    apple: getBasePrice('apple'),
    samsung: getBasePrice('samsung'),
    honor: getBasePrice('honor'),
    huawei: getBasePrice('huawei'),
    xiaomi: getBasePrice('xiaomi'),
    oneplus: getBasePrice('oneplus'),
    motorola: getBasePrice('motorola'),
    default: getBasePrice('default')
  };
  
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
