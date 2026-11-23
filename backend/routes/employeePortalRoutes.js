const express = require('express');
const { getEmployeeDashboard, getMyLogins, getMyFiles } = require('../controllers/employeePortalController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/dashboard', getEmployeeDashboard);
router.get('/logins', getMyLogins);
router.get('/files', getMyFiles);

module.exports = router;

