const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[EMAIL] SMTP credentials not fully configured. Emails will be logged, not sent.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

const buildAlertHtml = (alert) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border:1px solid #333; border-radius:8px; overflow:hidden;">
    <div style="background:#0b1220; color:#fff; padding:16px 20px;">
      <h2 style="margin:0; font-size:18px;">🚨 SOC Alert: ${alert.severity} Severity</h2>
    </div>
    <div style="padding:20px; color:#111;">
      <p><strong>Alert Type:</strong> ${alert.type === 'account_takeover' ? 'Possible Account Takeover' : 'Possible Insider Threat'}</p>
      <p><strong>User:</strong> ${alert.username}</p>
      <p><strong>Risk Score:</strong> ${alert.riskScore}/100</p>
      <p><strong>Time:</strong> ${alert.time || ''}</p>
      <p><strong>IP Address:</strong> ${alert.ipAddress || 'N/A'}</p>
      <p><strong>Location:</strong> ${alert.location || 'N/A'}</p>
      <p><strong>Device:</strong> ${alert.device || 'N/A'}</p>
      <p><strong>Reasons:</strong></p>
      <ul>${(alert.reasons || []).map((r) => `<li>${r}</li>`).join('')}</ul>
      <p style="margin-top:20px; font-size:12px; color:#666;">This is an automated alert from the AI-Driven User Behaviour Analytics platform. Please review in the SOC dashboard.</p>
    </div>
  </div>
`;

const sendAlertEmail = async (alert) => {
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER;
  const subject = `[${alert.severity}] ${alert.type === 'account_takeover' ? 'Account Takeover' : 'Insider Threat'} Alert - ${alert.username}`;

  const t = getTransporter();
  if (!t) {
    console.log('[EMAIL:SIMULATED]', { to, subject });
    return { sent: false, simulated: true };
  }

  try {
    await t.sendMail({ from, to, subject, html: buildAlertHtml(alert) });
    return { sent: true, simulated: false };
  } catch (err) {
    console.error('[EMAIL] Failed to send alert email:', err.message);
    return { sent: false, error: err.message };
  }
};

module.exports = { sendAlertEmail };
