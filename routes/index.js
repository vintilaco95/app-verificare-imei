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
  res.render('legal/terms', {
    title: 'Termeni și Condiții',
    user: req.user || null
  });
});

router.get('/legal/privacy', (req, res) => {
  res.render('legal/privacy', {
    title: 'Politica de Confidențialitate',
    user: req.user || null
  });
});

router.get('/legal/gdpr', (req, res) => {
  res.render('legal/gdpr', {
    title: 'Politica GDPR',
    user: req.user || null
  });
});

router.get('/legal/cookies', (req, res) => {
  res.render('legal/cookies', {
    title: 'Politica de Cookies',
    user: req.user || null
  });
});

router.get('/faq', (req, res) => {
  const faqs = [
    {
      question: 'Cum funcționează verificarea IMEI?',
      answer: 'Introduci codul IMEI, selectezi brandul dispozitivului și plătești verificarea. Sistemul nostru accesează surse oficiale și furnizează un raport complet despre statusul telefonului.'
    },
    {
      question: 'Ce metode de plată acceptați?',
      answer: 'Pentru utilizatorii neautentificați oferim plata unică prin card cu Stripe. Utilizatorii autentificați pot încărca credite și achita direct din cont.'
    },
    {
      question: 'Cât durează procesarea verificării?',
      answer: 'Majoritatea verificărilor sunt finalizate în câteva minute. În caz de aglomerare sau interogări suplimentare, poate dura mai mult, iar vei fi notificat prin email.'
    },
    {
      question: 'Datele mele sunt în siguranță?',
      answer: 'Respectăm normele GDPR, folosim conexiuni securizate și nu stocăm datele cardului tău. Poți afla mai multe în politica de confidențialitate și în politica GDPR.'
    }
  ];

  res.render('legal/faq', {
    title: 'Întrebări Frecvente',
    user: req.user || null,
    faqs
  });
});

module.exports = router;
