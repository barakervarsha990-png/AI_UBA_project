const User = require('../models/User');
const LoginEvent = require('../models/LoginEvent');
const FileEvent = require('../models/FileEvent');
const Alert = require('../models/Alert');
const Session = require('../models/Session');
const { getPolicy } = require('../services/policyService');

// GET /api/dashboard/summary
const getSummary = async (req, res) => {
  const policy = await getPolicy();
  const authCity = policy?.authorizedLocation?.city || 'Bengaluru';

  const [
    totalEmployees,
    activeEmployees,
    totalLoginAttempts,
    successfulLogins,
    failedLogins,
    suspiciousLogins,
    unauthorizedLocationLogins,
    suspiciousFileEvents,
    highRiskEmployees,
    criticalAlerts,
    openAlerts,
    activeSessions,
    totalFileEvents,
  ] = await Promise.all([
    User.countDocuments({ role: 'employee' }),
    User.countDocuments({ role: 'employee', status: 'active' }),
    LoginEvent.countDocuments({}),
    LoginEvent.countDocuments({ loginStatus: 'success' }),
    LoginEvent.countDocuments({ loginStatus: 'failed' }),
    LoginEvent.countDocuments({ isSuspicious: true }),
    LoginEvent.countDocuments({
      $or: [
        { isLocationUnauthorized: true },
        { locationStatus: 'unauthorized' },
        { city: { $nin: [authCity, 'Bangalore', 'Bengaluru'] } },
      ],
    }),
    FileEvent.countDocuments({ isSuspicious: true }),
    User.countDocuments({ role: 'employee', riskLevel: { $in: ['HIGH', 'CRITICAL'] } }),
    Alert.countDocuments({ severity: 'CRITICAL' }),
    Alert.countDocuments({ status: 'open' }),
    Session.countDocuments({ status: 'active', expiresAt: { $gte: new Date() } }),
    FileEvent.countDocuments({}),
  ]);

  // Combined live SOC event stream (logins + file operations)
  const [recentLogins, recentFiles] = await Promise.all([
    LoginEvent.find({}).sort({ timestamp: -1 }).limit(10).lean(),
    FileEvent.find({}).sort({ timestamp: -1 }).limit(10).lean(),
  ]);

  const recentEvents = [
    ...recentLogins.map((l) => ({
      ...l,
      feedType: 'login',
      title: `${l.employeeName || l.username} ${l.eventType === 'logout' ? 'logged out' : l.loginStatus === 'success' ? 'authenticated' : 'failed login'}${l.isTimeUnauthorized ? ' (Outside Time Window)' : ''}${l.isLocationUnauthorized ? ' (Unauthorized Location)' : ''}`,
    })),
    ...recentFiles.map((f) => ({
      ...f,
      feedType: 'file',
      title: `${f.employeeName || f.username} ${f.action.toUpperCase()} ${f.fileName} (${f.sensitivityLevel.toUpperCase()})${f.isBulkActivity ? ' [MASS ACTIVITY]' : ''}`,
    })),
  ]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 15);

  res.json({
    success: true,
    data: {
      // 11 Core Metrics required by specifications:
      totalEmployees,
      activeEmployees,
      totalLoginAttempts,
      successfulLogins,
      failedLogins,
      suspiciousLogins,
      unauthorizedLocationLogins,
      suspiciousFileAccessEvents: suspiciousFileEvents,
      highRiskEmployees,
      criticalAlerts,
      openAlerts,

      // Additional operational counters
      activeSessions,
      totalFileEvents,
      recentEvents,
    },
  });
};

// GET /api/dashboard/login-activity-by-time (Hourly breakdown 00:00 to 23:00, highlighting 10:00-10:30 window)
const getLoginActivityByTime = async (req, res) => {
  const events = await LoginEvent.find({}, 'time isSuspicious isTimeUnauthorized').lean();

  const hourlyCounts = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, '0')}:00`,
    hourNumber: hour,
    total: 0,
    suspicious: 0,
    outsideWindow: 0,
    isPermittedLoginHour: hour === 10, // 10:00 AM - 10:30 AM
  }));

  events.forEach((e) => {
    if (e.time) {
      const h = parseInt(e.time.split(':')[0], 10);
      if (h >= 0 && h < 24) {
        hourlyCounts[h].total += 1;
        if (e.isSuspicious) hourlyCounts[h].suspicious += 1;
        if (e.isTimeUnauthorized) hourlyCounts[h].outsideWindow += 1;
      }
    }
  });

  res.json({ success: true, data: hourlyCounts });
};

// GET /api/dashboard/suspicious-logins (By Category & Date)
const getSuspiciousLoginAttempts = async (req, res) => {
  const results = await LoginEvent.aggregate([
    {
      $group: {
        _id: {
          category: {
            $cond: [
              '$isLocationUnauthorized',
              'Unauthorized Location',
              {
                $cond: [
                  '$isTimeUnauthorized',
                  'Outside Login Window',
                  {
                    $cond: [
                      { $eq: ['$loginStatus', 'failed'] },
                      'Authentication Failure',
                      { $cond: ['$isSuspicious', 'Anomalous Behaviour', 'Normal'] },
                    ],
                  },
                ],
              },
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  res.json({ success: true, data: results.map((r) => ({ category: r._id.category, count: r.count })) });
};

// GET /api/dashboard/location-activity (Authorized vs Unauthorized Geographic Breakdown)
const getLocationActivity = async (req, res) => {
  const results = await LoginEvent.aggregate([
    {
      $group: {
        _id: { country: '$country', state: '$state', city: '$city' },
        count: { $sum: 1 },
        suspicious: { $sum: { $cond: ['$isSuspicious', 1, 0] } },
        unauthorizedLocation: { $sum: { $cond: ['$isLocationUnauthorized', 1, 0] } },
        avgLat: { $avg: '$latitude' },
        avgLng: { $avg: '$longitude' },
      },
    },
    { $sort: { count: -1 } },
  ]);

  res.json({ success: true, data: results });
};

// GET /api/dashboard/file-activity (By Sensitivity Level & Action)
const getFileActivityStats = async (req, res) => {
  const [byAction, bySensitivity, bulkCount] = await Promise.all([
    FileEvent.aggregate([{ $group: { _id: '$action', count: { $sum: 1 } } }]),
    FileEvent.aggregate([{ $group: { _id: '$sensitivityLevel', count: { $sum: 1 } } }]),
    FileEvent.countDocuments({ isBulkActivity: true }),
  ]);

  res.json({
    success: true,
    data: {
      byAction,
      bySensitivity,
      bulkDownloadsCount: bulkCount,
    },
  });
};

// GET /api/dashboard/risk-distribution (Employee Risk Breakdown)
const getEmployeeRiskDistribution = async (req, res) => {
  const results = await User.aggregate([
    { $match: { role: 'employee' } },
    { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
  ]);

  const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const distribution = levels.map((lvl) => {
    const found = results.find((r) => r._id === lvl);
    return { level: lvl, count: found ? found.count : 0 };
  });

  res.json({ success: true, data: distribution });
};

// GET /api/dashboard/login-activity-trend (14 day trend)
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

module.exports = {
  getSummary,
  getLoginActivityByTime,
  getSuspiciousLoginAttempts,
  getLocationActivity,
  getFileActivityStats,
  getEmployeeRiskDistribution,
  getLoginActivityTrend,
};
