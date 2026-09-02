const nodemailer = require('nodemailer');

let transporter = null;

const readEnv = (key) => {
  const val = process.env[key];
  if (val === undefined || val === null) return undefined;
  return val.trim().replace(/^["']|["']$/g, '');
};

const getTransporter = () => {
  if (transporter) return transporter;

  const user = readEnv('SMTP_USER');
  const pass = readEnv('SMTP_PASS');

  console.log('[EMAIL] SMTP configuration check:');
  console.log('[EMAIL] USER:', user || '(missing)');
  console.log('[EMAIL] PASS:', pass ? 'LOADED' : '(missing)');
  console.log('[EMAIL] TO:', readEnv('ALERT_EMAIL_TO') || '(missing)');

  if (!user || !pass) {
    console.warn('[EMAIL] SMTP credentials missing.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,

    auth: {
      user: user,
      pass: pass,
    },

    tls: {
      rejectUnauthorized: false,
      servername: 'smtp.gmail.com',
    },
  });

  return transporter;
};

const buildEmailText = (alert) => `
🚨 UBA SECURITY ALERT

Severity: ${alert.severity}
Type: ${alert.type}
User: ${alert.username}
Risk Score: ${alert.riskScore}/100
Time: ${alert.time || 'N/A'}
IP Address: ${alert.ipAddress || 'N/A'}
Location: ${alert.location || 'N/A'}
Device: ${alert.device || 'N/A'}

Please check the UBA dashboard immediately.
`;

const sendAlertEmail = async (alert) => {
  const to = readEnv('ALERT_EMAIL_TO');
  const from = readEnv('ALERT_EMAIL_FROM') || readEnv('SMTP_USER');

  if (!to) {
    const msg = 'ALERT_EMAIL_TO is missing from .env — no recipient to send to.';
    console.error('[EMAIL]', msg);
    return { sent: false, error: msg };
  }

  const subject = `[${alert.severity}] ${alert.type === 'account_takeover' ? 'Account Takeover' : 'Insider Threat'} Alert`;

  const t = getTransporter();
  if (!t) {
    return { sent: false, error: 'SMTP not configured (SMTP_USER / SMTP_PASS missing).' };
  }

  try {
    await t.verify();
    console.log('[EMAIL] SMTP connection verified successfully.');

    const info = await t.sendMail({ from, to, subject, text: buildEmailText(alert) });

    console.log('[EMAIL] Email sent successfully!');
    console.log('[EMAIL] Message ID:', info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL] Failed to send email.');
    console.error('[EMAIL] Error code:', error.code);
    console.error('[EMAIL] Error message:', error.message);

    if (error.code === 'EAUTH') {
      console.error(
        '[EMAIL] HINT: This is an authentication failure. Almost always means SMTP_PASS ' +
        'is your regular Gmail password instead of an App Password, or 2-Step Verification ' +
        'is not enabled on the account. Fix: https://myaccount.google.com/apppasswords'
      );
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION') {
      console.error(
        '[EMAIL] HINT: Could not reach smtp.gmail.com. Your network (college wifi, ' +
        'firewall, antivirus) may be blocking outbound port 465/587.'
      );
    }

    return { sent: false, error: error.message };
  }
};

module.exports = { sendAlertEmail };