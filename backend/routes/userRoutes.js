const express = require('express');
const { listUsers, getUserDetails } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/', listUsers);
router.get('/:id', getUserDetails);

module.exports = router;
