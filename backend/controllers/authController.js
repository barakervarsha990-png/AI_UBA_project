const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logAudit } = require('../utils/auditLogger');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

// POST /api/auth/login
const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const user = await User.findOne({ username }).select('+password');
  if (!user || user.role !== 'admin') {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user);

  await logAudit({
    actor: user.username,
    action: 'ADMIN_LOGIN',
    targetType: 'User',
    targetId: user._id.toString(),
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    token,
    user: {
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
  });
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

module.exports = { login, getMe };
