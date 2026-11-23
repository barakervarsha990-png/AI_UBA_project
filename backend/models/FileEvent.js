const mongoose = require('mongoose');

const FileEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, unique: true, sparse: true, index: true },
    employeeId: { type: String, required: true },
    employeeName: { type: String, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true }, // csv, xlsx, pdf, docx...
    sensitivityLevel: {
      type: String,
      enum: ['public', 'internal', 'confidential', 'restricted'],
      default: 'internal',
    },
    action: {
      type: String,
      enum: ['view', 'download', 'export', 'copy', 'modify', 'delete'],
      required: true,
    },
    date: { type: String, required: true },
    time: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    sessionId: { type: String, default: null },
    ipAddress: { type: String, required: true },
    location: { type: String, required: true }, // "City, State, Country"
    device: { type: String, required: true },

    // Threshold & Anomaly Metrics
    filesInWindow: { type: Number, default: 1 },
    isBulkActivity: { type: Boolean, default: false },

    // Risk & Threat Evaluation
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    isSuspicious: { type: Boolean, default: false },
    reasons: [{ type: String }],
    mlScores: {
      isolationForestAnomaly: { type: Number, default: 0 },
      randomForestSuspiciousProb: { type: Number, default: 0 },
      modelUsed: { type: String, default: 'Ensemble' },
    },
    detectionSource: { type: String, default: 'file_monitor' },
    simulated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

FileEventSchema.index({ userId: 1, timestamp: -1 });
FileEventSchema.index({ isSuspicious: 1 });
FileEventSchema.index({ isBulkActivity: 1 });
FileEventSchema.index({ action: 1 });

module.exports = mongoose.model('FileEvent', FileEventSchema);
