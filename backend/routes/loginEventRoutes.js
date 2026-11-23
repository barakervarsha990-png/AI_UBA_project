const express = require('express');
const { listLoginEvents } = require('../controllers/loginEventController');
const { protect, requireManagerOrAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(requireManagerOrAdmin);
router.get('/', listLoginEvents);

module.exports = router;
