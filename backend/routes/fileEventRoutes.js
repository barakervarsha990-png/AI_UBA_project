const express = require('express');
const { body, param } = require('express-validator');
const {
  listFileEvents,
  deleteFileEvent,
  deleteManyFileEvents,
  clearSimulatedFileEvents,
} = require('../controllers/fileEventController');
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(protect);

router.get('/', listFileEvents);

router.post(
  '/delete-many',
  adminOnly,
  [body('ids').isArray({ min: 1, max: 500 }), body('ids.*').isMongoId()],
  validate,
  deleteManyFileEvents
);

router.post('/clear-simulated', adminOnly, clearSimulatedFileEvents);

router.delete('/:id', adminOnly, [param('id').isMongoId()], validate, deleteFileEvent);

module.exports = router;