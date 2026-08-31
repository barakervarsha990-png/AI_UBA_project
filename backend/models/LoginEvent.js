const mongoose = require('mongoose');

const LoginEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    time: { type: String, required: true }, // HH:mm:ss
    timestamp: { type: Date, required: true, default: Date.now },
    ipAddress: { type: String, required: true },
    country: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    latitude: { type: Number },
    longitude: { type: Number },
    device: { type: String, required: true },
    os: { type: String, required: true },
    browser: { type: String, required: true },
    loginStatus: { type: String, enum: ['success', 'failed'], default: 'success' },
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    isSuspicious: { type: Boolean, default: false },
    reasons: [{ type: String }],
    simulated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

LoginEventSchema.index({ userId: 1, timestamp: -1 });
LoginEventSchema.index({ isSuspicious: 1 });

module.exports = mongoose.model('LoginEvent', LoginEventSchema);
