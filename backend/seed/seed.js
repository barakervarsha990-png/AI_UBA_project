/**
 * Seed script — populates MongoDB with realistic demo data:
 *  - 1 admin + 10 employee users
 *  - 50+ normal login events
 *  - 10+ suspicious login events
 *  - 100+ file-access events
 *  - baselines for every employee
 *  - a handful of pre-existing alerts
 *
 * Run with: npm run seed  (from /backend)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const LoginEvent = require('../models/LoginEvent');
const FileEvent = require('../models/FileEvent');
const Baseline = require('../models/Baseline');
const Alert = require('../models/Alert');
const AuditLog = require('../models/AuditLog');

const { LOCATIONS, DEVICES, HOME_LOCATION, HOME_DEVICE, randomFrom, randomIpFromPrefix, getRandomLocation, getRandomDevice } = require('../utils/sampleGeoData');

const DEPARTMENTS = ['Engineering', 'Finance', 'HR', 'Sales', 'IT Operations', 'Legal'];
const TITLES = ['Software Engineer', 'Financial Analyst', 'HR Executive', 'Sales Manager', 'System Administrator', 'Legal Counsel'];

const NORMAL_FILES = [
  { fileName: 'weekly_status_report.docx', fileType: 'docx', sensitivityLevel: 'internal' },
  { fileName: 'project_plan.xlsx', fileType: 'xlsx', sensitivityLevel: 'internal' },
  { fileName: 'team_meeting_notes.pdf', fileType: 'pdf', sensitivityLevel: 'public' },
  { fileName: 'client_proposal.pptx', fileType: 'pptx', sensitivityLevel: 'internal' },
  { fileName: 'onboarding_guide.pdf', fileType: 'pdf', sensitivityLevel: 'public' },
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

const run = async () => {
  await connectDB();
  console.log('[SEED] Connected. Clearing existing collections...');

  await Promise.all([
    User.deleteMany({}),
    LoginEvent.deleteMany({}),
    FileEvent.deleteMany({}),
    Baseline.deleteMany({}),
    Alert.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);

  // ---------- Admin user ----------
  const admin = await User.create({
    employeeId: 'EMP-ADMIN-001',
    username: 'admin',
    fullName: 'Security Administrator',
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
    department: 'IT Operations',
    role: 'admin',
    jobTitle: 'SOC Administrator',
    status: 'active',
  });
  console.log(`[SEED] Created admin user: ${admin.username} (password from .env, not logged)`);

  // ---------- 10 employee users ----------
  const firstNames = ['Ananya', 'Rohit', 'Priya', 'Karthik', 'Sneha', 'Arjun', 'Divya', 'Vikram', 'Meera', 'Rahul'];
  const lastNames = ['Sharma', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Gupta', 'Rao', 'Menon', 'Singh', 'Kumar'];

  const employees = [];
  for (let i = 0; i < 10; i++) {
    const fullName = `${firstNames[i]} ${lastNames[i]}`;
    const username = `${firstNames[i].toLowerCase()}.${lastNames[i].toLowerCase()}`;
    const deptIdx = i % DEPARTMENTS.length;
    const user = await User.create({
      employeeId: `EMP-${1000 + i}`,
      username,
      fullName,
      email: `${username}@company.com`,
      password: 'EmployeeDemo123!', // demo only; employees don't log into this dashboard
      department: DEPARTMENTS[deptIdx],
      role: 'employee',
      jobTitle: TITLES[deptIdx],
      status: 'active',
    });
    employees.push(user);
  }
  console.log(`[SEED] Created ${employees.length} employee users`);

  // Two employees will be designated as the "suspicious" demo subjects
  const atoTarget = employees[0]; // account takeover demo subject
  const insiderTarget = employees[1]; // insider threat demo subject

  let totalNormalLogins = 0;
  let totalSuspiciousLogins = 0;
  let totalFileEvents = 0;

  // ---------- Normal login history (used to build baselines) + normal file activity ----------
  for (const emp of employees) {
    const homeLoc = HOME_LOCATION;
    const homeDevice = HOME_DEVICE;
    const homeIp = randomIpFromPrefix(homeLoc.ipPrefix);

    // 5-7 normal logins per employee over the last 20 days, during working hours
    const numLogins = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numLogins; i++) {
      const dayOffset = Math.floor(Math.random() * 20) + 1;
      const hour = 9 + Math.floor(Math.random() * 9); // 9am - 5pm-ish
      const dt = daysAgo(dayOffset, hour, Math.floor(Math.random() * 59));
      const { date, time } = formatDateTime(dt);

      await LoginEvent.create({
        userId: emp._id,
        username: emp.username,
        date,
        time,
        timestamp: dt,
        ipAddress: homeIp,
        country: homeLoc.country,
        state: homeLoc.state,
        city: homeLoc.city,
        latitude: homeLoc.latitude,
        longitude: homeLoc.longitude,
        device: homeDevice.device,
        os: homeDevice.os,
        browser: homeDevice.browser,
        loginStatus: 'success',
        riskScore: Math.floor(Math.random() * 15), // low baseline risk
        riskLevel: 'LOW',
        isSuspicious: false,
        reasons: [],
        simulated: false,
      });
      totalNormalLogins++;
    }

    // 3-5 normal file access events per employee, across a few days
    const numFileDays = 3 + Math.floor(Math.random() * 3);
    for (let d = 0; d < numFileDays; d++) {
      const dayOffset = Math.floor(Math.random() * 15) + 1;
      const filesPerDay = 2 + Math.floor(Math.random() * 3); // 2-4 files/day baseline

      for (let f = 0; f < filesPerDay; f++) {
        const hour = 9 + Math.floor(Math.random() * 8);
        const dt = daysAgo(dayOffset, hour, Math.floor(Math.random() * 59));
        const { date, time } = formatDateTime(dt);
        const file = randomFrom(NORMAL_FILES);
        const action = randomFrom(['view', 'view', 'modify', 'download']);

        await FileEvent.create({
          employeeId: emp.employeeId,
          userId: emp._id,
          username: emp.username,
          fileName: file.fileName,
          fileType: file.fileType,
          sensitivityLevel: file.sensitivityLevel,
          action,
          date,
          time,
          timestamp: dt,
          ipAddress: homeIp,
          location: `${homeLoc.city}, ${homeLoc.state}, ${homeLoc.country}`,
          device: homeDevice.device,
          riskScore: Math.floor(Math.random() * 10),
          riskLevel: 'LOW',
          isSuspicious: false,
          reasons: [],
          simulated: false,
        });
        totalFileEvents++;
      }
    }
  }

  // ---------- Build baselines from the normal history just created ----------
  const { recalculateBaseline } = require('../services/baselineService');
  for (const emp of employees) {
    await recalculateBaseline(emp._id);
  }
  console.log('[SEED] Baselines calculated for all employees');

  // ---------- 10+ suspicious login events spread across a few employees ----------
  const suspiciousLoginUsers = [atoTarget, employees[2], employees[3], employees[4]];
  for (let i = 0; i < 12; i++) {
    const emp = suspiciousLoginUsers[i % suspiciousLoginUsers.length];
    const loc = getRandomLocation(HOME_LOCATION.country);
    const device = getRandomDevice(HOME_DEVICE.device);
    const ip = randomIpFromPrefix(loc.ipPrefix);
    const dayOffset = Math.floor(Math.random() * 10);
    const hour = [1, 2, 3, 23][Math.floor(Math.random() * 4)]; // odd hours
    const dt = daysAgo(dayOffset, hour, Math.floor(Math.random() * 59));
    const { date, time } = formatDateTime(dt);

    const riskScore = 55 + Math.floor(Math.random() * 40); // HIGH-CRITICAL
    const riskLevel = riskScore >= 75 ? 'CRITICAL' : 'HIGH';

    const loginEvent = await LoginEvent.create({
      userId: emp._id,
      username: emp.username,
      date,
      time,
      timestamp: dt,
      ipAddress: ip,
      country: loc.country,
      state: loc.state,
      city: loc.city,
      latitude: loc.latitude,
      longitude: loc.longitude,
      device: device.device,
      os: device.os,
      browser: device.browser,
      loginStatus: Math.random() > 0.8 ? 'failed' : 'success',
      riskScore,
      riskLevel,
      isSuspicious: true,
      reasons: [
        `Login from new country: ${loc.country}`,
        `Login from unrecognized device: ${device.device}`,
        `Login at unusual hour: ${time}`,
      ],
      simulated: false,
    });
    totalSuspiciousLogins++;

    await Alert.create({
      userId: emp._id,
      username: emp.username,
      type: 'account_takeover',
      sourceEventType: 'login',
      sourceEventId: loginEvent._id,
      severity: riskLevel,
      riskScore,
      ipAddress: ip,
      location: `${loc.city}, ${loc.state}, ${loc.country}`,
      device: device.device,
      time,
      reasons: loginEvent.reasons,
      status: i % 3 === 0 ? 'resolved' : 'open',
      emailSent: true,
    });

    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      emp.riskLevel = riskLevel;
      await emp.save();
    }
  }
  console.log(`[SEED] Created ${totalSuspiciousLogins} suspicious login events with alerts`);

  // ---------- Insider threat historical event burst for insiderTarget ----------
  {
    const emp = insiderTarget;
    const baseline = await Baseline.findOne({ userId: emp._id });
    const homeLoc = HOME_LOCATION;
    const homeDevice = HOME_DEVICE;
    const ip = randomIpFromPrefix(homeLoc.ipPrefix);
    const burstDay = 3;
    const numEvents = 24;
    let lastEvent = null;

    for (let i = 0; i < numEvents; i++) {
      const dt = daysAgo(burstDay, 14, i * 2); // afternoon burst, 2 min apart
      const { date, time } = formatDateTime(dt);
      const file = randomFrom(CONFIDENTIAL_FILES);
      const action = randomFrom(['view', 'download', 'copy']);
      const riskScore = 60 + Math.floor(Math.random() * 35);
      const riskLevel = riskScore >= 75 ? 'CRITICAL' : 'HIGH';

      lastEvent = await FileEvent.create({
        employeeId: emp.employeeId,
        userId: emp._id,
        username: emp.username,
        fileName: file.fileName,
        fileType: file.fileType,
        sensitivityLevel: file.sensitivityLevel,
        action,
        date,
        time,
        timestamp: dt,
        ipAddress: ip,
        location: `${homeLoc.city}, ${homeLoc.state}, ${homeLoc.country}`,
        device: homeDevice.device,
        riskScore,
        riskLevel,
        isSuspicious: true,
        reasons: [
          `Access to ${file.sensitivityLevel} file: ${file.fileName}`,
          `High-risk action performed: ${action}`,
          `Abnormally high file access volume today (${i + 1}) vs. baseline max (${baseline?.maxFilesAccessedPerDay ?? 6})`,
        ],
        simulated: false,
      });
      totalFileEvents++;
    }

    emp.riskLevel = 'CRITICAL';
    await emp.save();

    await Alert.create({
      userId: emp._id,
      username: emp.username,
      type: 'insider_threat',
      sourceEventType: 'file',
      sourceEventId: lastEvent._id,
      severity: 'CRITICAL',
      riskScore: lastEvent.riskScore,
      ipAddress: ip,
      location: `${homeLoc.city}, ${homeLoc.state}, ${homeLoc.country}`,
      device: homeDevice.device,
      time: lastEvent.time,
      reasons: lastEvent.reasons,
      status: 'open',
      emailSent: true,
    });

    console.log(`[SEED] Created insider-threat burst (${numEvents} file events) for ${emp.username}`);
  }

  const totalLogins = await LoginEvent.countDocuments({});
  const totalFiles = await FileEvent.countDocuments({});
  const totalAlerts = await Alert.countDocuments({});

  console.log('----------------------------------------------');
  console.log('[SEED] Summary:');
  console.log(`  Users:            ${employees.length + 1} (1 admin + ${employees.length} employees)`);
  console.log(`  Login events:     ${totalLogins} (normal: ${totalNormalLogins}, suspicious: ${totalSuspiciousLogins})`);
  console.log(`  File events:      ${totalFiles}`);
  console.log(`  Alerts:           ${totalAlerts}`);
  console.log(`  ATO demo subject: ${atoTarget.username} (${atoTarget.fullName})`);
  console.log(`  Insider-threat demo subject: ${insiderTarget.username} (${insiderTarget.fullName})`);
  console.log('----------------------------------------------');
  console.log('[SEED] Done.');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('[SEED] Failed:', err);
  process.exit(1);
});
