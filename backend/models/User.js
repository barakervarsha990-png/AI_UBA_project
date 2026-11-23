const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    department: { type: String, default: 'Engineering' },
    jobTitle: { type: String, default: 'Staff Member' },
    role: { type: String, enum: ['admin', 'manager', 'employee'], default: 'employee' },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    assignedLocation: { type: String, default: 'Bengaluru, Karnataka, India' },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', UserSchema);
