const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    actor: { type: String, required: true }, // admin username/email
    action: { type: String, required: true }, // e.g. "LOGIN", "VIEW_USER", "SIMULATE_ATO"
    targetType: { type: String },
    targetId: { type: String },
    ipAddress: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', AuditLogSchema);
