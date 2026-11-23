const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema(
  {
    alertId: { type: String, unique: true, sparse: true, index: true },
    eventId: { type: String, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employeeId: { type: String, default: null },
    employeeName: { type: String, default: null },
    username: { type: String, required: true },
    userEmail: { type: String },
    type: {
      type: String,
      enum: [
        'account_takeover',
        'insider_threat',
        'brute_force',
        'impossible_travel',
        'outside_working_hours',
        'unauthorized_location',
        'bulk_file_download',
      ],
      required: true,
    },
    sourceEventType: { type: String, enum: ['login', 'file'], required: true },
    sourceEventId: { type: mongoose.Schema.Types.ObjectId },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
    riskScore: { type: Number, required: true },
    ipAddress: { type: String },
    location: { type: String },
    device: { type: String },
    time: { type: String },

    // Policy & Anomaly Specific Evidence
    expectedLocation: { type: String, default: null },
    detectedLocation: { type: String, default: null },
    expectedTimeWindow: { type: String, default: null },
    actualTime: { type: String, default: null },
    fileCount: { type: Number, default: 0 },
    fileNames: [{ type: String }],
    reasons: [{ type: String }],
    recommendedAction: { type: String, default: null },
    detectionSource: { type: String, default: 'Rule Engine' },

    // Triage & Notification Lifecycle
    status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open' },
    emailSent: { type: Boolean, default: false },
    emailStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'simulated', 'ethereal'],
      default: 'pending',
    },
    emailError: { type: String },
    emailMessageId: { type: String },
    emailPreviewUrl: { type: String },
    emailSentAt: { type: Date },
    emailRecipient: { type: String },
    acknowledgedAt: { type: Date },
    acknowledgedBy: { type: String },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
  },
  { timestamps: true }
);

AlertSchema.index({ status: 1, createdAt: -1 });
AlertSchema.index({ type: 1, createdAt: -1 });
AlertSchema.index({ severity: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', AlertSchema);
