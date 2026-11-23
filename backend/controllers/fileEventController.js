const FileEvent = require('../models/FileEvent');
const { logAudit } = require('../utils/auditLogger');

// Express 4 does not catch rejected promises, so every handler is wrapped.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/file-events?suspicious=true&limit=50
const listFileEvents = wrap(async (req, res) => {
  const { suspicious, userId, limit = 100, page = 1 } = req.query;
  const filter = {};
  if (suspicious === 'true') filter.isSuspicious = true;
  if (userId) filter.userId = userId;

  const events = await FileEvent.find(filter)
    .sort({ timestamp: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await FileEvent.countDocuments(filter);

  res.json({ success: true, data: events, total, page: Number(page), limit: Number(limit) });
});

// DELETE /api/file-events/:id
const deleteFileEvent = wrap(async (req, res) => {
  const deleted = await FileEvent.findByIdAndDelete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'File event not found' });
  }

  await logAudit({
    actor: req.user.username,
    action: 'DELETE_FILE_EVENT',
    targetType: 'FileEvent',
    targetId: req.params.id,
    ipAddress: req.ip,
    details: { fileName: deleted.fileName, username: deleted.username },
  });

  res.json({ success: true, deletedCount: 1 });
});

// POST /api/file-events/delete-many   body: { ids: [...] }
const deleteManyFileEvents = wrap(async (req, res) => {
  const { ids } = req.body;
  const result = await FileEvent.deleteMany({ _id: { $in: ids } });

  await logAudit({
    actor: req.user.username,
    action: 'DELETE_FILE_EVENTS',
    targetType: 'FileEvent',
    ipAddress: req.ip,
    details: { requested: ids.length, deletedCount: result.deletedCount, ids: ids.slice(0, 20) },
  });

  res.json({ success: true, deletedCount: result.deletedCount });
});

// POST /api/file-events/clear-simulated  (removes only events made by the demo buttons)
const clearSimulatedFileEvents = wrap(async (req, res) => {
  const result = await FileEvent.deleteMany({ simulated: true });

  await logAudit({
    actor: req.user.username,
    action: 'CLEAR_SIMULATED_FILE_EVENTS',
    targetType: 'FileEvent',
    ipAddress: req.ip,
    details: { deletedCount: result.deletedCount },
  });

  res.json({ success: true, deletedCount: result.deletedCount });
});

module.exports = { listFileEvents, deleteFileEvent, deleteManyFileEvents, clearSimulatedFileEvents };