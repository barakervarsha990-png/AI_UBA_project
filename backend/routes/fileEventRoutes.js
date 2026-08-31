const express = require('express');
const { listFileEvents } = require('../controllers/fileEventController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/', listFileEvents);

module.exports = router;
