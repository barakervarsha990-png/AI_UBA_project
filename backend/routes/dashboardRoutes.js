const express = require('express');
const {
  getSummary,
  getLoginActivityTrend,
  getRiskTrends,
  getLocationActivity,
  getFileActivityStats,
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/summary', getSummary);
router.get('/login-activity', getLoginActivityTrend);
router.get('/risk-trends', getRiskTrends);
router.get('/location-activity', getLocationActivity);
router.get('/file-activity', getFileActivityStats);

module.exports = router;
