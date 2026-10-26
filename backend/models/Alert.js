const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    type: { type: String, enum: ['account_takeover', 'insider_threat'], required: true },
    sourceEventType: { type: String, enum: ['login', 'file'], required: true },
    sourceEventId: { type: mongoose.Schema.Types.ObjectId },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
    riskScore: { type: Number, required: true },
    ipAddress: { type: String },
    location: { type: String },
    device: { type: String },
    time: { type: String },
    reasons: [{ type: String }],
    status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open' },
    emailSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AlertSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', AlertSchema);
