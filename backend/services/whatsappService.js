const axios = require('axios');

const buildAlertText = (alert) => {
  const typeLabel = alert.type === 'account_takeover' ? 'Possible Account Takeover' : 'Possible Insider Threat';
  const reasons = (alert.reasons || []).map((r) => `- ${r}`).join('\n');

  return (
    `🚨 *SOC Alert: ${alert.severity} Severity*\n\n` +
    `*Type:* ${typeLabel}\n` +
    `*User:* ${alert.username}\n` +
    `*Risk Score:* ${alert.riskScore}/100\n` +
    `*Time:* ${alert.time || ''}\n` +
    `*IP:* ${alert.ipAddress || 'N/A'}\n` +
    `*Location:* ${alert.location || 'N/A'}\n` +
    `*Device:* ${alert.device || 'N/A'}\n\n` +
    (reasons ? `*Reasons:*\n${reasons}\n\n` : '') +
    `Review in the SOC dashboard.`
  );
};

const sendAlertWhatsapp = async (alert) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
  const toNumber = process.env.ALERT_WHATSAPP_TO;

  if (!sid || !authToken || !fromNumber || !toNumber) {
    console.warn('[WHATSAPP] Twilio credentials not fully configured. Message will be logged, not sent.');
    console.log('[WHATSAPP:SIMULATED]', { to: toNumber, body: buildAlertText(alert) });
    return { sent: false, simulated: true };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  try {
    await axios.post(
      url,
      new URLSearchParams({
        From: fromNumber,
        To: toNumber,
        Body: buildAlertText(alert),
      }),
      {
        auth: { username: sid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    return { sent: true, simulated: false };
  } catch (err) {
    console.error('[WHATSAPP] Failed to send alert message:', err.response?.data?.message || err.message);
    return { sent: false, error: err.response?.data?.message || err.message };
  }
};

module.exports = { sendAlertWhatsapp };