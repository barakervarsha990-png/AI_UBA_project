const mongoose = require('mongoose');

const BaselineSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    normalCountries: [{ type: String }],
    normalStates: [{ type: String }],
    normalCities: [{ type: String }],
    normalDevices: [{ type: String }],
    normalIpAddresses: [{ type: String }],
    typicalLoginHourStart: { type: Number, default: 9 }, // 24h format
    typicalLoginHourEnd: { type: Number, default: 19 },
    avgFilesAccessedPerDay: { type: Number, default: 3 },
    maxFilesAccessedPerDay: { type: Number, default: 6 },
    avgConfidentialFilesPerDay: { type: Number, default: 1 },
    lastRecalculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Baseline', BaselineSchema);
