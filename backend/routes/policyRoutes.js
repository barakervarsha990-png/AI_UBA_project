const express = require('express');
const { getPolicy, updatePolicy } = require('../services/policyService');
const { protect, requireManagerOrAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { emitDashboardRefresh } = require('../services/socketService');

const router = express.Router();

router.use(protect);

// GET /api/settings/policy - View current policy
router.get('/', async (req, res) => {
  try {
    const policy = await getPolicy(true);
    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/settings/policy - Manager/Admin update policy
router.put('/', requireManagerOrAdmin, async (req, res) => {
  try {
    const updated = await updatePolicy(req.body);

    emitDashboardRefresh();

    await logAudit({
      actor: req.user?.username || 'admin',
      action: 'UPDATE_COMPANY_POLICY',
      targetType: 'CompanyPolicy',
      ipAddress: req.ip,
      details: req.body,
    });

    res.json({
      success: true,
      message: 'Company login and location policy updated successfully',
      data: updated,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;

