const { v4: uuidv4 } = require('uuid');
const Alert = require('../models/Alert');
const { sendAlertEmail } = require('./emailService');
const { emitNewAlert, emitDashboardRefresh } = require('./socketService');

const DUPLICATE_ALERT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes window

/**
 * Creates an alert when a HIGH or CRITICAL risk event is detected,
 * emits it in real time via Socket.IO, and sends an email notification to the manager.
 * Prevents duplicate alerts from flooding the dashboard within the deduplication window.
 */
const raiseAlertIfNeeded = async ({
  user,
  sourceEventType,
  sourceEventId,
  scoreResult,
  ipAddress,
  location,
  device,
  time,
  type,
  eventId,
  expectedLocation,
  detectedLocation,
  expectedTimeWindow,
  actualTime,
  fileCount,
  fileNames,
}) => {
  if (!scoreResult) {
    return null;
  }

  const { riskScore, riskLevel, reasons, recommendedAction, detectionSource } = scoreResult;

  if (riskLevel !== 'HIGH' && riskLevel !== 'CRITICAL') {
    return null;
  }

  const username = user?.username || 'unknown_user';
  const userId = user?._id || null;
  const employeeId = user?.employeeId || null;
  const employeeName = user?.fullName || username;
  const userEmail = user?.email || (username.includes('@') ? username : `${username}@company.com`);

  // Normalize alert type to match schema enum
  const validTypes = [
    'account_takeover',
    'insider_threat',
    'brute_force',
    'impossible_travel',
    'outside_working_hours',
    'unauthorized_location',
    'bulk_file_download',
  ];

  let normalizedType = type;
  if (!validTypes.includes(type)) {
    if (type === 'location_anomaly') {
      normalizedType = 'unauthorized_location';
    } else if (type === 'time_anomaly') {
      normalizedType = 'outside_working_hours';
    } else if (type === 'mass_download') {
      normalizedType = 'bulk_file_download';
    } else {
      normalizedType = 'account_takeover';
    }
  }

  // Deduplication check: throttle exact identical open alerts within a 20-second debounce
  const recentDuplicate = await Alert.findOne({
    username,
    type: normalizedType,
    severity: riskLevel,
    status: 'open',
    actualTime: actualTime || null,
    detectedLocation: detectedLocation || location || null,
    createdAt: { $gte: new Date(Date.now() - 20 * 1000) },
  });

  if (recentDuplicate) {
    console.log(`[ALERT] Throttling duplicate ${normalizedType} alert for ${username} (debounced 20s).`);
    return recentDuplicate;
  }

  // Create alert record with full policy, evidence, and telemetry details
  const alert = await Alert.create({
    alertId: `ALT-${uuidv4().slice(0, 8).toUpperCase()}`,
    eventId: eventId || (sourceEventId ? sourceEventId.toString() : uuidv4()),
    userId,
    employeeId,
    employeeName,
    username,
    userEmail,
    type: normalizedType,
    sourceEventType,
    sourceEventId,
    severity: riskLevel,
    riskScore,
    ipAddress,
    location,
    device,
    time,
    expectedLocation: expectedLocation || null,
    detectedLocation: detectedLocation || location || null,
    expectedTimeWindow: expectedTimeWindow || null,
    actualTime: actualTime || time || null,
    fileCount: fileCount || 0,
    fileNames: fileNames || [],
    reasons: reasons || [],
    recommendedAction: recommendedAction || null,
    detectionSource: detectionSource || 'Rule Engine & ML Ensemble',
    status: 'open',
    emailSent: false,
    emailStatus: 'pending',
  });

  // Dispatch Email Notification to Security Manager
  try {
    const emailResult = await sendAlertEmail(alert);
    if (emailResult.sent) {
      alert.emailSent = true;
      alert.emailStatus = emailResult.status || 'sent';
      alert.emailMessageId = emailResult.messageId || null;
      alert.emailPreviewUrl = emailResult.previewUrl || null;
      alert.emailRecipient = emailResult.recipient || null;
      alert.emailSentAt = new Date();
      alert.emailError = null;
    } else if (emailResult.simulated) {
      alert.emailSent = false;
      alert.emailStatus = 'simulated';
      alert.emailError = emailResult.error || 'Simulated: SMTP not configured';
      alert.emailRecipient = emailResult.recipient || null;
    } else {
      alert.emailSent = false;
      alert.emailStatus = 'failed';
      alert.emailError = emailResult.error || 'Failed to dispatch email';
      alert.emailRecipient = emailResult.recipient || null;
    }
    await alert.save();
  } catch (err) {
    console.warn('[ALERT] Email dispatch caught unexpected error:', err.message);
    alert.emailSent = false;
    alert.emailStatus = 'failed';
    alert.emailError = err.message;
    await alert.save().catch(() => {});
  }

  // Emit real-time Socket.IO event with email status attached
  emitNewAlert(alert);
  emitDashboardRefresh();

  return alert;
};

module.exports = { raiseAlertIfNeeded };
