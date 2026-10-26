const Alert = require('../models/Alert');
const { sendAlertEmail } = require('./emailService');
const { emitNewAlert } = require('./socketService');

/**
 * Creates an alert when a HIGH or CRITICAL risk event is detected,
 * emits it in real time via Socket.IO, and sends an email notification.
 */
const raiseAlertIfNeeded = async ({ user, sourceEventType, sourceEventId, scoreResult, ipAddress, location, device, time, type }) => {
  const { riskScore, riskLevel, reasons } = scoreResult;

  if (riskLevel !== 'HIGH' && riskLevel !== 'CRITICAL') {
    return null;
  }

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

  const emailResult = await sendAlertEmail(alert);
  if (emailResult.sent) {
    alert.emailSent = true;
    await alert.save();
  }

  return alert;
};

module.exports = { raiseAlertIfNeeded };
