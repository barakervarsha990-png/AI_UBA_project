"""
Anomaly-detection scoring engine for the Insider Threat / Account Takeover
detection platform.

For each incoming event, we build a small numeric feature vector describing
how much the event deviates from the user's behavioural baseline, fit a
lightweight Isolation Forest on a synthetic "normal behaviour" distribution
generated from that baseline, and score the real event against it. The
Isolation Forest anomaly score is then blended with explicit rule-based
signals (which double as the human-readable "reasons") to produce a final
0-100 risk score.

This keeps the demo self-contained (no need to persist large historical
feature matrices per user) while still using genuine unsupervised anomaly
detection rather than pure if/else rules.
"""

import numpy as np
from sklearn.ensemble import IsolationForest

RNG = np.random.default_rng(42)


def _risk_level(score: int) -> str:
    if score >= 75:
        return "CRITICAL"
    if score >= 50:
        return "HIGH"
    if score >= 30:
        return "MEDIUM"
    return "LOW"


def _fit_and_score(normal_samples: np.ndarray, sample: np.ndarray) -> float:
    """Fits an IsolationForest on synthetic normal samples and returns an
    anomaly score in [0, 1] for `sample` (1 = highly anomalous)."""
    clf = IsolationForest(n_estimators=100, contamination=0.12, random_state=42)
    clf.fit(normal_samples)

    # decision_function: higher = more normal, lower/negative = more anomalous.
    raw = clf.decision_function(sample.reshape(1, -1))[0]

    # Normalize roughly into [0, 1] anomaly score using a logistic squashing
    # centered around 0 (empirically decision_function values sit in ~[-0.3, 0.3]).
    anomaly = 1 / (1 + np.exp(raw * 8))
    return float(np.clip(anomaly, 0.0, 1.0))


# ---------------------------------------------------------------------------
# LOGIN SCORING
# ---------------------------------------------------------------------------

def score_login_event(event: dict, baseline: dict | None) -> dict:
    reasons = []
    rule_score = 0

    country = event.get("country")
    device = event.get("device")
    ip_address = event.get("ipAddress")
    time_str = event.get("time", "00:00:00")
    login_status = event.get("loginStatus", "success")

    try:
        hour = int(time_str.split(":")[0])
    except (ValueError, IndexError):
        hour = 12

    normal_countries = (baseline or {}).get("normalCountries", []) or []
    normal_devices = (baseline or {}).get("normalDevices", []) or []
    normal_ips = (baseline or {}).get("normalIpAddresses", []) or []
    hour_start = (baseline or {}).get("typicalLoginHourStart", 9)
    hour_end = (baseline or {}).get("typicalLoginHourEnd", 19)

    country_anomaly = 0 if country in normal_countries or not normal_countries else 1
    device_anomaly = 0 if device in normal_devices or not normal_devices else 1
    ip_anomaly = 0 if ip_address in normal_ips or not normal_ips else 1

    if hour < hour_start or hour > hour_end:
        # distance in hours outside the normal window, capped
        hour_dev = min(6, min(abs(hour - hour_start), abs(hour - hour_end)))
    else:
        hour_dev = 0

    failed_flag = 1 if login_status == "failed" else 0

    if country_anomaly:
        rule_score += 40
        reasons.append(f"Login from new/unrecognized country: {country}")
    if device_anomaly:
        rule_score += 20
        reasons.append(f"Login from unrecognized device: {device}")
    if ip_anomaly:
        rule_score += 15
        reasons.append(f"Login from new/unrecognized IP address: {ip_address}")
    if hour_dev > 0:
        rule_score += min(20, hour_dev * 4)
        reasons.append(f"Login at unusual hour: {time_str}")
    if failed_flag:
        rule_score += 10
        reasons.append("Failed login attempt")

    # ---- Isolation Forest component ----
    # Synthetic "normal" distribution: mostly zeros/no-deviation with small noise.
    normal_samples = np.column_stack([
        RNG.integers(0, 1, size=200, endpoint=False),  # country_anomaly ~ 0
        RNG.integers(0, 1, size=200, endpoint=False),  # device_anomaly ~ 0
        RNG.integers(0, 1, size=200, endpoint=False),  # ip_anomaly ~ 0
        RNG.normal(0, 1, size=200).clip(0, 6),          # hour_dev ~ small
        RNG.integers(0, 1, size=200, endpoint=False),  # failed_flag ~ 0
    ]).astype(float)

    sample = np.array([country_anomaly, device_anomaly, ip_anomaly, hour_dev, failed_flag], dtype=float)
    anomaly_fraction = _fit_and_score(normal_samples, sample)

    ml_score = anomaly_fraction * 100
    final_score = int(round(min(100, max(rule_score, 0.6 * rule_score + 0.4 * ml_score))))

    risk_level = _risk_level(final_score)
    return {
        "riskScore": final_score,
        "riskLevel": risk_level,
        "isSuspicious": final_score >= 50,
        "reasons": reasons if reasons else ["No significant deviation from baseline behaviour"],
        "mlAnomalyFraction": round(anomaly_fraction, 3),
    }


# ---------------------------------------------------------------------------
# FILE ACCESS SCORING
# ---------------------------------------------------------------------------

SENSITIVITY_WEIGHT = {"public": 0, "internal": 0.2, "confidential": 0.6, "restricted": 1.0}
ACTION_WEIGHT = {"view": 0.1, "modify": 0.4, "copy": 0.6, "download": 0.7, "delete": 1.0}


def score_file_event(event: dict, baseline: dict | None, today_stats: dict | None) -> dict:
    reasons = []
    rule_score = 0

    sensitivity = event.get("sensitivityLevel", "internal")
    action = event.get("action", "view")
    file_name = event.get("fileName", "file")

    sens_w = SENSITIVITY_WEIGHT.get(sensitivity, 0.2)
    act_w = ACTION_WEIGHT.get(action, 0.2)

    if sensitivity in ("confidential", "restricted"):
        rule_score += 15
        reasons.append(f"Access to {sensitivity} file: {file_name}")

    if action in ("download", "copy", "delete"):
        rule_score += 10
        reasons.append(f"High-risk action performed: {action}")

    avg_files = (baseline or {}).get("avgFilesAccessedPerDay", 3) or 3
    max_files = (baseline or {}).get("maxFilesAccessedPerDay", 6) or 6
    avg_conf = (baseline or {}).get("avgConfidentialFilesPerDay", 1) or 1

    total_today = (today_stats or {}).get("totalFilesToday", 1)
    conf_today = (today_stats or {}).get("confidentialFilesToday", 0)

    volume_ratio = total_today / max(max_files, 1)
    conf_ratio = conf_today / max(avg_conf, 1)

    if volume_ratio > 3:
        rule_score += 40
        reasons.append(f"Abnormally high file access volume today ({total_today}) vs. baseline max ({max_files})")
    elif volume_ratio > 1:
        rule_score += 20
        reasons.append(f"File access volume today ({total_today}) exceeds normal max ({max_files})")

    if conf_ratio > 5:
        rule_score += 30
        reasons.append(f"Unusually high confidential/restricted file activity today ({conf_today})")

    # ---- Isolation Forest component ----
    normal_samples = np.column_stack([
        RNG.uniform(0, 0.3, size=200),                  # sensitivity weight, mostly low
        RNG.uniform(0, 0.3, size=200),                  # action weight, mostly low
        RNG.normal(1.0, 0.3, size=200).clip(0, 3),       # volume ratio ~ around 1 (normal)
        RNG.normal(1.0, 0.5, size=200).clip(0, 3),       # confidential ratio ~ around 1
    ]).astype(float)

    sample = np.array([sens_w, act_w, min(volume_ratio, 6), min(conf_ratio, 10)], dtype=float)
    anomaly_fraction = _fit_and_score(normal_samples, sample)

    ml_score = anomaly_fraction * 100
    final_score = int(round(min(100, max(rule_score, 0.6 * rule_score + 0.4 * ml_score))))

    risk_level = _risk_level(final_score)
    return {
        "riskScore": final_score,
        "riskLevel": risk_level,
        "isSuspicious": final_score >= 50,
        "reasons": reasons if reasons else ["No significant deviation from baseline behaviour"],
        "mlAnomalyFraction": round(anomaly_fraction, 3),
    }
