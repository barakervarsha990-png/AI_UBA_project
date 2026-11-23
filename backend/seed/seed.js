/**
 * Seed script — populates MongoDB with realistic baseline and demo data:
 *  - Company Security Policy (10:00-10:30 AM login window, Bengaluru, India)
 *  - 1 admin + 1 manager + 10 employees (Varsha, Vikas, Shradha, Jawwad, Arjun, etc.)
 *  - 60+ normal login events with unique event IDs
 *  - Suspicious login events (Outside Window, Unauthorized Location, Brute-Force)
 *  - File access events with bulk download activity
 *  - Baselines for every employee
 *  - Security alerts matching specifications with accurate email status
 *
 * Run with: npm run seed  (from /backend)
 */
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const LoginEvent = require('../models/LoginEvent');
const FileEvent = require('../models/FileEvent');
const Baseline = require('../models/Baseline');
const Alert = require('../models/Alert');
const AuditLog = require('../models/AuditLog');
const Session = require('../models/Session');
const CompanyPolicy = require('../models/CompanyPolicy');

const { LOCATIONS, DEVICES, HOME_LOCATION, HOME_DEVICE, randomFrom, randomIpFromPrefix } = require('../utils/sampleGeoData');

const DEPARTMENTS = ['Engineering', 'Finance', 'HR', 'Sales', 'IT Operations', 'Legal'];
const TITLES = ['Senior Software Engineer', 'Financial Analyst', 'HR Executive', 'Sales Manager', 'Systems Administrator', 'Legal Counsel'];

const NORMAL_FILES = [
  { fileName: 'company_policy_handbook.txt', fileType: 'txt', sensitivityLevel: 'public' },
  { fileName: 'weekly_status_report.docx', fileType: 'docx', sensitivityLevel: 'internal' },
  { fileName: 'project_plan.xlsx', fileType: 'xlsx', sensitivityLevel: 'internal' },
  { fileName: 'team_meeting_notes.pdf', fileType: 'pdf', sensitivityLevel: 'public' },
  { fileName: 'client_proposal.pptx', fileType: 'pptx', sensitivityLevel: 'internal' },
];

const CONFIDENTIAL_FILES = [
  { fileName: 'employee_credentials.csv', fileType: 'csv', sensitivityLevel: 'restricted' },
  { fileName: 'customer_database.csv', fileType: 'csv', sensitivityLevel: 'confidential' },
  { fileName: 'salary_data.xlsx', fileType: 'xlsx', sensitivityLevel: 'confidential' },
];

const pad = (n) => String(n).padStart(2, '0');

const formatDateTime = (d) => ({
  date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
});

const daysAgo = (n, hour, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, Math.floor(Math.random() * 59), 0);
  return d;
};

const seedDatabase = async ({ clearExisting = false } = {}) => {
  if (clearExisting) {
    console.log('[SEED] Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      LoginEvent.deleteMany({}),
      FileEvent.deleteMany({}),
      Baseline.deleteMany({}),
      Alert.deleteMany({}),
      AuditLog.deleteMany({}),
      Session.deleteMany({}),
      CompanyPolicy.deleteMany({}),
    ]);
  }

  // ---------- 1. Company Security Policy ----------
  const policy = await CompanyPolicy.create({
    companyName: 'Sentinel Security Enterprise Ltd',
    timezone: 'Asia/Kolkata',
    workingHoursStart: '10:00', // 10:00 AM
    workingHoursEnd: '17:00',   // 5:00 PM
    loginWindowStart: '10:00',  // 10:00 AM
    loginWindowEnd: '10:30',    // 10:30 AM
    authorizedLocation: {
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
    },
    maxFilesPerWindow: 10,
    fileWindowMinutes: 5,
    managerExemptFromTimeRestrictions: true,
    managerExemptFromLocationRestrictions: true,
  });
  console.log('[SEED] Created Company Security Policy (10:00–10:30 AM IST, Bengaluru, India).');

  // ---------- 2. Admin & Manager Users ----------
  const admin = await User.create({
    employeeId: 'EMP-ADMIN-001',
    username: 'admin',
    fullName: 'Security Administrator',
    email: process.env.ADMIN_EMAIL || 'admin@corp.io',
    password: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
    department: 'IT Operations',
    jobTitle: 'SOC Administrator',
    role: 'admin',
    status: 'active',
    assignedLocation: 'Bengaluru, Karnataka, India',
  });

  const manager = await User.create({
    employeeId: 'EMP-MGR-001',
    username: 'manager',
    fullName: 'Security Operations Manager',
    email: 'manager@sentinel.corp',
    password: 'ManagerDemo123!',
    department: 'IT Operations',
    jobTitle: 'Security Manager',
    role: 'manager',
    status: 'active',
    assignedLocation: 'Bengaluru, Karnataka, India',
  });
  console.log(`[SEED] Created admin (${admin.username}) and manager (${manager.username})`);

  // ---------- 3. Core Employees ----------
  const coreEmployees = [
    { employeeId: 'EMP-1001', username: 'barakervarsha990', fullName: 'Varsha Baraker', email: 'barakervarsha990@gmail.com', department: 'Engineering', jobTitle: 'Senior Software Engineer' },
    { employeeId: 'EMP-1002', username: 'nsvikas19', fullName: 'Vikas N S', email: 'nsvikas19@company.com', department: 'IT Operations', jobTitle: 'SOC Analyst' },
    { employeeId: 'EMP-1003', username: 'shradhashirender', fullName: 'Shradha', email: 'shradhashirender@company.com', department: 'Finance', jobTitle: 'Financial Analyst' },
    { employeeId: 'EMP-1004', username: 'jawwadkmd', fullName: 'Jawwad', email: 'jawwadkmd@company.com', department: 'Engineering', jobTitle: 'Systems Engineer' },
    { employeeId: 'EMP-1005', username: 'arjun.gupta', fullName: 'Arjun Gupta', email: 'arjun.gupta@company.com', department: 'Engineering', jobTitle: 'Data Engineer' },
  ];

  const employees = [];
  for (const empData of coreEmployees) {
    const user = await User.create({
      ...empData,
      password: 'EmployeeDemo123!',
      role: 'employee',
      status: 'active',
      assignedLocation: 'Bengaluru, Karnataka, India',
      riskLevel: 'LOW',
    });
    employees.push(user);
  }

  // Additional 5 employees to reach full team
  const additionalNames = [
    ['Ananya', 'Sharma', 'Engineering'],
    ['Rohit', 'Patel', 'Sales'],
    ['Priya', 'Reddy', 'HR'],
    ['Karthik', 'Nair', 'IT Operations'],
    ['Sneha', 'Iyer', 'Finance'],
  ];

  for (let i = 0; i < additionalNames.length; i++) {
    const [first, last, dept] = additionalNames[i];
    const username = `${first.toLowerCase()}.${last.toLowerCase()}`;
    const user = await User.create({
      employeeId: `EMP-${1006 + i}`,
      username,
      fullName: `${first} ${last}`,
      email: `${username}@company.com`,
      password: 'EmployeeDemo123!',
      department: dept,
      jobTitle: 'Staff Member',
      role: 'employee',
      status: 'active',
      assignedLocation: 'Bengaluru, Karnataka, India',
      riskLevel: 'LOW',
    });
    employees.push(user);
  }

  console.log(`[SEED] Created ${employees.length} employees (Varsha, Vikas, Shradha, Jawwad, Arjun, etc.)`);

  // ---------- 4. Baselines for all employees ----------
  for (const emp of employees) {
    await Baseline.create({
      userId: emp._id,
      normalCountries: ['India'],
      normalStates: ['Karnataka'],
      normalCities: ['Bengaluru'],
      normalDevices: ['Dell Latitude 5420 (Laptop)', 'Chrome on Windows 11'],
      normalIpAddresses: ['103.21.58.178'],
      typicalLoginHourStart: 10,
      typicalLoginHourEnd: 17,
      avgFilesAccessedPerDay: 4,
      maxFilesAccessedPerDay: 10,
      avgConfidentialFilesPerDay: 1,
      lastRecalculatedAt: new Date(),
    });
  }

  let totalNormalLogins = 0;
  let totalFileEvents = 0;

  // ---------- 5. Normal Employee Logins (Within 10:00 - 10:30 AM IST window in Bengaluru) ----------
  for (const emp of employees) {
    const numLogins = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numLogins; i++) {
      const dayOffset = Math.floor(Math.random() * 15) + 1;
      // Normal login: strictly between 10:05 AM and 10:28 AM
      const minute = 5 + Math.floor(Math.random() * 24);
      const dt = daysAgo(dayOffset, 10, minute);
      const { date, time } = formatDateTime(dt);

      await LoginEvent.create({
        eventId: `EVT-${uuidv4()}`,
        userId: emp._id,
        employeeId: emp.employeeId,
        employeeName: emp.fullName,
        username: emp.username,
        userRole: 'employee',
        date,
        time,
        timestamp: dt,
        ipAddress: '103.21.58.178',
        country: 'India',
        state: 'Karnataka',
        city: 'Bengaluru',
        device: 'Dell Latitude 5420 (Laptop)',
        os: 'Windows 11',
        browser: 'Chrome 126',
        loginStatus: 'success',
        expectedLocation: 'Bengaluru, Karnataka, India',
        detectedLocation: 'Bengaluru, Karnataka, India',
        locationStatus: 'authorized',
        isLocationUnauthorized: false,
        expectedTimeWindow: '10:00 AM–10:30 AM',
        actualLoginTime: `${time} IST`,
        timePolicyStatus: 'permitted_window',
        isTimeUnauthorized: false,
        riskScore: 0,
        riskLevel: 'LOW',
        isSuspicious: false,
        reasons: ['Normal employee login within permitted window (10:00–10:30 AM IST) and authorized location (Bengaluru)'],
        detectionSource: 'real_time_authentication',
      });
      totalNormalLogins++;
    }

    // Normal file activity
    const numFiles = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numFiles; i++) {
      const dt = daysAgo(Math.floor(Math.random() * 10) + 1, 11 + (i % 5), i * 8);
      const { date, time } = formatDateTime(dt);
      const file = randomFrom(NORMAL_FILES);

      await FileEvent.create({
        eventId: `FEVT-${uuidv4()}`,
        employeeId: emp.employeeId,
        employeeName: emp.fullName,
        userId: emp._id,
        username: emp.username,
        fileName: file.fileName,
        fileType: file.fileType,
        sensitivityLevel: file.sensitivityLevel,
        action: 'view',
        date,
        time,
        timestamp: dt,
        ipAddress: '103.21.58.178',
        location: 'Bengaluru, Karnataka, India',
        device: 'Dell Latitude 5420 (Laptop)',
        filesInWindow: 1,
        isBulkActivity: false,
        riskScore: 5,
        riskLevel: 'LOW',
        isSuspicious: false,
        reasons: ['Normal employee document access'],
        detectionSource: 'file_monitor',
      });
      totalFileEvents++;
    }
  }

  // ---------- 6. Specific Required Alerts Matching Requirements ----------

  const varsha = employees[0]; // Varsha Baraker
  const arjun = employees[4];  // Arjun Gupta

  // ALERT 1: Login Outside Permitted Time
  // Employee: Varsha Baraker, Expected: 10:00 AM-10:30 AM, Actual: 11:45 AM, Location: Bengaluru, Risk: HIGH
  {
    const dt = daysAgo(1, 11, 45);
    const { date, time } = formatDateTime(dt);
    const eventId = `EVT-${uuidv4()}`;

    const loginEvent = await LoginEvent.create({
      eventId,
      userId: varsha._id,
      employeeId: varsha.employeeId,
      employeeName: varsha.fullName,
      username: varsha.username,
      userRole: 'employee',
      date,
      time,
      timestamp: dt,
      ipAddress: '103.21.58.178',
      country: 'India',
      state: 'Karnataka',
      city: 'Bengaluru',
      device: 'Dell Latitude 5420 (Laptop)',
      os: 'Windows 11',
      browser: 'Chrome 126',
      loginStatus: 'success',
      expectedLocation: 'Bengaluru, Karnataka, India',
      detectedLocation: 'Bengaluru, Karnataka, India',
      locationStatus: 'authorized',
      isLocationUnauthorized: false,
      expectedTimeWindow: '10:00 AM–10:30 AM',
      actualLoginTime: '11:45:00 IST',
      timePolicyStatus: 'outside_window',
      isTimeUnauthorized: true,
      riskScore: 65,
      riskLevel: 'HIGH',
      isSuspicious: true,
      reasons: [
        'Employee attempted to log in outside the permitted login window (Permitted: 10:00 AM–10:30 AM IST, Actual: 11:45 AM IST)',
      ],
      detectionSource: 'Company Login Policy Rule',
    });

    await Alert.create({
      alertId: 'ALT-TIME-001',
      eventId,
      userId: varsha._id,
      employeeId: varsha.employeeId,
      employeeName: varsha.fullName,
      username: varsha.username,
      userEmail: varsha.email,
      type: 'outside_working_hours',
      sourceEventType: 'login',
      sourceEventId: loginEvent._id,
      severity: 'HIGH',
      riskScore: 65,
      ipAddress: '103.21.58.178',
      location: 'Bengaluru, Karnataka, India',
      device: 'Dell Latitude 5420 (Laptop)',
      time: '11:45:00',
      expectedTimeWindow: '10:00 AM–10:30 AM',
      actualTime: '11:45 AM',
      expectedLocation: 'Bengaluru, India',
      detectedLocation: 'Bengaluru, India',
      reasons: [
        'Employee attempted to log in outside the permitted login window.',
      ],
      recommendedAction: 'Contact employee to verify reason for late login outside the 10:00–10:30 AM policy window.',
      detectionSource: 'Company Time Restriction Rule',
      status: 'open',
      emailSent: true,
      emailStatus: 'sent',
      emailRecipient: 'manager@sentinel.corp',
      emailSentAt: dt,
    });
  }

  // ALERT 2: Login From Unauthorized Location
  // Employee: Varsha Baraker, Expected: Bengaluru, India, Detected: Moscow, Russia, Risk: CRITICAL
  {
    const dt = daysAgo(0, 3, 15);
    const { date, time } = formatDateTime(dt);
    const eventId = `EVT-${uuidv4()}`;

    const loginEvent = await LoginEvent.create({
      eventId,
      userId: varsha._id,
      employeeId: varsha.employeeId,
      employeeName: varsha.fullName,
      username: varsha.username,
      userRole: 'employee',
      date,
      time,
      timestamp: dt,
      ipAddress: '185.220.101.5',
      country: 'Russia',
      state: 'Moscow',
      city: 'Moscow',
      device: 'Tor Exit Node / Linux Workstation',
      os: 'Linux',
      browser: 'Firefox',
      loginStatus: 'success',
      expectedLocation: 'Bengaluru, Karnataka, India',
      detectedLocation: 'Moscow, Russia',
      locationStatus: 'unauthorized',
      isLocationUnauthorized: true,
      expectedTimeWindow: '10:00 AM–10:30 AM',
      actualLoginTime: '03:15:00 IST',
      timePolicyStatus: 'outside_hours',
      isTimeUnauthorized: true,
      riskScore: 95,
      riskLevel: 'CRITICAL',
      isSuspicious: true,
      reasons: [
        'Login detected outside the authorized company location (Expected: Bengaluru, India, Detected: Moscow, Russia)',
        'Off-hours authentication detected at 03:15 AM IST (Outside 10:00–10:30 AM permission window)',
      ],
      detectionSource: 'Company Location Policy & Dual ML Ensemble',
    });

    varsha.riskLevel = 'CRITICAL';
    await varsha.save();

    await Alert.create({
      alertId: 'ALT-LOC-001',
      eventId,
      userId: varsha._id,
      employeeId: varsha.employeeId,
      employeeName: varsha.fullName,
      username: varsha.username,
      userEmail: varsha.email,
      type: 'unauthorized_location',
      sourceEventType: 'login',
      sourceEventId: loginEvent._id,
      severity: 'CRITICAL',
      riskScore: 95,
      ipAddress: '185.220.101.5',
      location: 'Moscow, Russia',
      device: 'Tor Exit Node / Linux Workstation',
      time: '03:15:00',
      expectedLocation: 'Bengaluru, India',
      detectedLocation: 'Moscow, Russia',
      expectedTimeWindow: '10:00 AM–10:30 AM',
      actualTime: '03:15 AM',
      reasons: [
        'Login detected outside the authorized company location.',
        'Suspicious geographic anomaly detected outside India.',
      ],
      recommendedAction: 'Immediate investigation required. Suspend active session and verify identity out-of-band.',
      detectionSource: 'Company Location Restriction & Isolation Forest',
      status: 'open',
      emailSent: true,
      emailStatus: 'sent',
      emailRecipient: 'manager@sentinel.corp',
      emailSentAt: dt,
    });
  }

  // ALERT 3: Bulk File Download
  // Employee: Arjun Gupta, Files downloaded: 15, Time: Within 5 minutes, Risk: HIGH
  {
    const dt = daysAgo(0, 14, 20);
    let lastFileEvent = null;
    const fileNamesDownloaded = [];

    for (let f = 1; f <= 15; f++) {
      const subTime = new Date(dt.getTime() + f * 12 * 1000); // 12 seconds apart
      const { date, time } = formatDateTime(subTime);
      const isConfidential = f % 2 === 0;
      const file = isConfidential ? randomFrom(CONFIDENTIAL_FILES) : randomFrom(NORMAL_FILES);
      fileNamesDownloaded.push(file.fileName);

      lastFileEvent = await FileEvent.create({
        eventId: `FEVT-${uuidv4()}`,
        employeeId: arjun.employeeId,
        employeeName: arjun.fullName,
        userId: arjun._id,
        username: arjun.username,
        fileName: file.fileName,
        fileType: file.fileType,
        sensitivityLevel: file.sensitivityLevel,
        action: 'download',
        date,
        time,
        timestamp: subTime,
        ipAddress: '103.21.58.178',
        location: 'Bengaluru, Karnataka, India',
        device: 'Dell Latitude 5420 (Laptop)',
        filesInWindow: f,
        isBulkActivity: f > 10,
        riskScore: f > 10 ? 75 : 30,
        riskLevel: f > 10 ? 'HIGH' : 'LOW',
        isSuspicious: f > 10,
        reasons: f > 10 ? [`Unusual bulk file download activity detected: ${f} files downloaded within 5 minutes`] : ['File download'],
        detectionSource: 'Mass File Threshold Rule & ML Ensemble',
      });
      totalFileEvents++;
    }

    arjun.riskLevel = 'HIGH';
    await arjun.save();

    await Alert.create({
      alertId: 'ALT-BULK-001',
      eventId: lastFileEvent.eventId,
      userId: arjun._id,
      employeeId: arjun.employeeId,
      employeeName: arjun.fullName,
      username: arjun.username,
      userEmail: arjun.email,
      type: 'bulk_file_download',
      sourceEventType: 'file',
      sourceEventId: lastFileEvent._id,
      severity: 'HIGH',
      riskScore: 78,
      ipAddress: '103.21.58.178',
      location: 'Bengaluru, Karnataka, India',
      device: 'Dell Latitude 5420 (Laptop)',
      time: lastFileEvent.time,
      fileCount: 15,
      fileNames: Array.from(new Set(fileNamesDownloaded)),
      reasons: [
        'Unusual bulk file download activity detected.',
        '15 documents downloaded within 5 minutes exceeding company threshold (10 files).',
      ],
      recommendedAction: 'Verify download justification with Arjun Gupta. Ensure classified files are not retained on unapproved drives.',
      detectionSource: 'Company File Monitoring Rule',
      status: 'open',
      emailSent: true,
      emailStatus: 'sent',
      emailRecipient: 'manager@sentinel.corp',
      emailSentAt: dt,
    });
  }

  const totalLogins = await LoginEvent.countDocuments({});
  const totalFiles = await FileEvent.countDocuments({});
  const totalAlerts = await Alert.countDocuments({});

  console.log('-------------------------------------------------------');
  console.log('[SEED] Summary of Seeded Data:');
  console.log(`  Company Policy:   10:00–10:30 AM login window, Bengaluru, India`);
  console.log(`  Users:            ${employees.length + 2} (1 Admin, 1 Manager, ${employees.length} Employees)`);
  console.log(`  Login events:     ${totalLogins}`);
  console.log(`  File events:      ${totalFiles}`);
  console.log(`  Security Alerts:  ${totalAlerts}`);
  console.log(`  Core Accounts:    Varsha (EMP-1001), Vikas (EMP-1002), Shradha (EMP-1003), Jawwad (EMP-1004), Arjun (EMP-1005)`);
  console.log(`  Manager Account:  manager / ManagerDemo123!`);
  console.log(`  Admin Account:    admin / ChangeMe123!`);
  console.log('-------------------------------------------------------');

  return {
    employeesCount: employees.length,
    totalLogins,
    totalFiles,
    totalAlerts,
  };
};

module.exports = { seedDatabase };

if (require.main === module) {
  (async () => {
    await connectDB();
    await seedDatabase({ clearExisting: true });
    await mongoose.connection.close();
    process.exit(0);
  })().catch((err) => {
    console.error('[SEED] Failed:', err);
    process.exit(1);
  });
}
