const express = require('express');
const { body } = require('express-validator');
const { login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const router = express.Router();

router.post(
  '/login',
  authLimiter,
  [body('username').trim().notEmpty(), body('password').notEmpty()],
  validate,
  login
);

router.get('/me', protect, getMe);

module.exports = router;
