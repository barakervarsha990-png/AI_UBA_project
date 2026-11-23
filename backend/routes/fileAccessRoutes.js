const express = require('express');
const { getCatalog, viewFile, downloadFile, exportFile } = require('../controllers/fileAccessController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/catalog', getCatalog);
router.get('/view/:filename', viewFile);
router.get('/download/:filename', downloadFile);
router.post('/export/:filename', exportFile);

module.exports = router;
