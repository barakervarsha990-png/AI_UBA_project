const dns = require('dns');
const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Reads an env var and cleans it. Values edited in Notepad often carry stray
 * spaces or wrapping quotes, which silently break SMTP login.
 */
const readEnv = (key) => {
  const val = process.env[key];
  if (val === undefined || val === null) return undefined;
  const cleaned = String(val).trim().replace(/^["']|["']$/g, '');
  return cleaned === '' ? undefined : cleaned;
};

/** Escapes text before it goes into the HTML email (file names, usernames, reasons). */
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const threatLabel = (type) => (type === 'account_takeover' ? 'Account Takeover' : 'Insider Threat');

const SEVERITY_COLORS = {
  CRITICAL: '#b91c1c',
  HIGH: '#c2410c',
  MEDIUM: '#a16207',
  LOW: '#0f766e',
};

const recommendedAction = (alert) => {
  const steps =
    alert.type === 'account_takeover'
      ? 'Contact the user to confirm the login, reset their password, and revoke active sessions.'
      : 'Review the files accessed, confirm the activity with the user\'s manager, and restrict file access if it is not legitimate.';
  return alert.severity === 'CRITICAL'
    ? `Immediate investigation required. ${steps} Consider suspending the account until verified.`
    : `Investigate promptly. ${steps}`;
};

/**
 * Builds the transporter once. Defaults target Gmail (smtp.gmail.com:465),
 * and every value can be overridden from backend/.env.
 */
const getTransporter = async () => {
  if (transporter) return transporter;

  const user = readEnv('SMTP_USER');
  // Google shows App Passwords as "abcd efgh ijkl mnop". Spaces are not part of the password.
  const pass = (readEnv('SMTP_PASS') || '').replace(/\s+/g, '');

  if (!user || !pass) {
    console.warn('[EMAIL] SMTP_USER / SMTP_PASS missing in backend/.env. Emails will be logged, not sent.');
    return null;
  }

  const host = readEnv('SMTP_HOST') || 'smtp.gmail.com';
  const port = Number(readEnv('SMTP_PORT')) || 465;
  const secureSetting = readEnv('SMTP_SECURE');
  const secure = secureSetting !== undefined ? secureSetting === 'true' : port === 465;

  // Only for networks or antivirus that intercept TLS ("self-signed certificate in certificate chain").
  // Opt-in via .env so it is never enabled silently.
  const allowSelfSigned = readEnv('SMTP_ALLOW_SELF_SIGNED') === 'true';

  // Optional: force IPv4 or IPv6 (SMTP_IP_FAMILY=4 or 6). Some home networks can only reach
  // Gmail over one of them, which shows up as "Connection timeout" while other apps work.
  const family = Number(readEnv('SMTP_IP_FAMILY')) || 0;
  let connectHost = host;
  if (family === 4 || family === 6) {
    try {
      const { address } = await dns.promises.lookup(host, { family });
      connectHost = address;
    } catch (err) {
      console.warn(`[EMAIL] Could not resolve ${host} over IPv${family} (${err.code || err.message}). Using the normal hostname.`);
    }
  }

  console.log(`[EMAIL] SMTP configured: ${host}:${port} (secure=${secure}) as ${user}` +
    (connectHost !== host ? ` [connecting via ${connectHost}]` : '') +
    (allowSelfSigned ? ' [self-signed certificates allowed]' : ''));

  if (host.includes('gmail') && pass.length !== 16) {
    console.warn(
      `[EMAIL] SMTP_PASS is ${pass.length} characters. Gmail App Passwords are 16 characters. ` +
      'Your normal Gmail password will not work. Create one at https://myaccount.google.com/apppasswords'
    );
  }

  transporter = nodemailer.createTransport({
    host: connectHost,
    servername: host, // keeps the certificate check correct when connecting by IP address
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    ...(allowSelfSigned ? { tls: { rejectUnauthorized: false } } : {}),
  });

  return transporter;
};

const buildAlertHtml = (alert) => {
  const color = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.HIGH;
  const reasons = (alert.reasons || []).map((r) => `<li>${escapeHtml(r)}</li>`).join('');
  const timestamp = new Date(alert.createdAt || Date.now()).toLocaleString();

  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden;">
    <div style="background: ${color}; color: #ffffff; padding: 16px 20px;">
      <h2 style="margin: 0; font-size: 18px;">🚨 UBA Security Alert: ${escapeHtml(alert.severity)}</h2>
    </div>
    <div style="padding: 20px; color: #111827; font-size: 14px; line-height: 1.6;">
      <p style="margin: 0 0 6px;"><strong>Risk Level:</strong> ${escapeHtml(alert.severity)}</p>
      <p style="margin: 0 0 6px;"><strong>Risk Score:</strong> ${escapeHtml(alert.riskScore)}/100</p>
      <p style="margin: 0 0 6px;"><strong>Threat Type:</strong> ${escapeHtml(threatLabel(alert.type))}</p>
      <p style="margin: 0 0 6px;"><strong>User:</strong> ${escapeHtml(alert.userEmail || alert.username)}</p>
      <p style="margin: 0 0 6px;"><strong>IP Address:</strong> ${escapeHtml(alert.ipAddress || 'N/A')}</p>
      <p style="margin: 0 0 6px;"><strong>Location:</strong> ${escapeHtml(alert.location || 'N/A')}</p>
      <p style="margin: 0 0 6px;"><strong>Device:</strong> ${escapeHtml(alert.device || 'N/A')}</p>
      <p style="margin: 0 0 6px;"><strong>Timestamp:</strong> ${escapeHtml(timestamp)}</p>
      ${reasons ? `<p style="margin: 12px 0 4px;"><strong>Why it was flagged:</strong></p><ul style="margin: 0; padding-left: 20px;">${reasons}</ul>` : ''}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
      <p style="margin: 0;"><strong>Recommended action:</strong> ${escapeHtml(recommendedAction(alert))}</p>
      <p style="margin: 20px 0 0; font-size: 12px; color: #6b7280;">Automated alert from the AI-Driven User Behaviour Analytics platform. Review it in the SOC dashboard.</p>
    </div>
  </div>`;
};

const buildAlertText = (alert) => `UBA SECURITY ALERT

Risk Level: ${alert.severity}
Risk Score: ${alert.riskScore}/100
Threat Type: ${threatLabel(alert.type)}
User: ${alert.userEmail || alert.username}
IP Address: ${alert.ipAddress || 'N/A'}
Location: ${alert.location || 'N/A'}
Device: ${alert.device || 'N/A'}
Timestamp: ${new Date(alert.createdAt || Date.now()).toLocaleString()}

Recommended action: ${recommendedAction(alert)}
`;

/**
 * Sends the alert email. Never throws: the detection pipeline must keep running
 * even if email fails. Returns { sent, error? }.
 */
const sendAlertEmail = async (alert) => {
  const to = readEnv('ALERT_EMAIL_TO');
  const from = readEnv('ALERT_EMAIL_FROM') || readEnv('SMTP_USER');
  const subject = `[${alert.severity}] ${threatLabel(alert.type)} Alert - ${alert.username}`;

  if (!to) {
    const message = 'ALERT_EMAIL_TO is missing in backend/.env, so there is no recipient.';
    console.error('[EMAIL]', message);
    return { sent: false, error: message };
  }

  const t = await getTransporter();
  if (!t) {
    console.log('[EMAIL:SIMULATED]', { to, subject });
    return { sent: false, simulated: true, error: 'SMTP not configured' };
  }

  try {
    const info = await t.sendMail({
      from,
      to,
      subject,
      text: buildAlertText(alert),
      html: buildAlertHtml(alert),
    });
    console.log(`[EMAIL] Sent to ${to} (Message ID: ${info.messageId})`);
    return { sent: true, simulated: false, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL] Failed to send. Code: ${err.code || 'n/a'}. Message: ${err.message}`);

    if (err.code === 'EAUTH') {
      console.error('[EMAIL] Hint: login rejected. Use a 16-character Gmail App Password (2-Step Verification must be on).');
    } else if (/self-signed|certificate/i.test(err.message)) {
      console.error('[EMAIL] Hint: something on your network or antivirus is intercepting TLS. Set SMTP_ALLOW_SELF_SIGNED=true in backend/.env for a local demo, or try a phone hotspot.');
    } else if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS'].includes(err.code)) {
      console.error('[EMAIL] Hint: cannot reach the SMTP server. Try a phone hotspot, or set SMTP_IP_FAMILY=6 (or 4) in backend/.env to force the other IP version.');
    }

    return { sent: false, error: err.message };
  }
};

module.exports = { sendAlertEmail };