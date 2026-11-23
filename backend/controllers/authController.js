const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LoginEvent = require('../models/LoginEvent');
const Baseline = require('../models/Baseline');
const Session = require('../models/Session');
const { scoreLogin } = require('../services/mlClient');
const { raiseAlertIfNeeded } = require('../services/alertService');
const { emitLoginEvent, emitDashboardRefresh } = require('../services/socketService');
const { logAudit } = require('../utils/auditLogger');
const { resolveLocation } = require('../services/geoService');
const {
  getPolicy,
  getCompanyCurrentTime,
  evaluateLoginTimePolicy,
  evaluateLoginLocationPolicy,
  format12Hour,
} = require('../services/policyService');

const FAILED_WINDOW_MS = 5 * 60 * 1000; // 5 minutes rolling window
const MAX_FAILED_ATTEMPTS = 10; // Rate limit threshold

const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, username: user.username, employeeId: user.employeeId },
    process.env.JWT_SECRET || 'sentinel_secret_key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

/**
 * Extracts client telemetry incorporating real IP geolocation and demo simulation overrides.
 */
const parseTelemetry = async (req) => {
  const geo = await resolveLocation(req);
  const userAgent = req.headers['user-agent'] || 'Unknown User-Agent';
  const customDevice = req.headers['x-simulated-device'];
  const customTime = req.headers['x-simulated-time']; // e.g. "09:00:00", "11:00:00", "10:15:00"

  let browser = 'Chrome';
  if (/Firefox/i.test(userAgent)) browser = 'Firefox';
  else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) browser = 'Safari';
  else if (/Edge/i.test(userAgent)) browser = 'Edge';

  let os = 'Windows 11';
  if (/Mac/i.test(userAgent)) os = 'macOS';
  else if (/Linux/i.test(userAgent)) os = 'Linux';
  else if (/Android/i.test(userAgent)) os = 'Android';
  else if (/iPhone|iPad/i.test(userAgent)) os = 'iOS';

  const device = customDevice || `${browser} on ${os}`;

  return {
    ipAddress: geo.ipAddress,
    country: geo.country,
    state: geo.state,
    city: geo.city,
    latitude: geo.latitude,
    longitude: geo.longitude,
    locationNote: geo.note,
    device,
    os,
    browser,
    userAgent,
    customTime,
  };
};

// POST /api/auth/login
const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const policy = await getPolicy();
  const telemetry = await parseTelemetry(req);

  // Time calculation in company timezone: Asia/Kolkata
  const companyTime = getCompanyCurrentTime(new Date(), policy.timezone);
  const effectiveTime = telemetry.customTime || companyTime.timeStr;
  const effectiveDate = companyTime.dateStr;
  const eventTimestamp = new Date();

  const fiveMinAgo = new Date(Date.now() - FAILED_WINDOW_MS);

  // Check rolling failed attempts in last 5 minutes
  const recentFailuresCount = await LoginEvent.countDocuments({
    username: username.trim().toLowerCase(),
    loginStatus: 'failed',
    timestamp: { $gte: fiveMinAgo },
  });

  const isAfterFailures = recentFailuresCount >= 2;

  // Rate limit check
  if (recentFailuresCount >= MAX_FAILED_ATTEMPTS) {
    const eventId = `EVT-${uuidv4()}`;
    const rateLimitEvent = await LoginEvent.create({
      eventId,
      username: username.trim().toLowerCase(),
      date: effectiveDate,
      time: effectiveTime,
      timestamp: eventTimestamp,
      ipAddress: telemetry.ipAddress,
      country: telemetry.country,
      state: telemetry.state,
      city: telemetry.city,
      device: telemetry.device,
      os: telemetry.os,
      browser: telemetry.browser,
      userAgent: telemetry.userAgent,
      loginStatus: 'failed',
      failureReasonCategory: 'RATE_LIMITED',
      failedAttemptsInWindow: recentFailuresCount,
      riskScore: 85,
      riskLevel: 'CRITICAL',
      isSuspicious: true,
      reasons: [`Account rate-limited: exceeded ${MAX_FAILED_ATTEMPTS} failed attempts within 5 minutes`],
      detectionSource: 'rate_limiter',
    });

    emitLoginEvent(rateLimitEvent);
    emitDashboardRefresh();

    const existingUser = await User.findOne({ username: username.trim().toLowerCase() });
    await raiseAlertIfNeeded({
      user: existingUser || { username: username.trim().toLowerCase() },
      sourceEventType: 'login',
      sourceEventId: rateLimitEvent._id,
      scoreResult: {
        riskScore: 85,
        riskLevel: 'CRITICAL',
        reasons: [`Account rate-limited: exceeded ${MAX_FAILED_ATTEMPTS} failed attempts within 5 minutes`],
        recommendedAction: 'Enforce temporary account lockout and verify IP provenance.',
      },
      ipAddress: telemetry.ipAddress,
      location: `${telemetry.city}, ${telemetry.state}, ${telemetry.country}`,
      device: telemetry.device,
      time: effectiveTime,
      type: 'brute_force',
      eventId,
    });

    return res.status(429).json({
      success: false,
      message: 'Too many failed login attempts. Account temporarily locked for 5 minutes.',
    });
  }

  // Look up user
  const user = await User.findOne({ username: username.trim().toLowerCase() }).select('+password');

  // Case 1: Non-existent user
  if (!user) {
    const eventId = `EVT-${uuidv4()}`;
    const scoreResult = await scoreLogin({
      event: {
        username: username.trim().toLowerCase(),
        date: effectiveDate,
        time: effectiveTime,
        country: telemetry.country,
        state: telemetry.state,
        city: telemetry.city,
        ipAddress: telemetry.ipAddress,
        device: telemetry.device,
        loginStatus: 'failed',
        failedAttemptsInWindow: recentFailuresCount + 1,
      },
      baseline: null,
    });

    const failedEvent = await LoginEvent.create({
      eventId,
      userId: null,
      username: username.trim().toLowerCase(),
      userRole: 'unknown',
      date: effectiveDate,
      time: effectiveTime,
      timestamp: eventTimestamp,
      ipAddress: telemetry.ipAddress,
      country: telemetry.country,
      state: telemetry.state,
      city: telemetry.city,
      device: telemetry.device,
      os: telemetry.os,
      browser: telemetry.browser,
      userAgent: telemetry.userAgent,
      loginStatus: 'failed',
      failureReasonCategory: 'USER_NOT_FOUND',
      failedAttemptsInWindow: recentFailuresCount + 1,
      riskScore: scoreResult.riskScore,
      riskLevel: scoreResult.riskLevel,
      isSuspicious: scoreResult.isSuspicious,
      reasons: ['User account does not exist in company directory', ...scoreResult.reasons],
      mlScores: {
        isolationForestAnomaly: scoreResult.mlAnomalyFraction || 0,
        randomForestSuspiciousProb: scoreResult.mlSuspiciousProb || 0,
        modelUsed: scoreResult.modelUsed || 'Ensemble',
      },
      detectionSource: 'real_time_authentication',
    });

    emitLoginEvent(failedEvent);
    emitDashboardRefresh();

    if (scoreResult.riskLevel === 'HIGH' || scoreResult.riskLevel === 'CRITICAL') {
      await raiseAlertIfNeeded({
        user: { username: username.trim().toLowerCase() },
        sourceEventType: 'login',
        sourceEventId: failedEvent._id,
        scoreResult: {
          ...scoreResult,
          reasons: ['Invalid user account targeted repeatedly', ...scoreResult.reasons],
        },
        ipAddress: telemetry.ipAddress,
        location: `${telemetry.city}, ${telemetry.state}, ${telemetry.country}`,
        device: telemetry.device,
        time: effectiveTime,
        type: 'brute_force',
        eventId,
      });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  // Case 2: Inactive or Disabled Employee Account
  if (user.status !== 'active') {
    const eventId = `EVT-${uuidv4()}`;
    const disabledEvent = await LoginEvent.create({
      eventId,
      userId: user._id,
      employeeId: user.employeeId,
      employeeName: user.fullName,
      username: user.username,
      userRole: user.role,
      date: effectiveDate,
      time: effectiveTime,
      timestamp: eventTimestamp,
      ipAddress: telemetry.ipAddress,
      country: telemetry.country,
      state: telemetry.state,
      city: telemetry.city,
      device: telemetry.device,
      os: telemetry.os,
      browser: telemetry.browser,
      userAgent: telemetry.userAgent,
      loginStatus: 'failed',
      failureReasonCategory: 'ACCOUNT_DISABLED',
      failedAttemptsInWindow: recentFailuresCount + 1,
      riskScore: 70,
      riskLevel: 'HIGH',
      isSuspicious: true,
      reasons: [`Deactivated account attempted login: ${user.fullName} (${user.employeeId})`],
      detectionSource: 'policy_engine',
    });

    emitLoginEvent(disabledEvent);
    emitDashboardRefresh();

    await raiseAlertIfNeeded({
      user,
      sourceEventType: 'login',
      sourceEventId: disabledEvent._id,
      scoreResult: {
        riskScore: 70,
        riskLevel: 'HIGH',
        reasons: [`Deactivated account attempted login: ${user.fullName} (${user.employeeId})`],
        recommendedAction: 'Verify why a former or suspended employee is attempting authentication.',
      },
      ipAddress: telemetry.ipAddress,
      location: `${telemetry.city}, ${telemetry.state}, ${telemetry.country}`,
      device: telemetry.device,
      time: effectiveTime,
      type: 'account_takeover',
      eventId,
    });

    return res.status(403).json({
      success: false,
      message: 'Account is deactivated. Please contact your Security Administrator.',
    });
  }

  // Fetch user baseline if available
  const baseline = await Baseline.findOne({ userId: user._id });

  // Evaluate Company Policy: Working Hours & Permitted Login Window (10:00 AM - 10:30 AM IST)
  const timePolicy = evaluateLoginTimePolicy({
    timeStr: effectiveTime,
    role: user.role,
    policy,
  });

  // Evaluate Company Policy: Location Restriction (Bengaluru, Karnataka, India)
  const locationPolicy = evaluateLoginLocationPolicy({
    location: {
      city: telemetry.city,
      state: telemetry.state,
      country: telemetry.country,
    },
    role: user.role,
    policy,
  });

  // Case 3: Incorrect Password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const eventId = `EVT-${uuidv4()}`;

    // ML & Baseline scoring
    const mlScore = await scoreLogin({
      event: {
        username: user.username,
        date: effectiveDate,
        time: effectiveTime,
        country: telemetry.country,
        state: telemetry.state,
        city: telemetry.city,
        ipAddress: telemetry.ipAddress,
        device: telemetry.device,
        loginStatus: 'failed',
        failedAttemptsInWindow: recentFailuresCount + 1,
      },
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

    // Composite risk scoring incorporating company policies
    let combinedScore = 15; // Baseline penalty for bad password
    const policyReasons = [];

    if (recentFailuresCount >= 3) {
      combinedScore += Math.min(35, recentFailuresCount * 8);
      policyReasons.push(`Rapid consecutive failed attempts (${recentFailuresCount + 1} attempts)`);
    }

    if (timePolicy.isViolated) {
      combinedScore += timePolicy.scoreAdjustment;
      policyReasons.push(timePolicy.reason);
    }

    if (locationPolicy.isViolated) {
      combinedScore += locationPolicy.scoreAdjustment;
      policyReasons.push(locationPolicy.reason);
    }

    // Blend with ML score
    const finalRiskScore = Math.min(100, Math.max(combinedScore, mlScore.riskScore));
    const finalRiskLevel =
      finalRiskScore >= 80 ? 'CRITICAL' : finalRiskScore >= 50 ? 'HIGH' : finalRiskScore >= 30 ? 'MEDIUM' : 'LOW';
    const isSuspicious = finalRiskScore >= 50;

    const allReasons = [
      'Incorrect password submitted',
      ...policyReasons,
      ...(mlScore.reasons || []).filter((r) => !r.includes('established baseline') && !r.includes('failure')),
    ];

    const failedEvent = await LoginEvent.create({
      eventId,
      userId: user._id,
      employeeId: user.employeeId,
      employeeName: user.fullName,
      username: user.username,
      userRole: user.role,
      date: effectiveDate,
      time: effectiveTime,
      timestamp: eventTimestamp,
      ipAddress: telemetry.ipAddress,
      country: telemetry.country,
      state: telemetry.state,
      city: telemetry.city,
      device: telemetry.device,
      os: telemetry.os,
      browser: telemetry.browser,
      userAgent: telemetry.userAgent,
      loginStatus: 'failed',
      failureReasonCategory: 'INVALID_PASSWORD',
      failedAttemptsInWindow: recentFailuresCount + 1,
      previousLoginAt: user.lastLoginAt,
      expectedLocation: locationPolicy.expectedLocation,
      detectedLocation: locationPolicy.detectedLocation,
      locationStatus: locationPolicy.status,
      isLocationUnauthorized: locationPolicy.isViolated,
      expectedTimeWindow: timePolicy.expectedWindowDisplay,
      actualLoginTime: timePolicy.actualTimeDisplay,
      timePolicyStatus: timePolicy.status,
      isTimeUnauthorized: timePolicy.isViolated,
      riskScore: finalRiskScore,
      riskLevel: finalRiskLevel,
      isSuspicious,
      reasons: allReasons,
      mlScores: {
        isolationForestAnomaly: mlScore.mlAnomalyFraction || 0,
        randomForestSuspiciousProb: mlScore.mlSuspiciousProb || 0,
        modelUsed: mlScore.modelUsed || 'Ensemble',
      },
      detectionSource: policyReasons.length ? 'Rule & ML Ensemble' : 'real_time_authentication',
    });

    emitLoginEvent(failedEvent);
    emitDashboardRefresh();

    // Trigger alert if failed attempt carried severe policy violations
    if (finalRiskLevel === 'HIGH' || finalRiskLevel === 'CRITICAL') {
      let alertType = 'brute_force';
      if (locationPolicy.isViolated) {
        alertType = 'unauthorized_location';
      } else if (timePolicy.isViolated) {
        alertType = 'outside_working_hours';
      }

      await raiseAlertIfNeeded({
        user,
        sourceEventType: 'login',
        sourceEventId: failedEvent._id,
        scoreResult: {
          riskScore: finalRiskScore,
          riskLevel: finalRiskLevel,
          reasons: allReasons,
          recommendedAction: locationPolicy.isViolated
            ? 'Verify employee location and check for credential stuffing from remote IP.'
            : 'Check if employee requires assistance or if password spraying is occurring.',
        },
        ipAddress: telemetry.ipAddress,
        location: `${telemetry.city}, ${telemetry.state}, ${telemetry.country}`,
        device: telemetry.device,
        time: effectiveTime,
        type: alertType,
        eventId,
        expectedLocation: locationPolicy.expectedLocation,
        detectedLocation: locationPolicy.detectedLocation,
        expectedTimeWindow: timePolicy.expectedWindowDisplay,
        actualTime: timePolicy.actualTimeDisplay,
      });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  // Case 4: Successful Authentication
  const eventId = `EVT-${uuidv4()}`;
  const sessionId = uuidv4();

  // ML inference
  const mlScore = await scoreLogin({
    event: {
      username: user.username,
      date: effectiveDate,
      time: effectiveTime,
      country: telemetry.country,
      state: telemetry.state,
      city: telemetry.city,
      ipAddress: telemetry.ipAddress,
      device: telemetry.device,
      loginStatus: 'success',
      failedAttemptsInWindow: recentFailuresCount,
      isAfterFailures,
    },
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

  // Calculate composite risk score combining policy restrictions and ML models
  let baseScore = 0;
  const policyReasons = [];

  if (timePolicy.isViolated) {
    baseScore += timePolicy.scoreAdjustment;
    policyReasons.push(timePolicy.reason);
  }

  if (locationPolicy.isViolated) {
    baseScore += locationPolicy.scoreAdjustment;
    policyReasons.push(locationPolicy.reason);
  }

  if (isAfterFailures) {
    baseScore += 45;
    policyReasons.push('Account Takeover (ATO) indicator: successful login immediately following multiple failures');
  }

  const knownDevice = baseline?.normalDevices?.includes(telemetry.device) || false;
  const knownIp = baseline?.normalIpAddresses?.includes(telemetry.ipAddress) || false;

  if (!knownDevice && baseline?.normalDevices?.length) {
    baseScore += 15;
    policyReasons.push(`Login from unrecognized device: ${telemetry.device}`);
  }

  const finalRiskScore = Math.min(100, Math.max(baseScore, mlScore.riskScore));
  const finalRiskLevel =
    finalRiskScore >= 80 ? 'CRITICAL' : finalRiskScore >= 50 ? 'HIGH' : finalRiskScore >= 30 ? 'MEDIUM' : 'LOW';
  const isSuspicious = finalRiskScore >= 50;

  const allReasons = policyReasons.length
    ? policyReasons
    : mlScore.reasons || ['Normal employee login within authorized window and location'];

  const loginEvent = await LoginEvent.create({
    eventId,
    userId: user._id,
    employeeId: user.employeeId,
    employeeName: user.fullName,
    username: user.username,
    userRole: user.role,
    date: effectiveDate,
    time: effectiveTime,
    timestamp: eventTimestamp,
    ipAddress: telemetry.ipAddress,
    country: telemetry.country,
    state: telemetry.state,
    city: telemetry.city,
    device: telemetry.device,
    os: telemetry.os,
    browser: telemetry.browser,
    userAgent: telemetry.userAgent,
    sessionId,
    loginStatus: 'success',
    failedAttemptsInWindow: recentFailuresCount,
    isAfterFailures,
    previousLoginAt: user.lastLoginAt,
    knownDevice,
    knownIp,
    expectedLocation: locationPolicy.expectedLocation,
    detectedLocation: locationPolicy.detectedLocation,
    locationStatus: locationPolicy.status,
    isLocationUnauthorized: locationPolicy.isViolated,
    expectedTimeWindow: timePolicy.expectedWindowDisplay,
    actualLoginTime: timePolicy.actualTimeDisplay,
    timePolicyStatus: timePolicy.status,
    isTimeUnauthorized: timePolicy.isViolated,
    riskScore: finalRiskScore,
    riskLevel: finalRiskLevel,
    isSuspicious,
    reasons: allReasons,
    mlScores: {
      isolationForestAnomaly: mlScore.mlAnomalyFraction || 0,
      randomForestSuspiciousProb: mlScore.mlSuspiciousProb || 0,
      modelUsed: mlScore.modelUsed || 'Ensemble',
    },
    detectionSource: policyReasons.length ? 'Company Policy & ML Ensemble' : 'real_time_authentication',
  });

  // Create active session record
  const sessionExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await Session.create({
    sessionId,
    userId: user._id,
    username: user.username,
    ipAddress: telemetry.ipAddress,
    device: telemetry.device,
    os: telemetry.os,
    browser: telemetry.browser,
    userAgent: telemetry.userAgent,
    expiresAt: sessionExpiresAt,
    status: 'active',
  });

  user.lastLoginAt = eventTimestamp;
  if (finalRiskLevel === 'HIGH' || finalRiskLevel === 'CRITICAL') {
    user.riskLevel = finalRiskLevel;
  }
  await user.save();

  emitLoginEvent(loginEvent);
  emitDashboardRefresh();

  // Raise Security Incident Alert if HIGH or CRITICAL
  let alert = null;
  if (finalRiskLevel === 'HIGH' || finalRiskLevel === 'CRITICAL') {
    let alertType = 'account_takeover';
    let recommendedAction = 'Investigate login anomaly, confirm with employee, and revoke session if unverified.';

    if (locationPolicy.isViolated) {
      alertType = 'unauthorized_location';
      recommendedAction = `Immediate investigation required. Verify employee identity. Login was detected outside authorized location (${policy.authorizedLocation.city}, ${policy.authorizedLocation.country}). Consider suspending session until confirmed.`;
    } else if (timePolicy.isViolated) {
      alertType = 'outside_working_hours';
      recommendedAction = `Employee logged in outside permitted window (${timePolicy.expectedWindowDisplay} IST). Contact user to verify reason for off-hours login.`;
    } else if (isAfterFailures) {
      alertType = 'account_takeover';
      recommendedAction = 'Account Takeover suspected: Login success immediately following multiple failures. Force credential reset.';
    }

    alert = await raiseAlertIfNeeded({
      user,
      sourceEventType: 'login',
      sourceEventId: loginEvent._id,
      scoreResult: {
        riskScore: finalRiskScore,
        riskLevel: finalRiskLevel,
        reasons: allReasons,
        recommendedAction,
        detectionSource: policyReasons.length ? 'Company Policy Rule & ML Ensemble' : 'ML Isolation/Random Forest',
      },
      ipAddress: telemetry.ipAddress,
      location: `${telemetry.city}, ${telemetry.state}, ${telemetry.country}`,
      device: telemetry.device,
      time: effectiveTime,
      type: alertType,
      eventId,
      expectedLocation: locationPolicy.expectedLocation,
      detectedLocation: locationPolicy.detectedLocation,
      expectedTimeWindow: timePolicy.expectedWindowDisplay,
      actualTime: timePolicy.actualTimeDisplay,
    });
  }

  await logAudit({
    actor: user.username,
    action: user.role === 'admin' || user.role === 'manager' ? 'MANAGER_LOGIN' : 'EMPLOYEE_LOGIN',
    targetType: 'User',
    targetId: user._id.toString(),
    ipAddress: telemetry.ipAddress,
    details: {
      riskScore: finalRiskScore,
      riskLevel: finalRiskLevel,
      timePolicyStatus: timePolicy.status,
      locationStatus: locationPolicy.status,
    },
  });

  const token = signToken(user);

  res.json({
    success: true,
    token,
    sessionId,
    user: {
      id: user._id,
      employeeId: user.employeeId,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department,
      jobTitle: user.jobTitle,
      assignedLocation: user.assignedLocation,
      riskLevel: user.riskLevel,
    },
    policyCheck: {
      time: timePolicy,
      location: locationPolicy,
    },
    event: {
      eventId: loginEvent.eventId,
      riskScore: loginEvent.riskScore,
      riskLevel: loginEvent.riskLevel,
      isSuspicious: loginEvent.isSuspicious,
      reasons: loginEvent.reasons,
      expectedTimeWindow: loginEvent.expectedTimeWindow,
      actualLoginTime: loginEvent.actualLoginTime,
      expectedLocation: loginEvent.expectedLocation,
      detectedLocation: loginEvent.detectedLocation,
    },
    alertRaised: !!alert,
  });
};

// POST /api/auth/register
const register = async (req, res) => {
  const { username, password, fullName, email, department, jobTitle, assignedLocation, role } = req.body;
  if (!username || !password || !fullName) {
    return res.status(400).json({ success: false, message: 'Username, password, and fullName are required' });
  }

  const existing = await User.findOne({ username: username.trim().toLowerCase() });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Username already taken' });
  }

  const employeeId = `EMP-${Date.now().toString().slice(-4)}`;
  const user = await User.create({
    employeeId,
    username: username.trim().toLowerCase(),
    fullName: fullName.trim(),
    email: email ? email.trim().toLowerCase() : `${username.trim().toLowerCase()}@company.com`,
    password,
    department: department || 'Engineering',
    jobTitle: jobTitle || 'Staff Member',
    assignedLocation: assignedLocation || 'Bengaluru, Karnataka, India',
    role: role && ['admin', 'manager', 'employee'].includes(role) ? role : 'employee',
    status: 'active',
    riskLevel: 'LOW',
  });

  // Create initial normal baseline for new demo employee
  await Baseline.create({
    userId: user._id,
    normalCountries: ['India'],
    normalStates: ['Karnataka'],
    normalCities: ['Bengaluru'],
    normalDevices: ['Chrome on Windows 11'],
    normalIpAddresses: ['103.21.58.178'],
    typicalLoginHourStart: 10,
    typicalLoginHourEnd: 17,
    avgFilesAccessedPerDay: 3,
    maxFilesAccessedPerDay: 10,
    avgConfidentialFilesPerDay: 1,
    lastRecalculatedAt: new Date(),
  });

  emitDashboardRefresh();

  await logAudit({
    actor: req.user?.username || 'system',
    action: 'REGISTER_USER',
    targetType: 'User',
    targetId: user._id.toString(),
    ipAddress: req.ip,
  });

  res.status(201).json({
    success: true,
    message: 'Employee account registered successfully',
    user: {
      id: user._id,
      employeeId: user.employeeId,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      department: user.department,
      role: user.role,
      assignedLocation: user.assignedLocation,
    },
  });
};

// POST /api/auth/logout
const logout = async (req, res) => {
  const { sessionId } = req.body;
  const user = req.user;

  if (sessionId) {
    await Session.findOneAndUpdate({ sessionId }, { status: 'revoked' });
  } else if (user) {
    await Session.updateMany({ userId: user._id, status: 'active' }, { status: 'revoked' });
  }

  if (user) {
    const policy = await getPolicy();
    const companyTime = getCompanyCurrentTime(new Date(), policy.timezone);
    const telemetry = await parseTelemetry(req);

    await LoginEvent.create({
      eventId: `EVT-${uuidv4()}`,
      userId: user._id,
      employeeId: user.employeeId,
      employeeName: user.fullName,
      username: user.username,
      userRole: user.role,
      date: companyTime.dateStr,
      time: companyTime.timeStr,
      timestamp: new Date(),
      ipAddress: telemetry.ipAddress,
      country: telemetry.country,
      state: telemetry.state,
      city: telemetry.city,
      device: telemetry.device,
      os: telemetry.os,
      browser: telemetry.browser,
      sessionId: sessionId || null,
      eventType: 'logout',
      loginStatus: 'success',
      riskScore: 0,
      riskLevel: 'LOW',
      isSuspicious: false,
      reasons: ['User logged out securely'],
      detectionSource: 'real_time_authentication',
    });
  }

  emitDashboardRefresh();
  res.json({ success: true, message: 'Logged out successfully' });
};

// GET /api/auth/sessions
const getActiveSessions = async (req, res) => {
  const sessions = await Session.find({
    status: 'active',
    expiresAt: { $gte: new Date() },
  })
    .sort({ lastActiveAt: -1 })
    .limit(50);

  const count = await Session.countDocuments({
    status: 'active',
    expiresAt: { $gte: new Date() },
  });

  res.json({ success: true, count, data: sessions });
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

module.exports = { login, register, logout, getActiveSessions, getMe };
