const Alert = require('../models/Alert');
const { logAudit } = require('../utils/auditLogger');
const { emitDashboardRefresh, emitNewAlert } = require('../services/socketService');
const {
  sendAlertEmail,
  sendTestEmail,
  getSmtpStatus,
  reloadTransporter,
} = require('../services/emailService');

// GET /api/alerts?status=open&severity=CRITICAL&limit=100
const listAlerts = async (req, res) => {
  const { status, severity, limit = 100 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (severity) filter.severity = severity;

  const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
  res.json({ success: true, data: alerts });
};

// PATCH /api/alerts/:id/status
const updateAlertStatus = async (req, res) => {
  const { status } = req.body;
  if (!['open', 'acknowledged', 'resolved'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status value. Must be open, acknowledged, or resolved.' });
  }

  const updateFields = { status };
  if (status === 'acknowledged') {
    updateFields.acknowledgedAt = new Date();
    updateFields.acknowledgedBy = req.user?.username || 'admin';
  } else if (status === 'resolved') {
    updateFields.resolvedAt = new Date();
    updateFields.resolvedBy = req.user?.username || 'admin';
  }

  const alert = await Alert.findByIdAndUpdate(req.params.id, updateFields, { new: true });
  if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });

  emitDashboardRefresh();

  await logAudit({
    actor: req.user?.username || 'admin',
    action: 'UPDATE_ALERT_STATUS',
    targetType: 'Alert',
    targetId: alert._id.toString(),
    ipAddress: req.ip,
    details: { status, previousStatus: alert.status },
  });

  res.json({ success: true, data: alert });
};

// GET /api/alerts/email-status
const getEmailStatus = (req, res) => {
  const status = getSmtpStatus();
  res.json({ success: true, data: status });
};

// POST /api/alerts/test-email
const sendTestNotification = async (req, res) => {
  const { recipient } = req.body;
  const result = await sendTestEmail(recipient);

  await logAudit({
    actor: req.user?.username || 'admin',
    action: 'SEND_TEST_SECURITY_EMAIL',
    targetType: 'EmailService',
    ipAddress: req.ip,
    details: {
      recipient: result.recipient || recipient,
      success: result.success,
      error: result.error || null,
      messageId: result.messageId || null,
    },
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error || 'Failed to send test email',
      hint: result.hint,
      data: result,
    });
  }

  res.json({
    success: true,
    message: result.previewUrl
      ? `Test notification accepted by ${result.provider}. Preview available online.`
      : `Test notification successfully delivered to ${result.recipient}.`,
    data: result,
  });
};

// POST /api/alerts/:id/resend-email
const resendAlertEmail = async (req, res) => {
  const alert = await Alert.findById(req.params.id);
  if (!alert) {
    return res.status(404).json({ success: false, message: 'Alert not found' });
  }

  const result = await sendAlertEmail(alert);

  if (result.sent) {
    alert.emailSent = true;
    alert.emailStatus = result.status || 'sent';
    alert.emailMessageId = result.messageId || null;
    alert.emailPreviewUrl = result.previewUrl || null;
    alert.emailRecipient = result.recipient || null;
    alert.emailSentAt = new Date();
    alert.emailError = null;
  } else {
    alert.emailSent = false;
    alert.emailStatus = result.simulated ? 'simulated' : 'failed';
    alert.emailError = result.error || 'Failed to resend';
  }

  await alert.save();
  emitDashboardRefresh();

  await logAudit({
    actor: req.user?.username || 'admin',
    action: 'RESEND_ALERT_EMAIL',
    targetType: 'Alert',
    targetId: alert._id.toString(),
    ipAddress: req.ip,
    details: {
      alertId: alert.alertId,
      emailSent: alert.emailSent,
      emailStatus: alert.emailStatus,
      error: alert.emailError,
    },
  });

  res.json({
    success: result.sent,
    message: result.sent
      ? 'Alert email notification successfully re-sent.'
      : `Failed to send alert email: ${result.error}`,
    hint: result.hint,
    data: alert,
  });
};

module.exports = {
  listAlerts,
  updateAlertStatus,
  getEmailStatus,
  sendTestNotification,
  resendAlertEmail,
};
