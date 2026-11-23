const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Not authorized: No security token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sentinel_secret_key');

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authorized: User account not found' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact your Security Administrator.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized: Invalid or expired session token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied: Administrator privileges required' });
  }
  next();
};

const requireManagerOrAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'manager') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Security Manager or Administrator privilege required to access SOC operations.',
    });
  }
  next();
};

const employeeOnly = (req, res, next) => {
  if (req.user?.role !== 'employee') {
    return res.status(403).json({ success: false, message: 'Access denied: Employee role required' });
  }
  next();
};

module.exports = { protect, adminOnly, requireManagerOrAdmin, employeeOnly };
