const express = require('express');
const { listLoginEvents } = require('../controllers/loginEventController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/', listLoginEvents);

module.exports = router;
