const mongoose = require('mongoose');

const LoginEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    employeeId: { type: String, default: null },
    employeeName: { type: String, default: null },
    username: { type: String, required: true, index: true },
    userRole: { type: String, default: 'employee' },
    date: { type: String, required: true }, // YYYY-MM-DD
    time: { type: String, required: true }, // HH:mm:ss
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    ipAddress: { type: String, required: true },
    country: { type: String, default: 'India' },
    state: { type: String, default: 'Karnataka' },
    city: { type: String, default: 'Bengaluru' },
    latitude: { type: Number, default: 12.9716 },
    longitude: { type: Number, default: 77.5946 },
    device: { type: String, required: true },
    os: { type: String, default: 'Windows' },
    browser: { type: String, default: 'Chrome' },
    userAgent: { type: String },
    sessionId: { type: String },
    eventType: { type: String, enum: ['login', 'logout'], default: 'login' },
    loginStatus: { type: String, enum: ['success', 'failed'], default: 'success' },
    failureReasonCategory: { type: String, default: null }, // INVALID_PASSWORD, USER_NOT_FOUND, RATE_LIMITED, ACCOUNT_DISABLED

    // Policy Compliance Metadata
    expectedLocation: { type: String, default: 'Bengaluru, Karnataka, India' },
    detectedLocation: { type: String, default: 'Bengaluru, Karnataka, India' },
    locationStatus: {
      type: String,
      enum: ['authorized', 'unauthorized', 'unavailable', 'local_network', 'exempt'],
      default: 'authorized',
    },
    isLocationUnauthorized: { type: Boolean, default: false },

    expectedTimeWindow: { type: String, default: '10:00 AM–10:30 AM' },
    actualLoginTime: { type: String },
    timePolicyStatus: {
      type: String,
      enum: ['permitted_window', 'outside_window', 'outside_hours', 'exempt'],
      default: 'permitted_window',
    },
    isTimeUnauthorized: { type: Boolean, default: false },

    // Security & Threat Analytics
    failedAttemptsInWindow: { type: Number, default: 0 },
    isAfterFailures: { type: Boolean, default: false },
    previousLoginAt: { type: Date },
    knownDevice: { type: Boolean, default: false },
    knownIp: { type: Boolean, default: false },
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    isSuspicious: { type: Boolean, default: false, index: true },
    reasons: [{ type: String }],
    mlScores: {
      isolationForestAnomaly: { type: Number, default: 0 },
      randomForestSuspiciousProb: { type: Number, default: 0 },
      modelUsed: { type: String, default: 'Ensemble' },
    },
    detectionSource: { type: String, default: 'real_time_authentication' },
    simulated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

LoginEventSchema.index({ userId: 1, timestamp: -1 });
LoginEventSchema.index({ username: 1, timestamp: -1 });
LoginEventSchema.index({ isSuspicious: 1, timestamp: -1 });
LoginEventSchema.index({ isLocationUnauthorized: 1 });
LoginEventSchema.index({ isTimeUnauthorized: 1 });

module.exports = mongoose.model('LoginEvent', LoginEventSchema);
