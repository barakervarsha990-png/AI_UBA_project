const LoginEvent = require('../models/LoginEvent');

// GET /api/login-events?suspicious=true&limit=50
const listLoginEvents = async (req, res) => {
  const { suspicious, userId, limit = 100, page = 1 } = req.query;
  const filter = {};
  if (suspicious === 'true') filter.isSuspicious = true;
  if (userId) filter.userId = userId;

  const events = await LoginEvent.find(filter)
    .sort({ timestamp: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await LoginEvent.countDocuments(filter);

  res.json({ success: true, data: events, total, page: Number(page), limit: Number(limit) });
};

module.exports = { listLoginEvents };
