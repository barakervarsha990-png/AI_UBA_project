const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    username: { type: String, required: true },
    ipAddress: { type: String, required: true },
    device: { type: String, default: 'Desktop Browser' },
    os: { type: String, default: 'Unknown OS' },
    browser: { type: String, default: 'Unknown Browser' },
    userAgent: { type: String },
    loginAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'revoked', 'expired'], default: 'active', index: true },
  },
  { timestamps: true }
);

SessionSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('Session', SessionSchema);
