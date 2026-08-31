const axios = require('axios');

const buildAlertText = (alert) => {
  const typeLabel = alert.type === 'account_takeover' ? 'Account Takeover' : 'Insider Threat';
  return (
    `[${alert.severity}] ${typeLabel} alert for ${alert.username}. ` +
    `Risk score ${alert.riskScore}/100. ` +
    `Location: ${alert.location || 'N/A'}, Device: ${alert.device || 'N/A'}. ` +
    `Review in the SOC dashboard.`
  );
};

const sendAlertSms = async (alert) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const toNumber = process.env.ALERT_PHONE_NUMBER;

  if (!sid || !authToken || !fromNumber || !toNumber) {
    console.warn('[SMS] Twilio credentials not fully configured. Message will be logged, not sent.');
    console.log('[SMS:SIMULATED]', { to: toNumber, body: buildAlertText(alert) });
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
    const message = err.response?.data?.message || err.message;
    console.error('[SMS] Failed to send alert message:', message);
    return { sent: false, error: message };
  }
};

module.exports = { sendAlertSms };