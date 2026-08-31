const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

/**
 * Calls the Python FastAPI ML service to score a login event against baseline.
 * Falls back to a local rule-based scorer if the ML service is unreachable,
 * so the app keeps working even if the ML microservice is down.
 */
const scoreLogin = async (payload) => {
  try {
    const res = await axios.post(`${ML_URL}/score/login`, payload, { timeout: 4000 });
    return res.data;
  } catch (err) {
    console.warn('[ML CLIENT] ML service unreachable, using local fallback scorer:', err.message);
    return localLoginFallback(payload);
  }
};

const scoreFile = async (payload) => {
  try {
    const res = await axios.post(`${ML_URL}/score/file`, payload, { timeout: 4000 });
    return res.data;
  } catch (err) {
    console.warn('[ML CLIENT] ML service unreachable, using local fallback scorer:', err.message);
    return localFileFallback(payload);
  }
};

// ---------- Local fallback rule-based scoring (used only if ML microservice is down) ----------

const riskLevelFromScore = (score) => {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
};

const localLoginFallback = (payload) => {
  const { event, baseline } = payload;
  let score = 0;
  const reasons = [];

  if (baseline) {
    if (!baseline.normalCountries.includes(event.country)) {
      score += 40;
      reasons.push(`Login from new country: ${event.country}`);
    }
    if (!baseline.normalDevices.includes(event.device)) {
      score += 20;
      reasons.push(`Login from unrecognized device: ${event.device}`);
    }
    if (!baseline.normalIpAddresses.includes(event.ipAddress)) {
      score += 15;
      reasons.push(`Login from new/unrecognized IP address: ${event.ipAddress}`);
    }
    const hour = parseInt(event.time.split(':')[0], 10);
    if (hour < baseline.typicalLoginHourStart || hour > baseline.typicalLoginHourEnd) {
      score += 20;
      reasons.push(`Login at unusual hour: ${event.time}`);
    }
  }

  if (event.loginStatus === 'failed') {
    score += 10;
    reasons.push('Failed login attempt');
  }

  score = Math.min(100, score);
  return { riskScore: score, riskLevel: riskLevelFromScore(score), isSuspicious: score >= 50, reasons };
};

const localFileFallback = (payload) => {
  const { event, baseline, todayStats } = payload;
  let score = 0;
  const reasons = [];

  if (event.sensitivityLevel === 'confidential' || event.sensitivityLevel === 'restricted') {
    score += 15;
    reasons.push(`Access to ${event.sensitivityLevel} file: ${event.fileName}`);
  }

  if (['download', 'copy', 'delete'].includes(event.action)) {
    score += 10;
    reasons.push(`High-risk action performed: ${event.action}`);
  }

  if (baseline && todayStats) {
    if (todayStats.totalFilesToday > baseline.maxFilesAccessedPerDay * 3) {
      score += 40;
      reasons.push(
        `Abnormally high file access volume today (${todayStats.totalFilesToday}) vs. baseline max (${baseline.maxFilesAccessedPerDay})`
      );
    } else if (todayStats.totalFilesToday > baseline.maxFilesAccessedPerDay) {
      score += 20;
      reasons.push(
        `File access volume today (${todayStats.totalFilesToday}) exceeds normal max (${baseline.maxFilesAccessedPerDay})`
      );
    }

    if (todayStats.confidentialFilesToday > baseline.avgConfidentialFilesPerDay * 5) {
      score += 30;
      reasons.push(`Unusually high confidential file activity today (${todayStats.confidentialFilesToday})`);
    }
  }

  score = Math.min(100, score);
  return { riskScore: score, riskLevel: riskLevelFromScore(score), isSuspicious: score >= 50, reasons };
};

module.exports = { scoreLogin, scoreFile };
