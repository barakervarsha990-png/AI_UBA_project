const CompanyPolicy = require('../models/CompanyPolicy');

let cachedPolicy = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

/**
 * Retrieves the active company security policy from MongoDB with memory caching.
 * Initializes default policy if none exists in the database.
 */
const getPolicy = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedPolicy && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedPolicy;
  }

  try {
    let policy = await CompanyPolicy.findOne();
    if (!policy) {
      policy = await CompanyPolicy.create({
        companyName: 'Sentinel Security Enterprise',
        timezone: 'Asia/Kolkata',
        workingHoursStart: '10:00',
        workingHoursEnd: '17:00',
        loginWindowStart: '10:00',
        loginWindowEnd: '10:30',
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
      console.log('[POLICY] Initialized default company security policy in MongoDB.');
    }
    cachedPolicy = policy.toObject();
    lastFetchTime = now;
    return cachedPolicy;
  } catch (err) {
    console.warn('[POLICY] Failed to fetch policy from DB, using fallback defaults:', err.message);
    return {
      companyName: 'Sentinel Security Enterprise',
      timezone: 'Asia/Kolkata',
      workingHoursStart: '10:00',
      workingHoursEnd: '17:00',
      loginWindowStart: '10:00',
      loginWindowEnd: '10:30',
      authorizedLocation: {
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
      },
      maxFilesPerWindow: 10,
      fileWindowMinutes: 5,
      managerExemptFromTimeRestrictions: true,
      managerExemptFromLocationRestrictions: true,
    };
  }
};

/**
 * Updates company policy and clears cache.
 */
const updatePolicy = async (updateData) => {
  let policy = await CompanyPolicy.findOne();
  if (!policy) {
    policy = new CompanyPolicy(updateData);
  } else {
    Object.assign(policy, updateData);
  }
  await policy.save();
  cachedPolicy = policy.toObject();
  lastFetchTime = Date.now();
  return cachedPolicy;
};

/**
 * Converts "HH:mm" or "HH:mm:ss" string to total minutes from midnight.
 */
const timeStringToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = String(timeStr).trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

/**
 * Formats a 24h "HH:mm" string into a 12h readable string (e.g. "10:00 AM", "5:00 PM").
 */
const format12Hour = (timeStr) => {
  if (!timeStr) return '';
  const parts = String(timeStr).split(':');
  let h = parseInt(parts[0], 10) || 0;
  const m = String(parts[1] || '00').padStart(2, '0');
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${period}`;
};

/**
 * Extracts the current wall-clock time in the configured company timezone (Asia/Kolkata).
 * Returns { dateStr: 'YYYY-MM-DD', timeStr: 'HH:mm:ss', minutesFromMidnight: number }
 */
const getCompanyCurrentTime = (dateObj = new Date(), timezone = 'Asia/Kolkata') => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(dateObj);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    let hour = parts.find((p) => p.type === 'hour')?.value || '10';
    let minute = parts.find((p) => p.type === 'minute')?.value || '00';
    let second = parts.find((p) => p.type === 'second')?.value || '00';

    // Intl can sometimes format 24:00:00
    if (hour === '24') hour = '00';

    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hour}:${minute}:${second}`;
    const minutesFromMidnight = parseInt(hour, 10) * 60 + parseInt(minute, 10);

    return { dateStr, timeStr, minutesFromMidnight, hour: parseInt(hour, 10), minute: parseInt(minute, 10) };
  } catch (err) {
    const d = dateObj;
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const minutesFromMidnight = d.getHours() * 60 + d.getMinutes();
    return { dateStr, timeStr, minutesFromMidnight, hour: d.getHours(), minute: d.getMinutes() };
  }
};

/**
 * Validates login time against the company login policy:
 * - Allowed employee login window: 10:00 AM to 10:30 AM (Asia/Kolkata)
 * - Company working hours: 10:00 AM to 5:00 PM (10:00 - 17:00)
 * - Managers are exempt if policy allows
 */
const evaluateLoginTimePolicy = ({ timeStr, role = 'employee', policy }) => {
  const isManagerOrAdmin = role === 'admin' || role === 'manager';

  if (isManagerOrAdmin && policy.managerExemptFromTimeRestrictions) {
    return {
      isViolated: false,
      isOutsideHours: false,
      status: 'exempt',
      policyStart: policy.loginWindowStart,
      policyEnd: policy.loginWindowEnd,
      expectedWindowDisplay: `${format12Hour(policy.loginWindowStart)}–${format12Hour(policy.loginWindowEnd)}`,
      actualTimeDisplay: format12Hour(timeStr),
      reason: null,
      scoreAdjustment: 0,
    };
  }

  const actualMinutes = timeStringToMinutes(timeStr);
  const windowStartMinutes = timeStringToMinutes(policy.loginWindowStart); // 600 (10:00 AM)
  const windowEndMinutes = timeStringToMinutes(policy.loginWindowEnd);     // 630 (10:30 AM)
  const workStartMinutes = timeStringToMinutes(policy.workingHoursStart);  // 600 (10:00 AM)
  const workEndMinutes = timeStringToMinutes(policy.workingHoursEnd);      // 1020 (5:00 PM)

  const inLoginWindow = actualMinutes >= windowStartMinutes && actualMinutes <= windowEndMinutes;
  const inWorkHours = actualMinutes >= workStartMinutes && actualMinutes <= workEndMinutes;

  const expectedWindowDisplay = `${format12Hour(policy.loginWindowStart)}–${format12Hour(policy.loginWindowEnd)}`;
  const actualTimeDisplay = format12Hour(timeStr);

  if (inLoginWindow) {
    return {
      isViolated: false,
      isOutsideHours: false,
      status: 'permitted_window',
      policyStart: policy.loginWindowStart,
      policyEnd: policy.loginWindowEnd,
      expectedWindowDisplay,
      actualTimeDisplay,
      reason: null,
      scoreAdjustment: 0,
    };
  }

  // Login is outside permitted window (before 10:00 AM or after 10:30 AM)
  let reason = '';
  let scoreAdjustment = 55; // High risk baseline for time violation
  let status = 'outside_window';

  if (actualMinutes < windowStartMinutes) {
    reason = `Employee attempted to log in before the permitted login window (Permitted: ${expectedWindowDisplay} IST, Actual: ${actualTimeDisplay} IST)`;
    scoreAdjustment = 55;
    status = 'outside_hours';
  } else if (actualMinutes > workEndMinutes) {
    reason = `Employee attempted to log in after company closing hours (Operating: ${format12Hour(policy.workingHoursStart)}–${format12Hour(policy.workingHoursEnd)} IST, Actual: ${actualTimeDisplay} IST)`;
    scoreAdjustment = 60;
    status = 'outside_hours';
  } else {
    // Between 10:30 AM and 5:00 PM
    reason = `Employee attempted to log in outside the permitted login window (Permitted: ${expectedWindowDisplay} IST, Actual: ${actualTimeDisplay} IST)`;
    scoreAdjustment = 50;
    status = 'outside_window';
  }

  return {
    isViolated: true,
    isOutsideHours: !inWorkHours,
    status,
    policyStart: policy.loginWindowStart,
    policyEnd: policy.loginWindowEnd,
    expectedWindowDisplay,
    actualTimeDisplay,
    reason,
    scoreAdjustment,
  };
};

/**
 * Validates employee login location against registered company location (Bengaluru, Karnataka, India).
 */
const evaluateLoginLocationPolicy = ({ location, geo, role = 'employee', policy }) => {
  const isManagerOrAdmin = role === 'admin' || role === 'manager';
  const loc = location || geo || {};

  if (isManagerOrAdmin && policy.managerExemptFromLocationRestrictions) {
    return {
      isViolated: false,
      status: 'exempt',
      expectedLocation: `${policy.authorizedLocation.city}, ${policy.authorizedLocation.state}, ${policy.authorizedLocation.country}`,
      detectedLocation: `${loc.city || 'N/A'}, ${loc.country || 'N/A'}`,
      reason: null,
      scoreAdjustment: 0,
    };
  }

  const expectedCity = (policy.authorizedLocation.city || 'Bengaluru').toLowerCase().trim();
  const expectedCountry = (policy.authorizedLocation.country || 'India').toLowerCase().trim();

  const detectedCity = (loc.city || '').toLowerCase().trim();
  const detectedCountry = (loc.country || '').toLowerCase().trim();

  const expectedLocationDisplay = `${policy.authorizedLocation.city}, ${policy.authorizedLocation.country}`;
  const detectedLocationDisplay = `${loc.city || 'Unknown City'}, ${loc.country || 'Unknown Country'}`;

  // If location is unavailable
  if (loc.city === 'Location unavailable' || !loc.city) {
    return {
      isViolated: false,
      status: 'unavailable',
      expectedLocation: expectedLocationDisplay,
      detectedLocation: 'Location unavailable',
      reason: 'Location information unavailable for this IP address (IP geolocation is approximate).',
      scoreAdjustment: 10,
    };
  }

  const isCityMatch = detectedCity === expectedCity || detectedCity.includes('bangalore') || detectedCity.includes('bengaluru');
  const isCountryMatch = detectedCountry === expectedCountry;

  if (isCityMatch && isCountryMatch) {
    return {
      isViolated: false,
      status: 'authorized',
      expectedLocation: expectedLocationDisplay,
      detectedLocation: detectedLocationDisplay,
      reason: null,
      scoreAdjustment: 0,
    };
  }

  // Location violation: detected outside Bengaluru
  const reason = `Login detected outside the authorized company location (Expected: ${expectedLocationDisplay}, Detected: ${detectedLocationDisplay})`;
  const isForeignCountry = !isCountryMatch;
  const scoreAdjustment = isForeignCountry ? 70 : 55; // Higher severity for foreign nations

  return {
    isViolated: true,
    status: 'unauthorized',
    expectedLocation: expectedLocationDisplay,
    detectedLocation: detectedLocationDisplay,
    reason,
    scoreAdjustment,
  };
};

module.exports = {
  getPolicy,
  updatePolicy,
  getCompanyCurrentTime,
  evaluateLoginTimePolicy,
  evaluateLoginLocationPolicy,
  format12Hour,
  timeStringToMinutes,
};

