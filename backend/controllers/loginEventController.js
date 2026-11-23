const LoginEvent = require('../models/LoginEvent');

// GET /api/login-events?suspicious=true&status=failed&riskLevel=CRITICAL&limit=100
const listLoginEvents = async (req, res) => {
  const {
    suspicious,
    userId,
    username,
    status,
    eventType,
    riskLevel,
    outsideWindow,
    unauthorizedLocation,
    permittedWindow,
    limit = 100,
    page = 1,
  } = req.query;
  const filter = {};

  if (suspicious === 'true') filter.isSuspicious = true;
  if (userId) filter.userId = userId;
  if (username) filter.username = { $regex: username, $options: 'i' };
  if (status) filter.loginStatus = status;
  if (eventType) filter.eventType = eventType;
  if (riskLevel) filter.riskLevel = riskLevel.toUpperCase();
  if (outsideWindow === 'true') filter.isTimeUnauthorized = true;
  if (unauthorizedLocation === 'true') filter.isLocationUnauthorized = true;
  if (permittedWindow === 'true') filter.timePolicyStatus = 'permitted_window';

  const events = await LoginEvent.find(filter)
    .sort({ timestamp: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await LoginEvent.countDocuments(filter);

  res.json({
    success: true,
    data: events,
    total,
    page: Number(page),
    limit: Number(limit),
  });
};

module.exports = { listLoginEvents };
