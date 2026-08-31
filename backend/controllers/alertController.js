const Alert = require('../models/Alert');
const { logAudit } = require('../utils/auditLogger');

// GET /api/alerts?status=open
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
    return res.status(400).json({ success: false, message: 'Invalid status value' });
  }

  const alert = await Alert.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });

  await logAudit({
    actor: req.user.username,
    action: 'UPDATE_ALERT_STATUS',
    targetType: 'Alert',
    targetId: alert._id.toString(),
    ipAddress: req.ip,
    details: { status },
  });

  res.json({ success: true, data: alert });
};

module.exports = { listAlerts, updateAlertStatus };
