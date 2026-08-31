const express = require('express');
const { listAlerts, updateAlertStatus } = require('../controllers/alertController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/', listAlerts);
router.patch('/:id/status', updateAlertStatus);

module.exports = router;
