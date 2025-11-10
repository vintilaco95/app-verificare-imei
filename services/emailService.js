const nodemailer = require('nodemailer');
const { getTranslation } = require('../config/translations');
const { DEFAULT_LANGUAGE, normalizeLang } = require('./emailFormatter');

// Configure email transporter (only if credentials are provided)
let transporter = null;
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
    }
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

/**
 * Send IMEI verification result via email using the dedicated HTML email template.
 */
async function sendVerificationResult(email, order, resultData, renderedHTML, options = {}) {
  if (!transporter) {
    console.log('Email service not configured. Skipping email send.');
    return { success: false, error: 'Email service not configured' };
  }
  
  try {
    const requestedLang = options && options.lang ? options.lang : (order && order.language ? order.language : DEFAULT_LANGUAGE);
    const lang = normalizeLang(requestedLang);
    // Determine rendered HTML fragments
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
    
    const fromAddress = process.env.EMAIL_FROM && process.env.EMAIL_FROM.includes('@') 
      ? process.env.EMAIL_FROM 
      : process.env.EMAIL_USER;

    const subjectTemplate = getTranslation(lang, 'email.subject.result');
    const textTemplate = getTranslation(lang, 'email.text.result');
    const imeiValue = order && order.imei ? order.imei : '';
    const subject = subjectTemplate.replace('{imei}', imeiValue);
    const textBody = textTemplate.replace('{imei}', imeiValue);
    
    const mailOptions = {
      from: `"IMEI Verification" <${fromAddress}>`,
      to: email,
      subject,
      html: emailContent,
      text: textBody
    };
    
    console.log('📤 Attempting to send email:');
    console.log('   From:', mailOptions.from);
    console.log('   To:', mailOptions.to);
    
    // Verify connection before sending
    await transporter.verify();
    console.log('✅ SMTP server connection verified');
    
    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Email sent successfully:');
    console.log('   Message ID:', info.messageId);
    console.log('   To:', email);
    console.log('   From:', mailOptions.from);
    console.log('   Subject:', mailOptions.subject);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending error:', error);
    console.error('   Error code:', error.code);
    console.error('   Error response:', error.response);
    console.error('   Error command:', error.command);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendVerificationResult
};
