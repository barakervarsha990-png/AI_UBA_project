const mongoose = require('mongoose');

const CompanyPolicySchema = new mongoose.Schema(
  {
    companyName: { type: String, default: 'Sentinel Security Enterprise' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    // Working hours: 10:00 AM to 5:00 PM (10:00 - 17:00)
    workingHoursStart: { type: String, default: '10:00' },
    workingHoursEnd: { type: String, default: '17:00' },
    // Strict employee login permission window: 10:00 AM to 10:30 AM
    loginWindowStart: { type: String, default: '10:00' },
    loginWindowEnd: { type: String, default: '10:30' },
    // Authorized company registered location: Bengaluru, Karnataka, India
    authorizedLocation: {
      city: { type: String, default: 'Bengaluru' },
      state: { type: String, default: 'Karnataka' },
      country: { type: String, default: 'India' },
    },
    // File access thresholds
    maxFilesPerWindow: { type: Number, default: 10 }, // >10 files triggers alert
    fileWindowMinutes: { type: Number, default: 5 },  // 5 minute window
    // Manager login policy overrides so managers are never accidentally locked out
    managerExemptFromTimeRestrictions: { type: Boolean, default: true },
    managerExemptFromLocationRestrictions: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CompanyPolicy', CompanyPolicySchema);

