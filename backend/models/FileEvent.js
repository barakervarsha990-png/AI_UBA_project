const mongoose = require('mongoose');

const FileEventSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true }, // csv, xlsx, pdf, docx...
    sensitivityLevel: { type: String, enum: ['public', 'internal', 'confidential', 'restricted'], default: 'internal' },
    action: { type: String, enum: ['view', 'download', 'copy', 'modify', 'delete'], required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    ipAddress: { type: String, required: true },
    location: { type: String, required: true }, // "City, State, Country"
    device: { type: String, required: true },
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    isSuspicious: { type: Boolean, default: false },
    reasons: [{ type: String }],
    simulated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

FileEventSchema.index({ userId: 1, timestamp: -1 });
FileEventSchema.index({ isSuspicious: 1 });

module.exports = mongoose.model('FileEvent', FileEventSchema);
