const Baseline = require('../models/Baseline');
const LoginEvent = require('../models/LoginEvent');
const FileEvent = require('../models/FileEvent');

const uniq = (arr) => [...new Set(arr)];

/**
 * Recalculates a user's behaviour baseline from their historical (non-simulated,
 * non-suspicious) login and file events. Called by the seed script and can be
 * re-run periodically in production (e.g. via a scheduled job).
 */
const recalculateBaseline = async (userId) => {
  const logins = await LoginEvent.find({ userId, isSuspicious: false, simulated: false }).limit(500);
  const files = await FileEvent.find({ userId, isSuspicious: false, simulated: false }).limit(1000);

  const normalCountries = uniq(logins.map((l) => l.country));
  const normalStates = uniq(logins.map((l) => l.state));
  const normalCities = uniq(logins.map((l) => l.city));
  const normalDevices = uniq(logins.map((l) => l.device));
  const normalIpAddresses = uniq(logins.map((l) => l.ipAddress));

  const hours = logins.map((l) => parseInt(l.time.split(':')[0], 10)).filter((h) => !Number.isNaN(h));
  const typicalLoginHourStart = hours.length ? Math.min(...hours) : 9;
  const typicalLoginHourEnd = hours.length ? Math.max(...hours) : 19;

  const filesByDate = {};
  const confidentialByDate = {};
  files.forEach((f) => {
    filesByDate[f.date] = (filesByDate[f.date] || 0) + 1;
    if (f.sensitivityLevel === 'confidential' || f.sensitivityLevel === 'restricted') {
      confidentialByDate[f.date] = (confidentialByDate[f.date] || 0) + 1;
    }
  });

  const dailyCounts = Object.values(filesByDate);
  const avgFilesAccessedPerDay = dailyCounts.length
    ? Number((dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length).toFixed(2))
    : 3;
  const maxFilesAccessedPerDay = dailyCounts.length ? Math.max(...dailyCounts) : 6;

  const confDailyCounts = Object.values(confidentialByDate);
  const avgConfidentialFilesPerDay = confDailyCounts.length
    ? Number((confDailyCounts.reduce((a, b) => a + b, 0) / confDailyCounts.length).toFixed(2))
    : 1;

  const baseline = await Baseline.findOneAndUpdate(
    { userId },
    {
      userId,
      normalCountries: normalCountries.length ? normalCountries : ['India'],
      normalStates: normalStates.length ? normalStates : ['Karnataka'],
      normalCities: normalCities.length ? normalCities : ['Bengaluru'],
      normalDevices: normalDevices.length ? normalDevices : [],
      normalIpAddresses,
      typicalLoginHourStart,
      typicalLoginHourEnd,
      avgFilesAccessedPerDay,
      maxFilesAccessedPerDay: Math.max(maxFilesAccessedPerDay, avgFilesAccessedPerDay + 3),
      avgConfidentialFilesPerDay,
      lastRecalculatedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  return baseline;
};

module.exports = { recalculateBaseline };
