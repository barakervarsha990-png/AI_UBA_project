const express = require('express');
const {
  getSummary,
  getLoginActivityByTime,
  getSuspiciousLoginAttempts,
  getLocationActivity,
  getFileActivityStats,
  getEmployeeRiskDistribution,
  getLoginActivityTrend,
} = require('../controllers/dashboardController');
const { protect, requireManagerOrAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(requireManagerOrAdmin);

router.get('/summary', getSummary);
router.get('/login-activity-by-time', getLoginActivityByTime);
router.get('/suspicious-logins', getSuspiciousLoginAttempts);
router.get('/location-activity', getLocationActivity);
router.get('/file-activity', getFileActivityStats);
router.get('/risk-distribution', getEmployeeRiskDistribution);
router.get('/login-activity', getLoginActivityTrend);

module.exports = router;
