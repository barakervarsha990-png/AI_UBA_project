const express = require('express');
const { simulateAccountTakeover, simulateInsiderThreat } = require('../controllers/simulateController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.post('/account-takeover', simulateAccountTakeover);
router.post('/insider-threat', simulateInsiderThreat);

module.exports = router;
