const User = require('../models/User');
const Baseline = require('../models/Baseline');
const LoginEvent = require('../models/LoginEvent');
const FileEvent = require('../models/FileEvent');
const Alert = require('../models/Alert');

// GET /api/users
const listUsers = async (req, res) => {
  const users = await User.find({ role: 'employee' }).sort({ riskLevel: -1, fullName: 1 });
  res.json({ success: true, data: users });
};

// GET /api/users/:id
const getUserDetails = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const [baseline, recentLogins, recentFiles, alerts] = await Promise.all([
    Baseline.findOne({ userId: user._id }),
    LoginEvent.find({ userId: user._id }).sort({ timestamp: -1 }).limit(20),
    FileEvent.find({ userId: user._id }).sort({ timestamp: -1 }).limit(30),
    Alert.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20),
  ]);

  res.json({ success: true, data: { user, baseline, recentLogins, recentFiles, alerts } });
};

module.exports = { listUsers, getUserDetails };
