const User = require('../models/User');
const Baseline = require('../models/Baseline');
const LoginEvent = require('../models/LoginEvent');
const FileEvent = require('../models/FileEvent');
const { scoreLogin, scoreFile } = require('../services/mlClient');
const { raiseAlertIfNeeded } = require('../services/alertService');
const { emitLoginEvent, emitFileEvent, emitDashboardRefresh } = require('../services/socketService');
const { getRandomLocation, getRandomDevice, randomIpFromPrefix } = require('../utils/sampleGeoData');
const { logAudit } = require('../utils/auditLogger');

const pad = (n) => String(n).padStart(2, '0');

const nowDateTime = () => {
  const d = new Date();
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return { d, date, time };
};

const CONFIDENTIAL_FILES = [
  { fileName: 'employee_credentials.csv', fileType: 'csv', sensitivityLevel: 'restricted' },
  { fileName: 'customer_database.csv', fileType: 'csv', sensitivityLevel: 'confidential' },
  { fileName: 'salary_data.xlsx', fileType: 'xlsx', sensitivityLevel: 'confidential' },
  { fileName: 'source_code_backup.zip', fileType: 'zip', sensitivityLevel: 'restricted' },
  { fileName: 'merger_agreement.pdf', fileType: 'pdf', sensitivityLevel: 'restricted' },
];

// POST /api/simulate/account-takeover  { userId }
const simulateAccountTakeover = async (req, res) => {
  const { userId } = req.body;
  const user = userId ? await User.findById(userId) : await User.findOne({ role: 'employee' });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const baseline = await Baseline.findOne({ userId: user._id });

  // Force an unusual location/device/IP/time, simulating an account takeover attempt.
  const foreignLocation = getRandomLocation(baseline?.normalCountries?.[0] || 'India');
  const newDevice = getRandomDevice(baseline?.normalDevices?.[0]);
  const ip = randomIpFromPrefix(foreignLocation.ipPrefix);

  const { d, date } = nowDateTime();
  d.setHours(2, 30, 0, 0); // force 2:30 AM to simulate unusual time
  const time = '02:30:00';

  const eventPayload = {
    username: user.username,
    date,
    time,
    country: foreignLocation.country,
    state: foreignLocation.state,
    city: foreignLocation.city,
    ipAddress: ip,
    device: newDevice.device,
    loginStatus: 'success',
  };

  const scoreResult = await scoreLogin({
    event: eventPayload,
    baseline: baseline
      ? {
          normalCountries: baseline.normalCountries,
          normalDevices: baseline.normalDevices,
          normalIpAddresses: baseline.normalIpAddresses,
          typicalLoginHourStart: baseline.typicalLoginHourStart,
          typicalLoginHourEnd: baseline.typicalLoginHourEnd,
        }
      : null,
  });

  const loginEvent = await LoginEvent.create({
    userId: user._id,
    username: user.username,
    date,
    time,
    timestamp: d,
    ipAddress: ip,
    country: foreignLocation.country,
    state: foreignLocation.state,
    city: foreignLocation.city,
    latitude: foreignLocation.latitude,
    longitude: foreignLocation.longitude,
    device: newDevice.device,
    os: newDevice.os,
    browser: newDevice.browser,
    loginStatus: 'success',
    riskScore: scoreResult.riskScore,
    riskLevel: scoreResult.riskLevel,
    isSuspicious: scoreResult.isSuspicious,
    reasons: scoreResult.reasons,
    simulated: true,
  });

  if (scoreResult.riskLevel === 'HIGH' || scoreResult.riskLevel === 'CRITICAL') {
    user.riskLevel = scoreResult.riskLevel;
    await user.save();
  }

  emitLoginEvent(loginEvent);
  emitDashboardRefresh();

  const alert = await raiseAlertIfNeeded({
    user,
    sourceEventType: 'login',
    sourceEventId: loginEvent._id,
    scoreResult,
    ipAddress: ip,
    location: `${foreignLocation.city}, ${foreignLocation.state}, ${foreignLocation.country}`,
    device: newDevice.device,
    time,
    type: 'account_takeover',
  });

  await logAudit({
    actor: req.user.username,
    action: 'SIMULATE_ACCOUNT_TAKEOVER',
    targetType: 'User',
    targetId: user._id.toString(),
    ipAddress: req.ip,
  });

  res.json({ success: true, data: { loginEvent, alert } });
};

// POST /api/simulate/insider-threat  { userId }
const simulateInsiderThreat = async (req, res) => {
  const { userId } = req.body;
  const user = userId ? await User.findById(userId) : await User.findOne({ role: 'employee' });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const baseline = await Baseline.findOne({ userId: user._id });
  const { d, date, time } = nowDateTime();
  const ip = baseline?.normalIpAddresses?.[0] || randomIpFromPrefix('103.21.58');
  const device = baseline?.normalDevices?.[0] || 'Dell Latitude 5420 (Laptop)';
  const location = `${baseline?.normalCities?.[0] || 'Bengaluru'}, ${baseline?.normalStates?.[0] || 'Karnataka'}, ${
    baseline?.normalCountries?.[0] || 'India'
  }`;

  const numEvents = 20 + Math.floor(Math.random() * 11); // 20-30 events
  const createdEvents = [];
  let latestScoreResult = null;

  for (let i = 0; i < numEvents; i++) {
    const file = CONFIDENTIAL_FILES[Math.floor(Math.random() * CONFIDENTIAL_FILES.length)];
    const action = ['view', 'download', 'copy'][Math.floor(Math.random() * 3)];

    const eventTime = new Date(d.getTime() + i * 15000); // spaced 15s apart
    const timeStr = `${String(eventTime.getHours()).padStart(2, '0')}:${String(eventTime.getMinutes()).padStart(
      2,
      '0'
    )}:${String(eventTime.getSeconds()).padStart(2, '0')}`;

    const todayStats = {
      totalFilesToday: (baseline?.avgFilesAccessedPerDay || 3) + i + 1,
      confidentialFilesToday: i + 1,
    };

    const scoreResult = await scoreFile({
      event: { fileName: file.fileName, fileType: file.fileType, sensitivityLevel: file.sensitivityLevel, action },
      baseline: baseline
        ? {
            avgFilesAccessedPerDay: baseline.avgFilesAccessedPerDay,
            maxFilesAccessedPerDay: baseline.maxFilesAccessedPerDay,
            avgConfidentialFilesPerDay: baseline.avgConfidentialFilesPerDay,
          }
        : null,
      todayStats,
    });
    latestScoreResult = scoreResult;

    const fileEvent = await FileEvent.create({
      employeeId: user.employeeId,
      userId: user._id,
      username: user.username,
      fileName: file.fileName,
      fileType: file.fileType,
      sensitivityLevel: file.sensitivityLevel,
      action,
      date,
      time: timeStr,
      timestamp: eventTime,
      ipAddress: ip,
      location,
      device,
      riskScore: scoreResult.riskScore,
      riskLevel: scoreResult.riskLevel,
      isSuspicious: scoreResult.isSuspicious,
      reasons: scoreResult.reasons,
      simulated: true,
    });

    createdEvents.push(fileEvent);
    emitFileEvent(fileEvent);
  }

  if (latestScoreResult && (latestScoreResult.riskLevel === 'HIGH' || latestScoreResult.riskLevel === 'CRITICAL')) {
    user.riskLevel = latestScoreResult.riskLevel;
    await user.save();
  }

  emitDashboardRefresh();

  const alert = await raiseAlertIfNeeded({
    user,
    sourceEventType: 'file',
    sourceEventId: createdEvents[createdEvents.length - 1]._id,
    scoreResult: latestScoreResult,
    ipAddress: ip,
    location,
    device,
    time,
    type: 'insider_threat',
  });

  await logAudit({
    actor: req.user.username,
    action: 'SIMULATE_INSIDER_THREAT',
    targetType: 'User',
    targetId: user._id.toString(),
    ipAddress: req.ip,
  });

  res.json({ success: true, data: { fileEventsCreated: createdEvents.length, alert } });
};

module.exports = { simulateAccountTakeover, simulateInsiderThreat };
