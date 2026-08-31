const User = require('../models/User');
const LoginEvent = require('../models/LoginEvent');
const FileEvent = require('../models/FileEvent');
const Alert = require('../models/Alert');

// GET /api/dashboard/summary
const getSummary = async (req, res) => {
  const [totalUsers, activeUsers, loginAttempts, suspiciousLogins, fileEvents, highRiskUsers, criticalAlerts, openAlerts] =
    await Promise.all([
      User.countDocuments({ role: 'employee' }),
      User.countDocuments({ role: 'employee', status: 'active' }),
      LoginEvent.countDocuments({}),
      LoginEvent.countDocuments({ isSuspicious: true }),
      FileEvent.countDocuments({}),
      User.countDocuments({ riskLevel: { $in: ['HIGH', 'CRITICAL'] } }),
      Alert.countDocuments({ severity: 'CRITICAL' }),
      Alert.countDocuments({ status: 'open' }),
    ]);

  res.json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      loginAttempts,
      suspiciousLogins,
      fileEvents,
      highRiskUsers,
      criticalAlerts,
      openAlerts,
    },
  });
};

// GET /api/dashboard/login-activity  (last 14 days, grouped by date)
const getLoginActivityTrend = async (req, res) => {
  const results = await LoginEvent.aggregate([
    {
      $group: {
        _id: '$date',
        total: { $sum: 1 },
        suspicious: { $sum: { $cond: ['$isSuspicious', 1, 0] } },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: 14 },
    { $sort: { _id: 1 } },
  ]);
  res.json({ success: true, data: results });
};

// GET /api/dashboard/risk-trends (last 14 days avg risk score)
const getRiskTrends = async (req, res) => {
  const loginTrend = await LoginEvent.aggregate([
    { $group: { _id: '$date', avgRisk: { $avg: '$riskScore' } } },
    { $sort: { _id: -1 } },
    { $limit: 14 },
    { $sort: { _id: 1 } },
  ]);
  const fileTrend = await FileEvent.aggregate([
    { $group: { _id: '$date', avgRisk: { $avg: '$riskScore' } } },
    { $sort: { _id: -1 } },
    { $limit: 14 },
    { $sort: { _id: 1 } },
  ]);
  res.json({ success: true, data: { loginTrend, fileTrend } });
};

// GET /api/dashboard/location-activity
const getLocationActivity = async (req, res) => {
  const results = await LoginEvent.aggregate([
    {
      $group: {
        _id: { country: '$country', state: '$state', city: '$city' },
        count: { $sum: 1 },
        suspicious: { $sum: { $cond: ['$isSuspicious', 1, 0] } },
        avgLat: { $avg: '$latitude' },
        avgLng: { $avg: '$longitude' },
      },
    },
    { $sort: { count: -1 } },
  ]);
  res.json({ success: true, data: results });
};

// GET /api/dashboard/file-activity
const getFileActivityStats = async (req, res) => {
  const byAction = await FileEvent.aggregate([{ $group: { _id: '$action', count: { $sum: 1 } } }]);
  const bySensitivity = await FileEvent.aggregate([{ $group: { _id: '$sensitivityLevel', count: { $sum: 1 } } }]);
  res.json({ success: true, data: { byAction, bySensitivity } });
};

module.exports = {
  getSummary,
  getLoginActivityTrend,
  getRiskTrends,
  getLocationActivity,
  getFileActivityStats,
};
