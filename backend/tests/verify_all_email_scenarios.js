/**
 * Real Gmail Verification Test for SENTINEL UBA
 * Tests all 6 requested scenarios with real live delivery to barakervarsha990@gmail.com
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const assert = require('assert');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const connectDB = require('../config/db');
const User = require('../models/User');
const LoginEvent = require('../models/LoginEvent');
const FileEvent = require('../models/FileEvent');
const Alert = require('../models/Alert');
const { getPolicy, evaluateLoginTimePolicy, evaluateLoginLocationPolicy } = require('../services/policyService');
const { raiseAlertIfNeeded } = require('../services/alertService');

const runEmailVerification = async () => {
  console.log('========================================================================');
  console.log('   SENTINEL UBA — LIVE GMAIL NOTIFICATION VERIFICATION SUITE           ');
  console.log('========================================================================\n');

  await connectDB();
  console.log('[SETUP] Connected to MongoDB.');

  const policy = await getPolicy(true);
  console.log(`[SETUP] Active Policy: Login Window ${policy.loginWindowStart}–${policy.loginWindowEnd} IST | Location: ${policy.authorizedLocation.city}, ${policy.authorizedLocation.country}\n`);

  let user = await User.findOne({ username: 'barakervarsha990' }).select('+password');
  if (!user) {
    user = await User.create({
      employeeId: 'EMP-1001',
      username: 'barakervarsha990',
      fullName: 'Varsha Baraker',
      email: 'barakervarsha990@gmail.com',
      password: 'EmployeeDemo123!',
      role: 'employee',
      department: 'Engineering',
      status: 'active',
      riskLevel: 'LOW',
    });
  }

  const results = [];

  // --------------------------------------------------------------------------
  // TEST 1: Normal employee login (10:15 AM from Bengaluru)
  // --------------------------------------------------------------------------
  console.log('------------------------------------------------------------------------');
  console.log('TEST 1: Normal employee login during allowed time (10:15 AM from Bengaluru)...');
  const time1 = evaluateLoginTimePolicy({ timeStr: '10:15:00', role: 'employee', policy });
  const loc1 = evaluateLoginLocationPolicy({ location: { city: 'Bengaluru', country: 'India' }, role: 'employee', policy });
  
  assert.strictEqual(time1.isViolated, false, '10:15 AM should NOT violate policy');
  assert.strictEqual(loc1.isViolated, false, 'Bengaluru should NOT violate policy');

  // Since it's normal (risk < 50), raiseAlertIfNeeded returns null and NO email is sent
  const alert1 = await raiseAlertIfNeeded({
    user,
    sourceEventType: 'login',
    scoreResult: {
      riskScore: 10,
      riskLevel: 'LOW',
      reasons: ['Standard baseline authentication'],
    },
    location: 'Bengaluru, Karnataka, India',
    time: '10:15:00',
    type: 'account_takeover',
  });

  assert.strictEqual(alert1, null, 'Normal login must NOT raise any alert');
  console.log('✅ TEST 1 PASSED: Normal login allowed. No alert created, NO email dispatched.\n');
  results.push({ test: 'Test 1: Normal Login (10:15 AM)', alertGenerated: false, emailSent: false, status: 'PASSED' });

  // --------------------------------------------------------------------------
  // TEST 2: Early login before 10:00 AM (09:15 AM)
  // --------------------------------------------------------------------------
  console.log('------------------------------------------------------------------------');
  console.log('TEST 2: Early login before allowed time (09:15 AM IST)...');
  const alert2 = await raiseAlertIfNeeded({
    user,
    sourceEventType: 'login',
    sourceEventId: new mongoose.Types.ObjectId(),
    scoreResult: {
      riskScore: 65,
      riskLevel: 'HIGH',
      reasons: ['Employee attempted to log in before the permitted window (Permitted: 10:00 AM–10:30 AM IST, Actual: 9:15 AM IST)'],
      recommendedAction: 'Verify if the early authentication was authorized by the department manager.',
    },
    ipAddress: '10.0.4.15',
    location: 'Bengaluru, Karnataka, India',
    device: 'Windows 11 Workstation',
    time: '09:15:00',
    type: 'outside_working_hours',
    expectedTimeWindow: '10:00 AM–10:30 AM',
    actualTime: '9:15 AM',
    expectedLocation: 'Bengaluru, Karnataka, India',
    detectedLocation: 'Bengaluru, Karnataka, India',
  });

  assert.ok(alert2, 'Alert should be generated for early login');
  assert.strictEqual(alert2.type, 'outside_working_hours');
  assert.strictEqual(alert2.emailSent, true, 'Email must be marked as sent');
  console.log(`✅ TEST 2 PASSED: Early Login Alert ${alert2.alertId} generated and delivered to Gmail!`);
  console.log(`   Message ID: ${alert2.emailMessageId}\n`);
  results.push({ test: 'Test 2: Early Login (09:15 AM)', alertGenerated: true, alertId: alert2.alertId, messageId: alert2.emailMessageId, status: 'PASSED' });

  // --------------------------------------------------------------------------
  // TEST 3: Late login after 10:30 AM (11:00 AM)
  // --------------------------------------------------------------------------
  console.log('------------------------------------------------------------------------');
  console.log('TEST 3: Late login after allowed window (11:00 AM IST)...');
  const alert3 = await raiseAlertIfNeeded({
    user,
    sourceEventType: 'login',
    sourceEventId: new mongoose.Types.ObjectId(),
    scoreResult: {
      riskScore: 60,
      riskLevel: 'HIGH',
      reasons: ['Employee attempted to log in outside the permitted window (Permitted: 10:00 AM–10:30 AM IST, Actual: 11:00 AM IST)'],
      recommendedAction: 'Contact employee to verify reason for tardy authentication.',
    },
    ipAddress: '10.0.4.15',
    location: 'Bengaluru, Karnataka, India',
    device: 'Windows 11 Workstation',
    time: '11:00:00',
    type: 'outside_working_hours',
    expectedTimeWindow: '10:00 AM–10:30 AM',
    actualTime: '11:00 AM',
    expectedLocation: 'Bengaluru, Karnataka, India',
    detectedLocation: 'Bengaluru, Karnataka, India',
  });

  assert.ok(alert3, 'Alert should be generated for late login');
  assert.strictEqual(alert3.emailSent, true, 'Email must be delivered');
  console.log(`✅ TEST 3 PASSED: Late Login Alert ${alert3.alertId} generated and delivered to Gmail!`);
  console.log(`   Message ID: ${alert3.emailMessageId}\n`);
  results.push({ test: 'Test 3: Late Login (11:00 AM)', alertGenerated: true, alertId: alert3.alertId, messageId: alert3.emailMessageId, status: 'PASSED' });

  // --------------------------------------------------------------------------
  // TEST 4: Unauthorized location login (Moscow, Russia)
  // --------------------------------------------------------------------------
  console.log('------------------------------------------------------------------------');
  console.log('TEST 4: Login from unauthorized location (Moscow, Russia)...');
  const alert4 = await raiseAlertIfNeeded({
    user,
    sourceEventType: 'login',
    sourceEventId: new mongoose.Types.ObjectId(),
    scoreResult: {
      riskScore: 85,
      riskLevel: 'CRITICAL',
      reasons: ['Login detected outside the authorized company location (Expected: Bengaluru, India, Detected: Moscow, Russia)'],
      recommendedAction: 'Immediate investigation required. Suspend active session and verify user identity.',
    },
    ipAddress: '185.220.101.5',
    location: 'Moscow, Russia',
    device: 'Kali Linux / Tor Node',
    time: '10:15:00',
    type: 'unauthorized_location',
    expectedLocation: 'Bengaluru, Karnataka, India',
    detectedLocation: 'Moscow, Russia',
    expectedTimeWindow: '10:00 AM–10:30 AM',
    actualTime: '10:15 AM',
  });

  assert.ok(alert4, 'Alert should be generated for unauthorized location');
  assert.strictEqual(alert4.emailSent, true, 'Email must be delivered');
  console.log(`✅ TEST 4 PASSED: Location Alert ${alert4.alertId} generated and delivered to Gmail!`);
  console.log(`   Message ID: ${alert4.emailMessageId}\n`);
  results.push({ test: 'Test 4: Unauthorized Location (Moscow)', alertGenerated: true, alertId: alert4.alertId, messageId: alert4.emailMessageId, status: 'PASSED' });

  // --------------------------------------------------------------------------
  // TEST 5: Brute-force credential spray
  // --------------------------------------------------------------------------
  console.log('------------------------------------------------------------------------');
  console.log('TEST 5: Brute-force multiple failed login attempts...');
  const alert5 = await raiseAlertIfNeeded({
    user,
    sourceEventType: 'login',
    sourceEventId: new mongoose.Types.ObjectId(),
    scoreResult: {
      riskScore: 75,
      riskLevel: 'HIGH',
      reasons: ['Automated brute-force credential attack detected: 4 consecutive failed password attempts within 5 minutes.'],
      recommendedAction: 'Temporarily lock account and verify IP origin for credential stuffing.',
    },
    ipAddress: '192.168.1.105',
    location: 'Bengaluru, Karnataka, India',
    device: 'Hydra Automated Scanner',
    time: '10:25:00',
    type: 'brute_force',
  });

  assert.ok(alert5, 'Alert should be generated for brute force');
  assert.strictEqual(alert5.emailSent, true, 'Email must be delivered');
  console.log(`✅ TEST 5 PASSED: Brute-Force Alert ${alert5.alertId} generated and delivered to Gmail!`);
  console.log(`   Message ID: ${alert5.emailMessageId}\n`);
  results.push({ test: 'Test 5: Brute-Force Spray', alertGenerated: true, alertId: alert5.alertId, messageId: alert5.emailMessageId, status: 'PASSED' });

  // --------------------------------------------------------------------------
  // TEST 6: Mass file download
  // --------------------------------------------------------------------------
  console.log('------------------------------------------------------------------------');
  console.log('TEST 6: Abnormal mass file downloading (12 files in 5 minutes)...');
  const alert6 = await raiseAlertIfNeeded({
    user,
    sourceEventType: 'file',
    sourceEventId: new mongoose.Types.ObjectId(),
    scoreResult: {
      riskScore: 80,
      riskLevel: 'HIGH',
      reasons: ['Unusual bulk file activity detected: 12 files accessed/downloaded within 5 minutes (Threshold: 10 files).'],
      recommendedAction: 'Inspect downloaded sensitive documents and restrict bulk export privileges.',
    },
    ipAddress: '10.0.4.15',
    location: 'Bengaluru, Karnataka, India',
    device: 'Windows 11 Workstation',
    time: '10:28:00',
    type: 'bulk_file_download',
    fileCount: 12,
    fileNames: ['company_policy_handbook.txt', 'customer_database.csv', 'salary_data.xlsx'],
  });

  assert.ok(alert6, 'Alert should be generated for mass download');
  assert.strictEqual(alert6.emailSent, true, 'Email must be delivered');
  console.log(`✅ TEST 6 PASSED: Mass Download Alert ${alert6.alertId} generated and delivered to Gmail!`);
  console.log(`   Message ID: ${alert6.emailMessageId}\n`);
  results.push({ test: 'Test 6: Mass File Download (12 files)', alertGenerated: true, alertId: alert6.alertId, messageId: alert6.emailMessageId, status: 'PASSED' });

  console.log('========================================================================');
  console.log('   ALL 6 SCENARIOS VERIFIED WITH REAL GMAIL DELIVERIES!                ');
  console.log('========================================================================');
  console.table(results);

  await mongoose.disconnect();
};

runEmailVerification().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
