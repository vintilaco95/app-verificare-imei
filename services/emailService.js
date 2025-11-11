const nodemailer = require('nodemailer');
const { getTranslation } = require('../config/translations');
const { DEFAULT_LANGUAGE, normalizeLang } = require('./emailFormatter');

// Configure email transporter (only if credentials are provided)
let transporter = null;
const EMAIL_TIMEOUT = parseInt(process.env.EMAIL_TIMEOUT || '12000', 10);

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  const emailConfig = {
    host: process.env.EMAIL_HOST || 'zengsm.ro',
    port: parseInt(process.env.EMAIL_PORT || '465'),
    secure: parseInt(process.env.EMAIL_PORT || '465') === 465, // true for port 465, false for 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false // Allow self-signed certificates
    },
    connectionTimeout: EMAIL_TIMEOUT,
    greetingTimeout: EMAIL_TIMEOUT,
    socketTimeout: EMAIL_TIMEOUT,
    pool: true,
    maxConnections: 3,
    maxMessages: 10
  };
  
  transporter = nodemailer.createTransport(emailConfig);
  console.log(`✅ Email service configured:`);
  console.log(`   Host: ${emailConfig.host}`);
  console.log(`   Port: ${emailConfig.port}`);
  console.log(`   Secure: ${emailConfig.secure}`);
  console.log(`   User: ${emailConfig.auth.user}`);
} else {
  console.log('⚠️  Email service not configured - EMAIL_USER or EMAIL_PASS missing in environment');
}

async function sendMail(options) {
  if (!transporter) {
    console.log('Email service not configured. Skipping email send.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const sendPromise = transporter.sendMail(options);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email send timed out')), EMAIL_TIMEOUT);
    });

    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log('📧 Email sent successfully:');
    console.log('   Message ID:', info.messageId);
    console.log('   To:', options.to);
    console.log('   Subject:', options.subject);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending error:', error);
    console.error('   Error code:', error.code);
    console.error('   Error response:', error.response);
    console.error('   Error command:', error.command);
    return { success: false, error: error.message };
  }
}

function getFromAddress() {
  return process.env.EMAIL_FROM && process.env.EMAIL_FROM.includes('@')
    ? process.env.EMAIL_FROM
    : process.env.EMAIL_USER;
}

/**
 * Send IMEI verification result via email using the dedicated HTML email template.
 */
async function sendVerificationResult(email, order, resultData, renderedHTML, options = {}) {
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
    const subject = subjectTemplate.replace('{imei}', imeiValue);
    const textBody = textTemplate.replace('{imei}', imeiValue);

    return await sendMail({
      from: `"IMEI Verification" <${getFromAddress()}>`,
      to: email,
      subject,
      html: emailContent,
      text: textBody
    });
  } catch (error) {
    console.error('[EmailService] Failed to send verification result email:', error);
    return { success: false, error: error.message };
  }
}

async function sendVerificationEmail(email, token, options = {}) {
  const lang = normalizeLang(options && options.lang ? options.lang : DEFAULT_LANGUAGE);
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const verificationUrl = `${baseUrl.replace(/\/$/, '')}/auth/verify/${token}`;

  const subjectTemplate = getTranslation(lang, 'email.subject.verify');
  const textTemplate = getTranslation(lang, 'email.text.verify');
  const htmlTemplate = getTranslation(lang, 'email.html.verify');

  const subject = subjectTemplate.replace('{brand}', getTranslation(lang, 'nav.brand'));
  const textBody = textTemplate.replace('{url}', verificationUrl);
  const htmlBody = htmlTemplate
    .replace('{url}', verificationUrl)
    .replace('{brand}', getTranslation(lang, 'nav.brand'));

  return await sendMail({
    from: `"IMEI Verification" <${getFromAddress()}>`,
    to: email,
    subject,
    html: htmlBody,
    text: textBody
  });
}

module.exports = {
  sendVerificationResult,
  sendVerificationEmail
};
