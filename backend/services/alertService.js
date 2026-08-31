const Alert = require('../models/Alert');
const { sendAlertEmail } = require('./emailService');
const { sendAlertSms } = require('./smsService');
const { emitNewAlert } = require('./socketService');

const DUPLICATE_ALERT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const raiseAlertIfNeeded = async ({ user, sourceEventType, sourceEventId, scoreResult, ipAddress, location, device, time, type }) => {
  const { riskScore, riskLevel, reasons } = scoreResult;

  if (riskLevel !== 'HIGH' && riskLevel !== 'CRITICAL') {
    return null;
  }

  const windowStart = new Date(Date.now() - DUPLICATE_ALERT_WINDOW_MS);
  const recentDuplicate = await Alert.findOne({
    userId: user._id,
    type,
    createdAt: { $gte: windowStart },
  }).sort({ createdAt: -1 });

  const alert = await Alert.create({
    userId: user._id,
    username: user.username,
    type,
    sourceEventType,
    sourceEventId,
    severity: riskLevel,
    riskScore,
    ipAddress,
    location,
    device,
    time,
    reasons,
  });

  emitNewAlert(alert);

  if (recentDuplicate) {
    console.log(`[ALERT] Duplicate ${type} alert for ${user.username} within ${DUPLICATE_ALERT_WINDOW_MS / 60000}min window — notifications skipped.`);
    return alert;
  }

  const emailResult = await sendAlertEmail(alert);
  const smsResult = await sendAlertSms(alert);

  alert.emailSent = !!emailResult.sent;
  alert.emailError = emailResult.error || null;
  alert.smsSent = !!smsResult.sent;
  alert.smsError = smsResult.error || null;
  alert.notificationTimestamp = new Date();

  await alert.save();

  return alert;
};

module.exports = { raiseAlertIfNeeded };