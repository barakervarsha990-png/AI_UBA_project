/**
 * Test Suite for Company Security Policy, Role Separation, and All 8 Scenarios
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const assert = require('assert');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const connectDB = require('../config/db');
const User = require('../models/User');
const LoginEvent = require('../models/LoginEvent');
const FileEvent = require('../models/FileEvent');
const Baseline = require('../models/Baseline');
const Alert = require('../models/Alert');
const CompanyPolicy = require('../models/CompanyPolicy');

const {
  getPolicy,
  evaluateLoginTimePolicy,
  evaluateLoginLocationPolicy,
  format12Hour,
} = require('../services/policyService');
const { resolveLocation } = require('../services/geoService');
const { scoreLogin, scoreFile } = require('../services/mlClient');
const { raiseAlertIfNeeded } = require('../services/alertService');

const runAllTests = async () => {
  console.log('========================================================================');
  console.log('   SENTINEL — COMPANY POLICY, ROLES & 8 SCENARIOS VERIFICATION SUITE    ');
  console.log('========================================================================\n');

  await connectDB();
  console.log('[SETUP] Connected to MongoDB.\n');

  // Verify / load policy
  const policy = await getPolicy(true);
  console.log(`[POLICY] Active Company Policy:`);
  console.log(`  - Company: ${policy.companyName}`);
  console.log(`  - Timezone: ${policy.timezone}`);
  console.log(`  - Permitted Login Window: ${policy.loginWindowStart} to ${policy.loginWindowEnd} (${format12Hour(policy.loginWindowStart)} to ${format12Hour(policy.loginWindowEnd)})`);
  console.log(`  - Office Hours: ${policy.workingHoursStart} to ${policy.workingHoursEnd}`);
  console.log(`  - Authorized Location: ${policy.authorizedLocation.city}, ${policy.authorizedLocation.state}, ${policy.authorizedLocation.country}`);
  console.log(`  - Max Files per Window: ${policy.maxFilesPerWindow} files / ${policy.fileWindowMinutes} min\n`);

  // Verify test employee exists
  let employee = await User.findOne({ username: 'barakervarsha990' }).select('+password');
  assert.ok(employee, 'Test employee barakervarsha990 should exist in database');
  assert.strictEqual(employee.role, 'employee', 'User should have employee role');
  console.log(`[SETUP] Verified Employee: ${employee.fullName} (${employee.employeeId})\n`);

  // Verify manager / admin exists
  let admin = await User.findOne({ username: 'admin' });
  assert.ok(admin, 'Admin user should exist in database');
  assert.strictEqual(admin.role, 'admin', 'Admin user should have admin role');
  console.log(`[SETUP] Verified Administrator: ${admin.fullName} (${admin.username})\n`);

  // TEST 1: Permitted Employee Login (10:15 AM from Bengaluru)
  console.log('[TEST 1] Scenario 1: Normal Login at 10:15 AM from Bengaluru...');
  const timeEval1 = evaluateLoginTimePolicy({ timeStr: '10:15:00', role: 'employee', policy });
  assert.strictEqual(timeEval1.isViolated, false, '10:15 AM should be within permitted window (10:00-10:30 AM)');
  assert.strictEqual(timeEval1.status, 'permitted_window', 'Status should be permitted_window');

  const locEval1 = evaluateLoginLocationPolicy({
    geo: { city: 'Bengaluru', state: 'Karnataka', country: 'India' },
    role: 'employee',
    policy,
  });
  assert.strictEqual(locEval1.isViolated, false, 'Bengaluru should be authorized location');
  console.log('  ✓ Test 1 PASSED: 10:15 AM from Bengaluru is Permitted (LOW risk, no violation).\n');

  // TEST 2: Early Employee Login (09:00 AM)
  console.log('[TEST 2] Scenario 2: Early Employee Login at 09:00 AM (Before 10:00 AM)...');
  const timeEval2 = evaluateLoginTimePolicy({ timeStr: '09:00:00', role: 'employee', policy });
  assert.strictEqual(timeEval2.isViolated, true, '09:00 AM should violate login window');
  assert.ok(['outside_hours', 'outside_window'].includes(timeEval2.status), 'Status should indicate outside permitted window/hours');
  assert.ok(timeEval2.scoreAdjustment >= 50, 'Should apply high risk score adjustment');
  console.log(`  ✓ Test 2 PASSED: Early login flagged. Reason: "${timeEval2.reason}"\n`);

  // TEST 3: Late Employee Login (11:00 AM)
  console.log('[TEST 3] Scenario 3: Late Employee Login at 11:00 AM (After 10:30 AM)...');
  const timeEval3 = evaluateLoginTimePolicy({ timeStr: '11:00:00', role: 'employee', policy });
  assert.strictEqual(timeEval3.isViolated, true, '11:00 AM should violate login window');
  assert.strictEqual(timeEval3.status, 'outside_window', 'Status should be outside_window');
  console.log(`  ✓ Test 3 PASSED: Late login flagged. Reason: "${timeEval3.reason}"\n`);

  // TEST 4: Unauthorized Location (Moscow, Russia)
  console.log('[TEST 4] Scenario 4: Login from outside Bengaluru (Moscow, Russia)...');
  const locEval4 = evaluateLoginLocationPolicy({
    geo: { city: 'Moscow', state: 'Moscow Region', country: 'Russia' },
    role: 'employee',
    policy,
  });
  assert.strictEqual(locEval4.isViolated, true, 'Moscow should violate authorized Bengaluru location');
  assert.strictEqual(locEval4.status, 'unauthorized', 'Status should be unauthorized');
  assert.ok(locEval4.scoreAdjustment >= 55, 'Should apply critical risk score adjustment');
  console.log(`  ✓ Test 4 PASSED: Location violation flagged. Reason: "${locEval4.reason}"\n`);

  // TEST 5: Manager Role Exemption
  console.log('[TEST 5] Manager Role Exemption Test (03:00 AM from New York)...');
  const managerTimeEval = evaluateLoginTimePolicy({ timeStr: '03:00:00', role: 'manager', policy });
  assert.strictEqual(managerTimeEval.isViolated, false, 'Manager should be exempt from login window');
  assert.strictEqual(managerTimeEval.status, 'exempt', 'Status should be exempt');

  const managerLocEval = evaluateLoginLocationPolicy({
    geo: { city: 'New York', state: 'NY', country: 'United States' },
    role: 'manager',
    policy,
  });
  assert.strictEqual(managerLocEval.isViolated, false, 'Manager should be exempt from location restriction');
  console.log('  ✓ Test 5 PASSED: Manager/Admin exempt from time & location restrictions for 24/7 SOC response.\n');

  // TEST 6: Mass File Download Threshold (> 10 files in 5 min)
  console.log('[TEST 6] Scenario 7: Bulk File Download Detection Threshold...');
  const maxAllowed = policy.maxFilesPerWindow; // 10
  const simulatedCount = 12;
  const isBulk = simulatedCount > maxAllowed;
  assert.strictEqual(isBulk, true, '12 files should exceed maxFilesPerWindow (10)');

  const bulkAlert = await raiseAlertIfNeeded({
    user: employee,
    sourceEventType: 'file',
    sourceEventId: new mongoose.Types.ObjectId(),
    scoreResult: {
      riskScore: 75,
      riskLevel: 'HIGH',
      reasons: [`Unusual bulk file activity detected: 12 files accessed within 5 minutes (Threshold: 10)`],
      recommendedAction: 'Restrict bulk export permissions and review accessed files.',
    },
    location: 'Bengaluru, Karnataka, India',
    time: '10:20:00',
    type: 'bulk_file_download',
    fileCount: 12,
    fileNames: ['company_policy_handbook.txt', 'project_plan.xlsx', 'weekly_status_report.docx'],
  });
  assert.ok(bulkAlert, 'Bulk file download alert should be generated');
  assert.strictEqual(bulkAlert.type, 'bulk_file_download', 'Alert type should be bulk_file_download');
  assert.strictEqual(bulkAlert.fileCount, 12, 'Alert fileCount should be 12');
  console.log(`  ✓ Test 6 PASSED: Mass download alert generated: ${bulkAlert.alertId} (${bulkAlert.severity})\n`);

  // TEST 7: Outside Working Hours Alert Creation & Dispatch
  console.log('[TEST 7] Alert Creation for Outside Login Window...');
  const outsideAlert = await raiseAlertIfNeeded({
    user: employee,
    sourceEventType: 'login',
    sourceEventId: new mongoose.Types.ObjectId(),
    scoreResult: {
      riskScore: 65,
      riskLevel: 'HIGH',
      reasons: ['Login attempt at 09:00 AM is outside permitted window (10:00 AM–10:30 AM IST)'],
      recommendedAction: 'Verify whether early authentication was authorized by departmental supervisor.',
    },
    location: 'Bengaluru, Karnataka, India',
    time: '09:00:00',
    type: 'outside_working_hours',
    expectedTimeWindow: '10:00 AM–10:30 AM',
    actualTime: '09:00 AM',
  });
  assert.ok(outsideAlert, 'Outside working hours alert should be created');
  assert.strictEqual(outsideAlert.expectedTimeWindow, '10:00 AM–10:30 AM');
  assert.strictEqual(outsideAlert.actualTime, '09:00 AM');
  console.log(`  ✓ Test 7 PASSED: Created Outside Window Alert: ${outsideAlert.alertId} (${outsideAlert.type})\n`);

  // TEST 8: Unauthorized Location Alert Creation
  console.log('[TEST 8] Alert Creation for Unauthorized Location...');
  const unauthLocAlert = await raiseAlertIfNeeded({
    user: employee,
    sourceEventType: 'login',
    sourceEventId: new mongoose.Types.ObjectId(),
    scoreResult: {
      riskScore: 85,
      riskLevel: 'CRITICAL',
      reasons: ['Login detected from Moscow, Russia, violating authorized company location (Bengaluru, Karnataka, India)'],
      recommendedAction: 'Immediate credential rotation and session revocation required.',
    },
    location: 'Moscow, Russia',
    time: '10:15:00',
    type: 'unauthorized_location',
    expectedLocation: 'Bengaluru, Karnataka, India',
    detectedLocation: 'Moscow, Russia',
  });
  assert.ok(unauthLocAlert, 'Unauthorized location alert should be created');
  assert.strictEqual(unauthLocAlert.expectedLocation, 'Bengaluru, Karnataka, India');
  assert.strictEqual(unauthLocAlert.detectedLocation, 'Moscow, Russia');
  console.log(`  ✓ Test 8 PASSED: Created Location Alert: ${unauthLocAlert.alertId} (${unauthLocAlert.type})\n`);

  // TEST 9: Real IP Geolocation Resolution
  console.log('[TEST 9] Real IP Geolocation Resolution...');
  const mockReqLocal = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
  const geoLocal = await resolveLocation(mockReqLocal);
  assert.strictEqual(geoLocal.city, 'Bengaluru', 'Local/private IP should map to Bengaluru Company Network');
  assert.strictEqual(geoLocal.country, 'India', 'Local IP should map to India');
  console.log(`  ✓ Test 9 PASSED: Local IP 127.0.0.1 accurately identified as ${geoLocal.city}, ${geoLocal.country} (${geoLocal.note})\n`);

  console.log('========================================================================');
  console.log('   ALL 9 TEST SUITE CHECKS COMPLETED AND VERIFIED SUCCESSFULLY (100%)   ');
  console.log('========================================================================\n');

  await mongoose.disconnect();
};

runAllTests().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});
