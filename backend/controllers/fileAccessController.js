const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileEvent = require('../models/FileEvent');
const Baseline = require('../models/Baseline');
const { scoreFile } = require('../services/mlClient');
const { raiseAlertIfNeeded } = require('../services/alertService');
const { emitFileEvent, emitDashboardRefresh } = require('../services/socketService');
const { logAudit } = require('../utils/auditLogger');
const { resolveLocation } = require('../services/geoService');
const { getPolicy, getCompanyCurrentTime } = require('../services/policyService');

const CONTROLLED_DIR = path.join(__dirname, '..', 'controlled_files');

const FILE_CATALOG = [
  {
    fileName: 'company_policy_handbook.txt',
    fileType: 'txt',
    sensitivityLevel: 'public',
    description: 'General employee code of conduct and office policies.',
    restrictedRole: null,
  },
  {
    fileName: 'weekly_status_report.docx',
    fileType: 'docx',
    sensitivityLevel: 'internal',
    description: 'Weekly team deliverables and progress notes.',
    restrictedRole: null,
  },
  {
    fileName: 'project_plan.xlsx',
    fileType: 'xlsx',
    sensitivityLevel: 'internal',
    description: 'Departmental roadmap and sprint milestone allocations.',
    restrictedRole: null,
  },
  {
    fileName: 'customer_database.csv',
    fileType: 'csv',
    sensitivityLevel: 'confidential',
    description: 'Enterprise client contact directory and contract values.',
    restrictedRole: null,
  },
  {
    fileName: 'salary_data.xlsx',
    fileType: 'xlsx',
    sensitivityLevel: 'confidential',
    description: 'Executive salary compensation bands and bonus structures.',
    restrictedRole: null,
  },
  {
    fileName: 'employee_credentials.csv',
    fileType: 'csv',
    sensitivityLevel: 'restricted',
    description: 'System credentials archive and privileged directory.',
    restrictedRole: null,
  },
];

// GET /api/files/catalog
const getCatalog = (req, res) => {
  res.json({
    success: true,
    data: FILE_CATALOG.map((f) => {
      const filePath = path.join(CONTROLLED_DIR, f.fileName);
      let sizeBytes = 0;
      if (fs.existsSync(filePath)) {
        sizeBytes = fs.statSync(filePath).size;
      }
      return { ...f, sizeBytes };
    }),
  });
};

/**
 * Audits, scores, and enforces insider-threat detection rules on file operations.
 */
const processFileAccess = async (req, fileName, action = 'view') => {
  const user = req.user;
  const safeName = path.basename(fileName);
  const catalogItem = FILE_CATALOG.find((c) => c.fileName === safeName);
  if (!catalogItem) {
    throw new Error('Requested file is not in authorized company catalog');
  }

  const filePath = path.join(CONTROLLED_DIR, safeName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${safeName} not found in secure storage`);
  }

  const policy = await getPolicy();
  const companyTime = getCompanyCurrentTime(new Date(), policy.timezone);
  const now = new Date();

  // 1. Sliding window file access calculations (5-minute rolling window)
  const windowMinutes = policy.fileWindowMinutes || 5;
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const [recentWindowEvents, filesTodayCount, confTodayCount] = await Promise.all([
    FileEvent.find({
      userId: user._id,
      timestamp: { $gte: windowStart },
    }).sort({ timestamp: -1 }),
    FileEvent.countDocuments({
      userId: user._id,
      date: companyTime.dateStr,
    }),
    FileEvent.countDocuments({
      userId: user._id,
      date: companyTime.dateStr,
      sensitivityLevel: { $in: ['confidential', 'restricted'] },
    }),
  ]);

  const filesInWindow = recentWindowEvents.length + 1; // Including current operation
  const confFilesInWindow =
    recentWindowEvents.filter((e) => ['confidential', 'restricted'].includes(e.sensitivityLevel)).length +
    (['confidential', 'restricted'].includes(catalogItem.sensitivityLevel) ? 1 : 0);

  const distinctFilesInWindow = new Set([
    ...recentWindowEvents.map((e) => e.fileName),
    catalogItem.fileName,
  ]);

  const isBulkActivity = filesInWindow > policy.maxFilesPerWindow; // > 10 files in 5 minutes

  // 2. Resolve client telemetry
  const geo = await resolveLocation(req);
  const location = `${geo.city || 'Bengaluru'}, ${geo.state || 'Karnataka'}, ${geo.country || 'India'}`;
  const customDevice = req.headers['x-simulated-device'];
  const device = customDevice || req.headers['user-agent'] || 'Employee Workstation';
  const sessionId = req.headers['x-session-id'] || null;

  // 3. Baseline & ML scoring
  const baseline = await Baseline.findOne({ userId: user._id });
  const mlScore = await scoreFile({
    event: {
      fileName: catalogItem.fileName,
      fileType: catalogItem.fileType,
      sensitivityLevel: catalogItem.sensitivityLevel,
      action,
    },
    baseline: baseline
      ? {
          avgFilesAccessedPerDay: baseline.avgFilesAccessedPerDay,
          maxFilesAccessedPerDay: baseline.maxFilesAccessedPerDay,
          avgConfidentialFilesPerDay: baseline.avgConfidentialFilesPerDay,
        }
      : null,
    todayStats: {
      totalFilesToday: filesTodayCount + 1,
      confidentialFilesToday: confTodayCount + (['confidential', 'restricted'].includes(catalogItem.sensitivityLevel) ? 1 : 0),
    },
  });

  // 4. Rule-based risk scoring incorporating mass downloads and restricted data
  let ruleScore = 0;
  const detectionReasons = [];

  // A: Mass / Bulk download detection (> 10 files in 5 minutes)
  if (isBulkActivity) {
    ruleScore += 65;
    detectionReasons.push(
      `Unusual bulk file activity detected: ${filesInWindow} files accessed/downloaded within ${windowMinutes} minutes (Threshold: ${policy.maxFilesPerWindow})`
    );
  }

  // B: Repeated confidential/restricted files in short window
  if (confFilesInWindow >= 3) {
    ruleScore += 45;
    detectionReasons.push(
      `Multiple confidential or restricted documents accessed within ${windowMinutes} minutes (${confFilesInWindow} sensitive files)`
    );
  } else if (['confidential', 'restricted'].includes(catalogItem.sensitivityLevel)) {
    // Single confidential access: moderate bump (25), NOT alone a critical alert
    ruleScore += 25;
    detectionReasons.push(`Access to ${catalogItem.sensitivityLevel.toUpperCase()} classified document: ${catalogItem.fileName}`);
  }

  // C: Action severity (bulk download / export / delete)
  if (action === 'download' || action === 'export') {
    if (isBulkActivity) ruleScore += 15;
  } else if (action === 'delete') {
    ruleScore += 30;
    detectionReasons.push(`High impact file deletion requested: ${catalogItem.fileName}`);
  }

  // Final composite score (0 - 100)
  const finalRiskScore = Math.min(100, Math.max(ruleScore, mlScore.riskScore));
  const finalRiskLevel =
    finalRiskScore >= 80 ? 'CRITICAL' : finalRiskScore >= 50 ? 'HIGH' : finalRiskScore >= 30 ? 'MEDIUM' : 'LOW';
  const isSuspicious = finalRiskScore >= 50;

  const allReasons = detectionReasons.length
    ? detectionReasons
    : mlScore.reasons || ['Normal authorized file access'];

  const eventId = `FEVT-${uuidv4()}`;
  const fileEvent = await FileEvent.create({
    eventId,
    employeeId: user.employeeId || 'EMP-1001',
    employeeName: user.fullName || user.username,
    userId: user._id,
    username: user.username,
    fileName: catalogItem.fileName,
    fileType: catalogItem.fileType,
    sensitivityLevel: catalogItem.sensitivityLevel,
    action,
    date: companyTime.dateStr,
    time: companyTime.timeStr,
    timestamp: now,
    sessionId,
    ipAddress: geo.ipAddress,
    location,
    device,
    filesInWindow,
    isBulkActivity,
    riskScore: finalRiskScore,
    riskLevel: finalRiskLevel,
    isSuspicious,
    reasons: allReasons,
    mlScores: {
      isolationForestAnomaly: mlScore.mlAnomalyFraction || 0,
      randomForestSuspiciousProb: mlScore.mlSuspiciousProb || 0,
      modelUsed: mlScore.modelUsed || 'Ensemble',
    },
    detectionSource: detectionReasons.length ? 'Company Threshold Rule & ML Ensemble' : 'file_monitor',
    simulated: false,
  });

  if (finalRiskLevel === 'HIGH' || finalRiskLevel === 'CRITICAL') {
    user.riskLevel = finalRiskLevel;
    await user.save();
  }

  emitFileEvent(fileEvent);
  emitDashboardRefresh();

  // 5. Generate Manager Security Alert & Email Notification for HIGH/CRITICAL file activity
  let alert = null;
  if (finalRiskLevel === 'HIGH' || finalRiskLevel === 'CRITICAL') {
    const alertType = isBulkActivity ? 'bulk_file_download' : 'insider_threat';
    const recentFileNames = Array.from(distinctFilesInWindow);

    let recommendedAction = isBulkActivity
      ? `Unusual mass file download spike (${filesInWindow} files). Verify business justification with ${user.fullName} and department manager. Restrict download privileges if unauthorized.`
      : `High-risk access to ${catalogItem.sensitivityLevel} documents. Confirm project need with employee.`;

    alert = await raiseAlertIfNeeded({
      user,
      sourceEventType: 'file',
      sourceEventId: fileEvent._id,
      scoreResult: {
        riskScore: finalRiskScore,
        riskLevel: finalRiskLevel,
        reasons: allReasons,
        recommendedAction,
        detectionSource: isBulkActivity ? 'Mass Download Threshold Rule & ML Ensemble' : 'Sensitive Data Access Rule',
      },
      ipAddress: geo.ipAddress,
      location,
      device,
      time: companyTime.timeStr,
      type: alertType,
      eventId,
      fileCount: filesInWindow,
      fileNames: recentFileNames,
    });
  }

  await logAudit({
    actor: user.username,
    action: `FILE_${action.toUpperCase()}`,
    targetType: 'FileEvent',
    targetId: fileEvent._id.toString(),
    ipAddress: geo.ipAddress,
    details: {
      fileName: catalogItem.fileName,
      sensitivity: catalogItem.sensitivityLevel,
      filesInWindow,
      isBulkActivity,
      riskScore: finalRiskScore,
      riskLevel: finalRiskLevel,
    },
  });

  return { catalogItem, filePath, fileEvent, scoreResult: { riskScore: finalRiskScore, riskLevel: finalRiskLevel, reasons: allReasons, isSuspicious }, alert };
};

// GET /api/files/view/:filename
const viewFile = async (req, res) => {
  try {
    const { filename } = req.params;
    const { catalogItem, filePath, fileEvent, scoreResult, alert } = await processFileAccess(req, filename, 'view');
    const content = fs.readFileSync(filePath, 'utf8');

    res.json({
      success: true,
      data: {
        fileName: catalogItem.fileName,
        fileType: catalogItem.fileType,
        sensitivityLevel: catalogItem.sensitivityLevel,
        content,
        riskScore: scoreResult.riskScore,
        riskLevel: scoreResult.riskLevel,
        isSuspicious: scoreResult.isSuspicious,
        reasons: scoreResult.reasons,
        eventId: fileEvent.eventId,
        filesInWindow: fileEvent.filesInWindow,
        isBulkActivity: fileEvent.isBulkActivity,
        alertRaised: !!alert,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/files/download/:filename
const downloadFile = async (req, res) => {
  try {
    const { filename } = req.params;
    const { catalogItem, filePath, fileEvent, scoreResult, alert } = await processFileAccess(req, filename, 'download');
    
    // Set response headers for security audit correlation
    res.setHeader('X-Sentinel-Event-Id', fileEvent.eventId);
    res.setHeader('X-Sentinel-Risk-Score', String(scoreResult.riskScore));
    res.setHeader('X-Sentinel-Alert-Raised', alert ? 'true' : 'false');

    res.download(filePath, catalogItem.fileName);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/files/export/:filename
const exportFile = async (req, res) => {
  try {
    const { filename } = req.params;
    const { catalogItem, filePath, fileEvent, scoreResult, alert } = await processFileAccess(req, filename, 'export');
    res.json({
      success: true,
      message: `File ${catalogItem.fileName} exported successfully`,
      data: {
        fileName: catalogItem.fileName,
        action: 'export',
        riskScore: scoreResult.riskScore,
        riskLevel: scoreResult.riskLevel,
        alertRaised: !!alert,
        eventId: fileEvent.eventId,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { getCatalog, viewFile, downloadFile, exportFile, processFileAccess };
