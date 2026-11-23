const User = require('../models/User');
const LoginEvent = require('../models/LoginEvent');
const FileEvent = require('../models/FileEvent');
const { getPolicy, getCompanyCurrentTime, format12Hour } = require('../services/policyService');

// GET /api/employee/dashboard
const getEmployeeDashboard = async (req, res) => {
  try {
    const user = req.user;
    const policy = await getPolicy();
    const currentTime = getCompanyCurrentTime(new Date(), policy.timezone);

    // Fetch user's own recent logins & file events (privacy-isolated)
    const [recentLogins, recentFiles, totalFilesToday] = await Promise.all([
      LoginEvent.find({ userId: user._id }).sort({ timestamp: -1 }).limit(15).lean(),
      FileEvent.find({ userId: user._id }).sort({ timestamp: -1 }).limit(15).lean(),
      FileEvent.countDocuments({ userId: user._id, date: currentTime.dateStr }),
    ]);

    // Check current policy compliance status
    const currentHourMin = currentTime.timeStr;
    const isWithinLoginWindow =
      currentTime.minutesFromMidnight >= (10 * 60) && currentTime.minutesFromMidnight <= (10 * 60 + 30);
    const isWithinWorkHours =
      currentTime.minutesFromMidnight >= (10 * 60) && currentTime.minutesFromMidnight <= (17 * 60);

    res.json({
      success: true,
      data: {
        profile: {
          id: user._id,
          employeeId: user.employeeId,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          department: user.department,
          jobTitle: user.jobTitle,
          role: user.role,
          status: user.status,
          assignedLocation: user.assignedLocation || 'Bengaluru, Karnataka, India',
          lastLoginAt: user.lastLoginAt,
        },
        companyPolicy: {
          timezone: policy.timezone,
          currentTimeIST: `${currentTime.timeStr} (IST)`,
          currentDateIST: currentTime.dateStr,
          workingHours: `${format12Hour(policy.workingHoursStart)} to ${format12Hour(policy.workingHoursEnd)} IST`,
          loginWindow: `${format12Hour(policy.loginWindowStart)} to ${format12Hour(policy.loginWindowEnd)} IST`,
          authorizedLocation: `${policy.authorizedLocation.city}, ${policy.authorizedLocation.state}, ${policy.authorizedLocation.country}`,
          isWithinLoginWindow,
          isWithinWorkHours,
          maxFilesPerWindow: policy.maxFilesPerWindow,
        },
        stats: {
          totalFilesAccessedToday: totalFilesToday,
          recentLoginCount: recentLogins.length,
          recentFileCount: recentFiles.length,
        },
        recentLogins,
        recentFiles,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/employee/logins
const getMyLogins = async (req, res) => {
  try {
    const logins = await LoginEvent.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .limit(50);
    res.json({ success: true, data: logins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/employee/files
const getMyFiles = async (req, res) => {
  try {
    const files = await FileEvent.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .limit(50);
    res.json({ success: true, data: files });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getEmployeeDashboard, getMyLogins, getMyFiles };

