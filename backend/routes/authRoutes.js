const express = require('express');
const { body } = require('express-validator');
const { login, register, logout, getActiveSessions, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const router = express.Router();

// Real-time login (admin and employee)
router.post(
  '/login',
  authLimiter,
  [body('username').trim().notEmpty(), body('password').notEmpty()],
  validate,
  login
);

// Demo user registration
router.post(
  '/register',
  [
    body('username').trim().notEmpty(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('fullName').trim().notEmpty(),
  ],
  validate,
  register
);

// User logout and session invalidation
router.post('/logout', logout);

// Active sessions tracking
router.get('/sessions', protect, getActiveSessions);

// Current user profile
router.get('/me', protect, getMe);

module.exports = router;
