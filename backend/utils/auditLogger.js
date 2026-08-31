const AuditLog = require('../models/AuditLog');

const logAudit = async ({ actor, action, targetType, targetId, ipAddress, details }) => {
  try {
    await AuditLog.create({ actor, action, targetType, targetId, ipAddress, details });
  } catch (err) {
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
};

module.exports = { logAudit };
