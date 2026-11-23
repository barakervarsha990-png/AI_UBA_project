const express = require('express');
const { listUsers, getUserDetails } = require('../controllers/userController');
const { protect, requireManagerOrAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(requireManagerOrAdmin);

router.get('/', listUsers);
router.get('/:id', getUserDetails);

module.exports = router;
