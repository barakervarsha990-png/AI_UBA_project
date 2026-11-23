const express = require('express');
const {
  listAlerts,
  updateAlertStatus,
  getEmailStatus,
  sendTestNotification,
  resendAlertEmail,
} = require('../controllers/alertController');
const { protect, requireManagerOrAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(requireManagerOrAdmin);

router.get('/', listAlerts);
router.get('/email-status', getEmailStatus);
router.post('/test-email', sendTestNotification);
router.patch('/:id/status', updateAlertStatus);
router.post('/:id/resend-email', resendAlertEmail);

module.exports = router;
