const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

/**
 * Calls the Python FastAPI ML service to score a login event using Dual ML Ensemble
 * (Isolation Forest + Random Forest).
 * Falls back to local baseline rules if unreachable so that the SOC never stops working.
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

const getMlStatus = async () => {
  try {
    const res = await axios.get(`${ML_URL}/model/status`, { timeout: 2500 });
    return res.data;
  } catch (err) {
    return {
      success: false,
      status: 'offline',
      message: 'Python ML service is currently offline. Local rule-based fallback active.',
    };
  }
};

const triggerModelRetrain = async () => {
  try {
    const res = await axios.post(`${ML_URL}/model/train`, {}, { timeout: 15000 });
    return res.data;
  } catch (err) {
    return {
      success: false,
      message: `Failed to trigger retraining: ${err.message}`,
    };
  }
};

// ---------- Local fallback rule-based scoring (active if ML microservice is down) ----------

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

  const country = event.country || 'Unknown';
  const device = event.device || 'Unknown';
  const ipAddress = event.ipAddress || '0.0.0.0';
  const time = event.time || '12:00:00';
  const loginStatus = event.loginStatus || 'success';
  const failedAttempts = event.failedAttemptsInWindow || 0;
  const isAfterFailures = !!event.isAfterFailures;

  if (baseline) {
    if (baseline.normalCountries && baseline.normalCountries.length > 0 && !baseline.normalCountries.includes(country)) {
      score += 35;
      reasons.push(`Login from new country: ${country}`);
    }
    if (baseline.normalDevices && baseline.normalDevices.length > 0 && !baseline.normalDevices.includes(device)) {
      score += 20;
      reasons.push(`Login from unrecognized device: ${device}`);
    }
    if (baseline.normalIpAddresses && baseline.normalIpAddresses.length > 0 && !baseline.normalIpAddresses.includes(ipAddress)) {
      score += 15;
      reasons.push(`Login from new/unrecognized IP address: ${ipAddress}`);
    }
    const hour = parseInt(time.split(':')[0], 10);
    if (!isNaN(hour) && (hour < baseline.typicalLoginHourStart || hour > baseline.typicalLoginHourEnd)) {
      score += 20;
      reasons.push(`Login at unusual hour: ${time}`);
    }
  }

  if (loginStatus === 'failed') {
    score += 15;
    reasons.push('Authentication failure');
  }

  if (failedAttempts >= 3) {
    score += Math.min(35, failedAttempts * 7);
    reasons.push(`Rapid failed login attempts (${failedAttempts} in 5-min window)`);
  }

  if (isAfterFailures && loginStatus === 'success') {
    score += 45;
    reasons.push('Account Takeover (ATO) indicator: successful login immediately following multiple failures');
  }

  score = Math.min(100, score);
  return {
    riskScore: score,
    riskLevel: riskLevelFromScore(score),
    isSuspicious: score >= 50,
    reasons: reasons.length ? reasons : ['Normal login within established baseline'],
    mlAnomalyFraction: 0,
    mlSuspiciousProb: 0,
    modelUsed: 'Local Fallback Rule Engine',
    featureVector: {},
  };
};

const localFileFallback = (payload) => {
  const { event, baseline, todayStats } = payload;
  let score = 0;
  const reasons = [];

  if (event.sensitivityLevel === 'confidential' || event.sensitivityLevel === 'restricted') {
    score += 20;
    reasons.push(`Access to sensitive resource (${event.sensitivityLevel}): ${event.fileName}`);
  }

  if (['download', 'copy', 'delete'].includes(event.action)) {
    score += 15;
    reasons.push(`High-impact action performed: ${event.action}`);
  }

  if (baseline && todayStats) {
    if (todayStats.totalFilesToday > baseline.maxFilesAccessedPerDay * 3) {
      score += 40;
      reasons.push(
        `Abnormally high file access volume today (${todayStats.totalFilesToday}) vs baseline limit (${baseline.maxFilesAccessedPerDay})`
      );
    } else if (todayStats.totalFilesToday > baseline.maxFilesAccessedPerDay) {
      score += 20;
      reasons.push(
        `File access volume today (${todayStats.totalFilesToday}) exceeds normal baseline (${baseline.maxFilesAccessedPerDay})`
      );
    }

    if (todayStats.confidentialFilesToday > baseline.avgConfidentialFilesPerDay * 4) {
      score += 30;
      reasons.push(`Unusually high confidential file activity today (${todayStats.confidentialFilesToday})`);
    }
  }

  score = Math.min(100, score);
  return {
    riskScore: score,
    riskLevel: riskLevelFromScore(score),
    isSuspicious: score >= 50,
    reasons: reasons.length ? reasons : ['Normal file activity within baseline limits'],
    mlAnomalyFraction: 0,
    mlSuspiciousProb: 0,
    modelUsed: 'Local Fallback Rule Engine',
    featureVector: {},
  };
};

module.exports = { scoreLogin, scoreFile, getMlStatus, triggerModelRetrain };
