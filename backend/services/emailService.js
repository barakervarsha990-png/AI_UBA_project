const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
const nodemailer = require('nodemailer');

let cachedTransporter = null;
let cachedConfigKey = null;
let cachedEtherealAccount = null;

/**
 * Reads an environment variable and cleans surrounding whitespace/quotes.
 */
const readEnv = (key) => {
  const val = process.env[key];
  if (val === undefined || val === null) return undefined;
  const cleaned = String(val).trim().replace(/^["']|["']$/g, '');
  return cleaned === '' ? undefined : cleaned;
};

/**
 * Escapes HTML characters to prevent XSS in email clients.
 */
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const threatLabel = (type) => {
  switch (type) {
    case 'outside_working_hours':
      return 'Login Outside Permitted Time';
    case 'unauthorized_location':
      return 'Login From Unauthorized Location';
    case 'bulk_file_download':
      return 'Bulk File Download / Mass Exfiltration';
    case 'account_takeover':
      return 'Account Takeover Breach';
    case 'brute_force':
      return 'Brute-Force Credential Attack';
    case 'impossible_travel':
      return 'Impossible Travel / Location Anomaly';
    case 'insider_threat':
      return 'Suspicious Insider Threat Activity';
    default:
      return 'Security Incident';
  }
};

const SEVERITY_CONFIG = {
  CRITICAL: { color: '#dc2626', bg: '#fee2e2', border: '#b91c1c', badge: '#991b1b' },
  HIGH: { color: '#ea580c', bg: '#ffedd5', border: '#c2410c', badge: '#c2410c' },
  MEDIUM: { color: '#ca8a04', bg: '#fef9c3', border: '#a16207', badge: '#854d0e' },
  LOW: { color: '#0d9488', bg: '#ccfbf1', border: '#0f766e', badge: '#115e59' },
};

const defaultRecommendedAction = (alert) => {
  if (alert.recommendedAction) return alert.recommendedAction;

  if (alert.type === 'outside_working_hours') {
    return '1. Contact employee to verify if login attempt was authorized by team lead.\n' +
           '2. Review whether employee requires off-hours shift allowance.\n' +
           '3. Monitor subsequent session activity and file access closely.';
  }
  if (alert.type === 'unauthorized_location') {
    return '1. Immediately verify whether employee is traveling with VPN authorization.\n' +
           '2. If unauthorized, terminate session and temporarily lock credentials.\n' +
           '3. Require secondary biometric or out-of-band verification before unlocking.';
  }
  if (alert.type === 'bulk_file_download' || alert.type === 'insider_threat') {
    return '1. Inspect the specific classified documents downloaded or exported.\n' +
           '2. Verify business need with the employee and department manager.\n' +
           '3. If data exfiltration suspected, restrict access and notify legal/HR.';
  }
  if (alert.type === 'account_takeover') {
    return '1. Immediately terminate all active sessions for this user.\n' +
           '2. Require out-of-band identity verification.\n' +
           '3. Force password reset and review recent audit logs.';
  }
  if (alert.type === 'brute_force') {
    return '1. Verify whether source IP belongs to an authorized proxy or known scanner.\n' +
           '2. Enforce progressive delay and temporary lock on the targeted username.\n' +
           '3. Inspect if credentials succeeded on any alternative endpoints.';
  }
  return 'Review the security telemetry, inspect recent user behavior, and contact the account owner.';
};

/**
 * Builds or retrieves the configured Nodemailer transporter.
 */
const getTransporter = async ({ forceRefresh = false } = {}) => {
  const service = (readEnv('SMTP_SERVICE') || '').toLowerCase();
  const user = readEnv('SMTP_USER');
  const pass = (readEnv('SMTP_PASS') || '').replace(/\s+/g, '');
  const host = readEnv('SMTP_HOST') || 'smtp.gmail.com';
  const port = Number(readEnv('SMTP_PORT')) || (host.includes('gmail') ? 587 : 465);
  const secureSetting = readEnv('SMTP_SECURE');
  const secure = secureSetting !== undefined ? secureSetting === 'true' : port === 465;
  const allowSelfSigned = readEnv('SMTP_ALLOW_SELF_SIGNED') !== 'false';
  const family = Number(readEnv('SMTP_IP_FAMILY')) || 4;

  const currentConfigKey = `${service}|${host}|${port}|${secure}|${user}|${pass}|${allowSelfSigned}|${family}`;

  if (!forceRefresh && cachedTransporter && cachedConfigKey === currentConfigKey) {
    return cachedTransporter;
  }

  // Option A: Explicit Ethereal test inbox ONLY if SMTP_SERVICE=ethereal
  if (service === 'ethereal') {
    try {
      if (!cachedEtherealAccount) {
        console.log('[EMAIL] Generating Nodemailer Ethereal test account...');
        cachedEtherealAccount = await nodemailer.createTestAccount();
        console.log(`[EMAIL] Ethereal test account ready: ${cachedEtherealAccount.user}`);
      }
      cachedTransporter = nodemailer.createTransport({
        host: cachedEtherealAccount.smtp.host,
        port: cachedEtherealAccount.smtp.port,
        secure: cachedEtherealAccount.smtp.secure,
        family: 4,
        auth: {
          user: cachedEtherealAccount.user,
          pass: cachedEtherealAccount.pass,
        },
        tls: { rejectUnauthorized: false },
      });
      cachedTransporter.__isEthereal = true;
      cachedConfigKey = currentConfigKey;
      return cachedTransporter;
    } catch (err) {
      console.error('[EMAIL] Failed to create Ethereal test account:', err.message);
    }
  }

  // Option B: Standard SMTP (Gmail, Outlook, Custom)
  if (!user || !pass) {
    console.warn('[EMAIL] SMTP_USER or SMTP_PASS missing in backend/.env. Emails will be logged / simulated.');
    cachedTransporter = null;
    cachedConfigKey = null;
    return null;
  }

  // Build standard SMTP transport (e.g. smtp.gmail.com on port 587 or 465) with IPv4 enforcement
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    family,
    auth: { user, pass },
    connectionTimeout: 25000,
    greetingTimeout: 25000,
    socketTimeout: 35000,
    tls: { rejectUnauthorized: !allowSelfSigned },
  });

  cachedTransporter.__isEthereal = false;
  cachedTransporter.__config = { host, port, secure, user, pass, allowSelfSigned, family };
  cachedConfigKey = currentConfigKey;
  return cachedTransporter;
};

/**
 * Builds HTML alert email matching Sentinel SOC specifications.
 */
const buildAlertHtml = (alert) => {
  const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.HIGH;
  const reasonsHtml = (alert.reasons || [])
    .map((r) => `<li style="margin-bottom: 6px; color: #374151;">${escapeHtml(r)}</li>`)
    .join('');
  const timestamp = new Date(alert.createdAt || Date.now()).toUTCString();
  const localTime = new Date(alert.createdAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const clientUrl = readEnv('CLIENT_URL') || 'http://localhost:3000';
  const label = threatLabel(alert.type);
  const employeeDisplay = alert.employeeName
    ? `${escapeHtml(alert.employeeName)} (${escapeHtml(alert.username)})`
    : escapeHtml(alert.username);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sentinel Security Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px;">
  <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
    
    <!-- Header -->
    <div style="background-color: #0b1329; border-bottom: 4px solid ${sev.color}; padding: 24px; color: #ffffff;">
      <div>
        <span style="font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #38bdf8; font-weight: 700;">SENTINEL UBA &bull; COMPANY SECURITY OPERATIONS</span>
        <h1 style="margin: 6px 0 0; font-size: 20px; font-weight: 700; color: #ffffff;">🚨 Security Incident: ${escapeHtml(label)}</h1>
      </div>
      <div style="margin-top: 14px; display: inline-block; background-color: ${sev.badge}; color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">
        ${escapeHtml(alert.severity)} SEVERITY &bull; RISK SCORE ${escapeHtml(alert.riskScore)}/100
      </div>
    </div>

    <!-- Alert Summary Details -->
    <div style="padding: 24px; color: #1e293b;">
      <p style="font-size: 14px; line-height: 1.5; color: #475569; margin: 0 0 18px;">
        An automated security anomaly was flagged by Sentinel AI-Driven User Behaviour Analytics. Immediate review by the Security Manager is recommended.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13.5px;">
        <tbody>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 9px 0; color: #64748b; font-weight: 600; width: 38%;">Alert ID</td>
            <td style="padding: 9px 0; font-family: monospace; font-weight: 600; color: #0f172a;">${escapeHtml(alert.alertId || 'N/A')}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 9px 0; color: #64748b; font-weight: 600;">Employee</td>
            <td style="padding: 9px 0; font-weight: 600; color: #0f172a;">
              ${employeeDisplay}
              ${alert.userEmail ? `<span style="color: #64748b; font-weight: 400;">(${escapeHtml(alert.userEmail)})</span>` : ''}
            </td>
          </tr>
          ${alert.employeeId ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 9px 0; color: #64748b; font-weight: 600;">Employee ID</td>
            <td style="padding: 9px 0; font-family: monospace; color: #0f172a;">${escapeHtml(alert.employeeId)}</td>
          </tr>` : ''}
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 9px 0; color: #64748b; font-weight: 600;">Incident Type</td>
            <td style="padding: 9px 0; font-weight: 600; color: ${sev.color};">${escapeHtml(label)}</td>
          </tr>
          ${alert.expectedTimeWindow ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 9px 0; color: #64748b; font-weight: 600;">Expected Login Time</td>
            <td style="padding: 9px 0; color: #0f172a; font-weight: 600;">${escapeHtml(alert.expectedTimeWindow)} IST</td>
          </tr>` : ''}
          ${alert.actualTime ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 9px 0; color: #64748b; font-weight: 600;">Actual Login Time</td>
            <td style="padding: 9px 0; color: #dc2626; font-weight: 600;">${escapeHtml(alert.actualTime)} IST</td>
          </tr>` : ''}
          ${alert.expectedLocation ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 9px 0; color: #64748b; font-weight: 600;">Expected Location</td>
            <td style="padding: 9px 0; color: #059669; font-weight: 600;">${escapeHtml(alert.expectedLocation)}</td>
          </tr>` : ''}
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 9px 0; color: #64748b; font-weight: 600;">Detected Location</td>
            <td style="padding: 9px 0; color: ${alert.expectedLocation ? '#dc2626' : '#0f172a'}; font-weight: 600;">
              ${escapeHtml(alert.detectedLocation || alert.location || 'Unknown')}
            </td>
          </tr>
          ${alert.fileCount ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 9px 0; color: #64748b; font-weight: 600;">Files Downloaded</td>
            <td style="padding: 9px 0; font-weight: 700; color: #dc2626;">${escapeHtml(alert.fileCount)} files (Within 5 minutes)</td>
          </tr>` : ''}
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 9px 0; color: #64748b; font-weight: 600;">IP Address</td>
            <td style="padding: 9px 0; font-family: monospace; color: #0f172a;">${escapeHtml(alert.ipAddress || 'Unknown IP')}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 9px 0; color: #64748b; font-weight: 600;">Device / Agent</td>
            <td style="padding: 9px 0; color: #0f172a;">${escapeHtml(alert.device || 'Unknown')}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 9px 0; color: #64748b; font-weight: 600;">Timestamp</td>
            <td style="padding: 9px 0; color: #0f172a;">${escapeHtml(localTime)} IST <span style="color: #94a3b8; font-size: 12px;">(${escapeHtml(timestamp)})</span></td>
          </tr>
        </tbody>
      </table>

      <!-- Indicators / Reasons -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #334155; margin-bottom: 10px;">
          🔍 Reason for Suspicious Activity:
        </div>
        <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; line-height: 1.6;">
          ${reasonsHtml || '<li style="color: #64748b;">Anomalous pattern identified by company security policy and ML ensemble.</li>'}
        </ul>
      </div>

      <!-- Recommended Action -->
      <div style="background-color: ${sev.bg}; border-left: 4px solid ${sev.border}; padding: 14px 16px; border-radius: 4px; margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: ${sev.color}; margin-bottom: 6px;">
          Recommended Manager Incident Response
        </div>
        <div style="font-size: 13px; line-height: 1.6; color: #1e293b; white-space: pre-line;">
          ${escapeHtml(defaultRecommendedAction(alert))}
        </div>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin: 28px 0 10px;">
        <a href="${escapeHtml(clientUrl)}/alerts" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px;">
          Open Incident in Sentinel SOC &rarr;
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f1f5f9; padding: 16px 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; text-align: center;">
      Sentinel Behaviour Analytics &bull; AI-Driven User Behaviour Analytics (UBA)<br/>
      Company Location: Bengaluru, Karnataka, India &bull; Confidential Manager Notification
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Builds Plaintext alert email.
 */
const buildAlertText = (alert) => {
  const label = threatLabel(alert.type);
  const reasonsText = (alert.reasons || []).map((r) => `  - ${r}`).join('\n');
  const timestamp = new Date(alert.createdAt || Date.now()).toUTCString();
  const localTime = new Date(alert.createdAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const clientUrl = readEnv('CLIENT_URL') || 'http://localhost:3000';
  const employeeDisplay = alert.employeeName
    ? `${alert.employeeName} (${alert.username})`
    : alert.username;

  return `===================================================================
🚨 SENTINEL UBA SECURITY ALERT: ${alert.severity}
===================================================================

Incident Type:     ${label}
Risk Severity:     ${alert.severity} (Score: ${alert.riskScore}/100)
Alert ID:          ${alert.alertId || 'N/A'}
Employee:          ${employeeDisplay} ${alert.userEmail ? `<${alert.userEmail}>` : ''}
${alert.employeeId ? `Employee ID:       ${alert.employeeId}\n` : ''}${alert.expectedTimeWindow ? `Expected Login:    ${alert.expectedTimeWindow} IST\n` : ''}${alert.actualTime ? `Actual Login:      ${alert.actualTime} IST\n` : ''}${alert.expectedLocation ? `Expected Location: ${alert.expectedLocation}\n` : ''}Detected Location: ${alert.detectedLocation || alert.location || 'Unknown'}
${alert.fileCount ? `Files Downloaded:  ${alert.fileCount} (Within 5 minutes)\n` : ''}IP Address:        ${alert.ipAddress || 'Unknown'}
Device / Agent:    ${alert.device || 'Unknown'}
Timestamp:         ${localTime} IST (${timestamp})

-------------------------------------------------------------------
REASON FOR DETECTION:
-------------------------------------------------------------------
${reasonsText || '  - Anomalous activity flagged by company security policy.'}

-------------------------------------------------------------------
RECOMMENDED ACTION:
-------------------------------------------------------------------
${defaultRecommendedAction(alert)}

Review in SOC Console: ${clientUrl}/alerts
===================================================================
Automated security notification sent to Company Security Manager.
`;
};

/**
 * Sends an email notification for a security alert.
 */
const sendAlertEmail = async (alert) => {
  const recipient = readEnv('ALERT_EMAIL_TO');
  const sender = readEnv('ALERT_EMAIL_FROM') || readEnv('SMTP_USER') || 'alerts@sentinel-uba.local';
  const label = threatLabel(alert.type);
  const employeeName = alert.employeeName || alert.username;
  const subject = `🚨 ${alert.severity} RISK ALERT – ${label} (${employeeName})`;

  if (!recipient) {
    const message = 'ALERT_EMAIL_TO is not defined in backend/.env. No notification recipient configured.';
    console.warn('[EMAIL]', message);
    return {
      sent: false,
      status: 'failed',
      error: message,
      recipient: 'none',
    };
  }

  const transporter = await getTransporter();

  if (!transporter) {
    console.log('[EMAIL:SIMULATED]', { to: recipient, subject, severity: alert.severity, employee: employeeName });
    return {
      sent: false,
      status: 'simulated',
      simulated: true,
      error: 'SMTP credentials missing in backend/.env. Notification simulated.',
      recipient,
    };
  }

  const mailOptions = {
    from: sender,
    to: recipient,
    subject,
    text: buildAlertText(alert),
    html: buildAlertHtml(alert),
  };

  try {
    let info;
    try {
      info = await transporter.sendMail(mailOptions);
    } catch (primaryErr) {
      const isNetworkErr =
        ['ECONNRESET', 'ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED', 'EHOSTUNREACH'].includes(primaryErr.code) ||
        /socket|reset|closed|timeout/i.test(primaryErr.message);
      const isGmail =
        (readEnv('SMTP_HOST') || '').includes('gmail') ||
        (readEnv('SMTP_USER') || '').endsWith('@gmail.com');

      if (isNetworkErr && isGmail && !transporter.__isEthereal) {
        console.warn(`[EMAIL] Primary transport encountered ${primaryErr.code || primaryErr.message}. Initiating automated failover via Gmail SSL...`);
        const fallbackTransporter = nodemailer.createTransport({
          service: 'gmail',
          family: 4,
          auth: {
            user: readEnv('SMTP_USER'),
            pass: (readEnv('SMTP_PASS') || '').replace(/\s+/g, ''),
          },
          connectionTimeout: 30000,
          tls: { rejectUnauthorized: false },
        });
        info = await fallbackTransporter.sendMail(mailOptions);
        console.log(`[EMAIL] Automated failover successful for ${recipient}.`);
      } else {
        throw primaryErr;
      }
    }

    const isEthereal = Boolean(transporter.__isEthereal);
    const previewUrl = isEthereal ? nodemailer.getTestMessageUrl(info) : null;

    if (isEthereal) {
      console.log(`[EMAIL:ETHEREAL] Alert notification accepted for ${recipient}`);
      console.log(`[EMAIL:ETHEREAL] Message ID: ${info.messageId}`);
      console.log(`[EMAIL:ETHEREAL] View live preview: ${previewUrl}`);
    } else {
      console.log(`[EMAIL:SUCCESS] ✉️ Alert email successfully delivered to ${recipient}`);
      console.log(`[EMAIL:SUCCESS] Message ID: ${info.messageId}`);
      console.log(`[EMAIL:SUCCESS] Subject: ${subject}`);
    }

    return {
      sent: true,
      status: isEthereal ? 'ethereal' : 'sent',
      messageId: info.messageId,
      previewUrl,
      recipient,
    };
  } catch (err) {
    console.error(`[EMAIL:FAILED] ❌ Delivery failed for ${recipient}. Code: ${err.code || 'n/a'}. Error: ${err.message}`);

    let hint = '';
    if (err.code === 'EAUTH') {
      hint = 'Authentication rejected. If using Gmail, ensure 2-Step Verification is active and generate a 16-character App Password at https://myaccount.google.com/apppasswords.';
    } else if (/self-signed|certificate/i.test(err.message)) {
      hint = 'TLS certificate interception detected. Setting SMTP_ALLOW_SELF_SIGNED=true in backend/.env allows connection through antivirus or corporate firewalls.';
    } else if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS'].includes(err.code)) {
      hint = 'Network connection failed. Verify host/port or switch SMTP_IP_FAMILY in backend/.env.';
    }

    return {
      sent: false,
      status: 'failed',
      error: err.message,
      hint,
      recipient,
    };
  }
};

/**
 * Sends a standalone test verification email to confirm SMTP connectivity.
 */
const sendTestEmail = async (overrideRecipient = null) => {
  const recipient = overrideRecipient || readEnv('ALERT_EMAIL_TO');
  const sender = readEnv('ALERT_EMAIL_FROM') || readEnv('SMTP_USER') || 'alerts@sentinel-uba.local';

  if (!recipient) {
    return {
      success: false,
      error: 'No recipient email specified and ALERT_EMAIL_TO is not set in backend/.env',
    };
  }

  const transporter = await getTransporter();

  if (!transporter) {
    return {
      success: false,
      error: 'SMTP is not configured in backend/.env. Set SMTP_USER and SMTP_PASS, or set SMTP_SERVICE=ethereal for testing.',
    };
  }

  const testAlert = {
    alertId: `ALT-TEST-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    eventId: `EVT-TEST-${Date.now()}`,
    username: 'admin',
    employeeName: 'Security Administrator',
    employeeId: 'EMP-ADMIN-001',
    userEmail: recipient,
    type: 'outside_working_hours',
    severity: 'HIGH',
    riskScore: 75,
    expectedTimeWindow: '10:00 AM–10:30 AM',
    actualTime: '11:45 AM',
    expectedLocation: 'Bengaluru, India',
    detectedLocation: 'Bengaluru, India',
    ipAddress: '127.0.0.1 (Local Test)',
    location: 'Bengaluru, Karnataka, India',
    device: 'Administrator Verification Probe',
    createdAt: new Date(),
    reasons: [
      'Employee attempted to log in outside the permitted login window.',
      'Manual verification test initiated from Sentinel SOC Settings Console.',
    ],
  };

  const mailOptions = {
    from: sender,
    to: recipient,
    subject: `[Sentinel Test] ✅ Security Email Delivery Verification`,
    text: buildAlertText(testAlert),
    html: buildAlertHtml(testAlert),
  };

  try {
    let info;
    try {
      info = await transporter.sendMail(mailOptions);
    } catch (primaryErr) {
      const isNetworkErr =
        ['ECONNRESET', 'ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED', 'EHOSTUNREACH'].includes(primaryErr.code) ||
        /socket|reset|closed|timeout/i.test(primaryErr.message);
      const isGmail =
        (readEnv('SMTP_HOST') || '').includes('gmail') ||
        (readEnv('SMTP_USER') || '').endsWith('@gmail.com');

      if (isNetworkErr && isGmail && !transporter.__isEthereal) {
        console.warn(`[EMAIL] Test mail primary transport encountered ${primaryErr.code || primaryErr.message}. Initiating automated failover via Gmail SSL...`);
        const fallbackTransporter = nodemailer.createTransport({
          service: 'gmail',
          family: 4,
          auth: {
            user: readEnv('SMTP_USER'),
            pass: (readEnv('SMTP_PASS') || '').replace(/\s+/g, ''),
          },
          connectionTimeout: 30000,
          tls: { rejectUnauthorized: false },
        });
        info = await fallbackTransporter.sendMail(mailOptions);
        console.log(`[EMAIL] Automated test mail failover successful for ${recipient}.`);
      } else {
        throw primaryErr;
      }
    }

    const isEthereal = Boolean(transporter.__isEthereal);
    const previewUrl = isEthereal ? nodemailer.getTestMessageUrl(info) : null;

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
      recipient,
      provider: isEthereal ? 'Ethereal Test Mailbox' : readEnv('SMTP_HOST') || 'smtp.gmail.com',
    };
  } catch (err) {
    let hint = '';
    if (err.code === 'EAUTH') {
      hint = 'Google rejected the username or password. You must use a 16-character Google App Password (not your personal Google account password). Go to https://myaccount.google.com/apppasswords.';
    } else if (/self-signed|certificate/i.test(err.message)) {
      hint = 'Antivirus or network TLS interception detected. Set SMTP_ALLOW_SELF_SIGNED=true in backend/.env.';
    } else if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS'].includes(err.code)) {
      hint = 'Cannot reach the SMTP server over the network. Check port 587 vs 465 or try SMTP_IP_FAMILY=4.';
    }

    return {
      success: false,
      error: err.message,
      code: err.code,
      hint,
      recipient,
    };
  }
};

/**
 * Returns current sanitized SMTP configuration status (never reveals passwords).
 */
const getSmtpStatus = () => {
  const service = readEnv('SMTP_SERVICE') || (readEnv('SMTP_HOST')?.includes('ethereal') ? 'ethereal' : 'standard');
  const user = readEnv('SMTP_USER');
  const host = readEnv('SMTP_HOST') || 'smtp.gmail.com';
  const port = Number(readEnv('SMTP_PORT')) || 587;
  const secure = readEnv('SMTP_SECURE') === 'true' || port === 465;
  const recipient = readEnv('ALERT_EMAIL_TO');
  const hasPass = Boolean(readEnv('SMTP_PASS'));
  const passLength = (readEnv('SMTP_PASS') || '').replace(/\s+/g, '').length;
  const allowSelfSigned = readEnv('SMTP_ALLOW_SELF_SIGNED') === 'true';

  return {
    configured: Boolean(user && hasPass) || service === 'ethereal',
    isEthereal: service === 'ethereal' || user === 'ethereal',
    host,
    port,
    secure,
    user: user || null,
    recipient: recipient || null,
    hasPassword: hasPass,
    passLength,
    isGmailAppPassFormat: host.includes('gmail') ? passLength === 16 : null,
    allowSelfSigned,
  };
};

/**
 * Flushes cached transporter to reload freshly modified environment variables.
 */
const reloadTransporter = () => {
  cachedTransporter = null;
  cachedConfigKey = null;
  cachedEtherealAccount = null;
};

module.exports = {
  sendAlertEmail,
  sendTestEmail,
  getSmtpStatus,
  reloadTransporter,
  threatLabel,
  buildAlertHtml,
  buildAlertText,
};
