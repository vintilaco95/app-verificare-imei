const { getTranslation } = require('../config/translations');
const { DEFAULT_LANGUAGE, normalizeLang } = require('./emailFormatter');

const EMAIL_TIMEOUT = parseInt(process.env.EMAIL_TIMEOUT || '12000', 10);
const EMAILJS_ENDPOINT = process.env.EMAILJS_API_URL || 'https://api.emailjs.com/api/v1.0/email/send';
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || null;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || null;
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || null;
const EMAILJS_TEMPLATE_VERIFY = process.env.EMAILJS_TEMPLATE_VERIFY || process.env.EMAILJS_TEMPLATE_ID_VERIFY || null;
const EMAILJS_TEMPLATE_RESULT = process.env.EMAILJS_TEMPLATE_RESULT || process.env.EMAILJS_TEMPLATE_ID_RESULT || null;

function getFromAddress() {
  return process.env.EMAIL_FROM || process.env.EMAILJS_FROM_EMAIL || null;
}

function isConfigured(templateId) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY || !templateId) {
    console.warn('[EmailService] EmailJS not fully configured. Missing SERVICE_ID / PUBLIC_KEY / TEMPLATE_ID.');
    return false;
  }
  return true;
}

async function sendEmailJS(templateId, templateParams = {}) {
  if (!isConfigured(templateId)) {
    return { success: false, error: 'EmailJS not configured' };
  }

  const payload = {
    service_id: EMAILJS_SERVICE_ID,
    template_id: templateId,
    user_id: EMAILJS_PUBLIC_KEY,
    accessToken: EMAILJS_PRIVATE_KEY || undefined,
    template_params: {
      reply_to: getFromAddress() || templateParams.reply_to || templateParams.to_email,
      ...templateParams
    }
  };

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), EMAIL_TIMEOUT);

  try {
    const response = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutHandle);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`EmailJS responded with ${response.status} ${response.statusText}: ${errorText}`);
    }

    console.log('📧 EmailJS email sent successfully:', {
      templateId,
      to: templateParams.to_email
    });
    return { success: true };
  } catch (error) {
    const errorMessage = error.name === 'AbortError' ? 'EmailJS request timed out' : error.message;
    console.error('❌ EmailJS sending error:', errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function sendVerificationResult(email, order, resultData, renderedHTML, options = {}) {
  if (!EMAILJS_TEMPLATE_RESULT) {
    console.warn('[EmailService] EMAILJS_TEMPLATE_RESULT not configured. Skipping result email.');
    return { success: false, error: 'EmailJS template for results not configured' };
  }

  const requestedLang = options && options.lang ? options.lang : (order && order.language ? order.language : DEFAULT_LANGUAGE);
  const lang = normalizeLang(requestedLang);

  try {
    let emailContent = null;

    if (renderedHTML && typeof renderedHTML === 'object') {
      emailContent = renderedHTML.emailHTML || null;
    }

    if (!emailContent) {
      const { generateResultHTML } = require('./generateResultHTML');
      const generated = await generateResultHTML(order, { lang });
      emailContent = generated.emailHTML;
    }

    if (!emailContent) {
      throw new Error('Email content could not be generated');
    }

    const subjectTemplate = getTranslation(lang, 'email.subject.result');
    const textTemplate = getTranslation(lang, 'email.text.result');
    const imeiValue = order && order.imei ? order.imei : '';
    const brandName = getTranslation(lang, 'nav.brand');

    const subject = subjectTemplate.replace('{imei}', imeiValue);
    const textBody = textTemplate.replace('{imei}', imeiValue);

    return await sendEmailJS(EMAILJS_TEMPLATE_RESULT, {
      to_email: email,
      subject,
      message_text: textBody,
      message_html: emailContent,
      imei: imeiValue,
      brand: brandName,
      order_id: order && order.orderId ? order.orderId : undefined,
      status: order && order.status ? order.status : undefined
    });
  } catch (error) {
    console.error('[EmailService] Failed to send verification result email:', error);
    return { success: false, error: error.message };
  }
}

async function sendVerificationEmail(email, code, options = {}) {
  if (!EMAILJS_TEMPLATE_VERIFY) {
    console.warn('[EmailService] EMAILJS_TEMPLATE_VERIFY not configured. Skipping verification email.');
    return { success: false, error: 'EmailJS template for verification not configured' };
  }

  const lang = normalizeLang(options && options.lang ? options.lang : DEFAULT_LANGUAGE);
  const ttlMinutes = typeof options.ttlMinutes === 'number' && Number.isFinite(options.ttlMinutes)
    ? Math.max(1, Math.round(options.ttlMinutes))
    : null;

  const brandName = getTranslation(lang, 'nav.brand');
  const subjectTemplate = getTranslation(lang, 'email.subject.verifyCode');
  const textTemplate = getTranslation(lang, 'email.text.verifyCode');
  const htmlTemplate = getTranslation(lang, 'email.html.verifyCode');

  const subject = subjectTemplate
    .replace('{brand}', brandName)
    .replace('{code}', code);

  let textBody = textTemplate
    .replace('{brand}', brandName)
    .replace('{code}', code);

  let htmlBody = htmlTemplate
    .replace(/{brand}/g, brandName)
    .replace(/{code}/g, code);

  if (ttlMinutes !== null) {
    textBody = textBody.replace(/{minutes}/g, ttlMinutes);
    htmlBody = htmlBody.replace(/{minutes}/g, ttlMinutes);
  } else {
    textBody = textBody.replace(/{minutes}/g, '');
    htmlBody = htmlBody.replace(/{minutes}/g, '');
  }

  return await sendEmailJS(EMAILJS_TEMPLATE_VERIFY, {
    to_email: email,
    subject,
    message_text: textBody,
    message_html: htmlBody,
    code,
    brand: brandName,
    minutes: ttlMinutes,
    from_email: getFromAddress() || undefined
  });
}

module.exports = {
  sendVerificationResult,
  sendVerificationEmail
};
