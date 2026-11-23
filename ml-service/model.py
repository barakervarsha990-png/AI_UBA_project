"""
Anomaly-detection and threat-scoring engine for the Sentinel UBA Platform.

Features dual-model architecture:
1. Isolation Forest: unsupervised anomaly scoring based on deviation from historical baseline.
2. Random Forest: supervised classification trained on normal vs suspicious attack patterns
   (brute force, credential spray, account takeover sequence, off-hours foreign login).
3. Rule-based explainability: generates human-readable detection reasons.
4. Safe fallback: maintains operation even if models are uninitialized.
"""

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import joblib
import numpy as np

logger = logging.getLogger("sentinel.model")
MODELS_DIR = Path(__file__).resolve().parent / "models"

# SENSITIVITY AND ACTION WEIGHTS
SENSITIVITY_WEIGHT = {"public": 0.0, "internal": 0.2, "confidential": 0.6, "restricted": 1.0}
ACTION_WEIGHT = {"view": 0.1, "modify": 0.4, "copy": 0.6, "download": 0.7, "delete": 1.0}

LOGIN_FEATURE_NAMES = [
    "hour_of_day",
    "hour_dev",
    "is_new_country",
    "is_new_device",
    "is_new_ip",
    "failed_attempts_in_window",
    "is_after_failures",
    "is_failed",
]

FILE_FEATURE_NAMES = [
    "sensitivity_weight",
    "action_weight",
    "volume_ratio",
    "confidential_ratio",
]

# Global cache of loaded models
_MODELS: Dict[str, Any] = {}


def _risk_level(score: int) -> str:
    if score >= 75:
        return "CRITICAL"
    if score >= 50:
        return "HIGH"
    if score >= 30:
        return "MEDIUM"
    return "LOW"


def load_models() -> Dict[str, Any]:
    """Loads saved Isolation Forest and Random Forest models from disk."""
    global _MODELS
    if _MODELS.get("loaded"):
        return _MODELS

    models = {}
    try:
        login_iso_path = MODELS_DIR / "login_isolation_forest.joblib"
        login_rf_path = MODELS_DIR / "login_random_forest.joblib"
        file_iso_path = MODELS_DIR / "file_isolation_forest.joblib"
        file_rf_path = MODELS_DIR / "file_random_forest.joblib"

        if not (login_iso_path.exists() and login_rf_path.exists()):
            logger.info("Saved models not found on disk. Initiating training...")
            from train_models import train_and_save_models
            train_and_save_models()

        models["login_iso"] = joblib.load(login_iso_path)
        models["login_rf"] = joblib.load(login_rf_path)
        models["file_iso"] = joblib.load(file_iso_path)
        models["file_rf"] = joblib.load(file_rf_path)

        meta_path = MODELS_DIR / "model_metadata.json"
        if meta_path.exists():
            with open(meta_path, "r") as f:
                models["metadata"] = json.load(f)
        else:
            models["metadata"] = {"version": "2.0.0"}

        models["loaded"] = True
        logger.info("Successfully loaded all ML models into memory.")
    except Exception as exc:
        logger.warning("Could not load ML models, will fallback gracefully: %s", exc)
        models["loaded"] = False

    _MODELS = models
    return _MODELS


def get_model_status() -> Dict[str, Any]:
    models = load_models()
    meta = models.get("metadata", {})
    return {
        "status": "ready" if models.get("loaded") else "fallback_mode",
        "version": meta.get("version", "2.0.0"),
        "modelsLoaded": {
            "loginIsolationForest": "login_iso" in models,
            "loginRandomForest": "login_rf" in models,
            "fileIsolationForest": "file_iso" in models,
            "fileRandomForest": "file_rf" in models,
        },
        "loginFeatures": LOGIN_FEATURE_NAMES,
        "fileFeatures": FILE_FEATURE_NAMES,
        "metrics": meta.get("metrics", {}),
        "limitations": meta.get("limitations", []),
    }


# ---------------------------------------------------------------------------
# LOGIN SCORING PIPELINE
# ---------------------------------------------------------------------------

def extract_login_features(event: dict, baseline: Optional[dict]) -> Tuple[np.ndarray, dict, List[str], int]:
    """
    Extracts standardized numerical features and rule indicators for a login event.
    NEVER uses submitted password as a feature.
    """
    reasons = []
    rule_score = 0

    country = str(event.get("country") or "Unknown")
    device = str(event.get("device") or "Unknown Device")
    ip_address = str(event.get("ipAddress") or "0.0.0.0")
    time_str = str(event.get("time") or "12:00:00")
    login_status = str(event.get("loginStatus") or "success").lower()

    try:
        hour = int(time_str.split(":")[0])
    except (ValueError, IndexError):
        hour = 12

    normal_countries = (baseline or {}).get("normalCountries", []) or []
    normal_devices = (baseline or {}).get("normalDevices", []) or []
    normal_ips = (baseline or {}).get("normalIpAddresses", []) or []
    hour_start = (baseline or {}).get("typicalLoginHourStart", 9)
    hour_end = (baseline or {}).get("typicalLoginHourEnd", 19)

    # Calculate deviations
    is_new_country = 1.0 if (normal_countries and country not in normal_countries) else 0.0
    is_new_device = 1.0 if (normal_devices and device not in normal_devices) else 0.0
    is_new_ip = 1.0 if (normal_ips and ip_address not in normal_ips) else 0.0

    if hour < hour_start or hour > hour_end:
        hour_dev = float(min(6, min(abs(hour - hour_start), abs(hour - hour_end))))
    else:
        hour_dev = 0.0

    failed_attempts_in_window = float(event.get("failedAttemptsInWindow", 0) or 0)
    is_after_failures = 1.0 if event.get("isAfterFailures") else 0.0
    is_failed = 1.0 if login_status == "failed" else 0.0

    # Rule-based signal assessment
    if is_new_country:
        rule_score += 35
        reasons.append(f"Login from new/unrecognized country: {country}")
    if is_new_device:
        rule_score += 20
        reasons.append(f"Login from unrecognized device: {device}")
    if is_new_ip:
        rule_score += 15
        reasons.append(f"Login from new IP address: {ip_address}")
    if hour_dev > 0:
        rule_score += int(min(20, hour_dev * 4))
        reasons.append(f"Login at unusual hour ({time_str}, normal window {hour_start:02d}:00–{hour_end:02d}:00)")

    if is_failed:
        rule_score += 15
        reasons.append("Authentication failure")

    if failed_attempts_in_window >= 3:
        rule_score += min(35, int(failed_attempts_in_window * 7))
        reasons.append(f"Rapid failed authentication burst ({int(failed_attempts_in_window)} attempts in 5m window)")

    # Key Account Takeover (ATO) signature: success right after repeated failures
    if is_after_failures and not is_failed:
        rule_score += 45
        reasons.append("Account Takeover (ATO) indicator: successful login immediately following multiple failed attempts")

    # If user has no baseline yet
    if not normal_devices and not normal_ips:
        reasons.append("Initial baseline creation in progress for new user")

    features_dict = {
        "hour_of_day": round(float(hour), 2),
        "hour_dev": round(hour_dev, 2),
        "is_new_country": is_new_country,
        "is_new_device": is_new_device,
        "is_new_ip": is_new_ip,
        "failed_attempts_in_window": failed_attempts_in_window,
        "is_after_failures": is_after_failures,
        "is_failed": is_failed,
    }

    feature_vector = np.array([
        float(hour),
        hour_dev,
        is_new_country,
        is_new_device,
        is_new_ip,
        failed_attempts_in_window,
        is_after_failures,
        is_failed,
    ], dtype=float)

    return feature_vector, features_dict, reasons, rule_score


def score_login_event(event: dict, baseline: Optional[dict]) -> dict:
    """
    Evaluates a login event using the Dual ML Ensemble (Isolation Forest + Random Forest)
    blended with rule-based heuristics.
    """
    models = load_models()
    feature_vector, features_dict, reasons, rule_score = extract_login_features(event, baseline)

    iso_score = 0.0
    rf_score = 0.0
    model_name = "Rule-based Baseline Scorer"

    if models.get("loaded") and "login_iso" in models and "login_rf" in models:
        try:
            vec_2d = feature_vector.reshape(1, -1)
            raw_decision = models["login_iso"].decision_function(vec_2d)[0]
            # Logistic squashing of decision_function into [0, 1]
            iso_score = float(np.clip(1 / (1 + np.exp(raw_decision * 8)), 0.0, 1.0))

            # Random Forest classification probability for class 1 (suspicious)
            rf_prob = models["login_rf"].predict_proba(vec_2d)[0]
            rf_score = float(rf_prob[1]) if len(rf_prob) > 1 else float(rf_prob[0])

            model_name = "IsolationForest + RandomForest (Ensemble)"
        except Exception as exc:
            logger.warning("Error running ML models for login scoring: %s", exc)

    # Blended scoring
    if model_name.startswith("IsolationForest"):
        ml_score = 0.5 * (iso_score * 100) + 0.5 * (rf_score * 100)
        final_score = int(round(min(100, max(rule_score, 0.4 * rule_score + 0.6 * ml_score))))
    else:
        final_score = min(100, rule_score)

    risk_level = _risk_level(final_score)
    is_suspicious = final_score >= 50

    return {
        "riskScore": final_score,
        "riskLevel": risk_level,
        "isSuspicious": is_suspicious,
        "reasons": reasons if reasons else ["Normal login within established behavioural baseline"],
        "mlAnomalyFraction": round(iso_score, 3),
        "mlSuspiciousProb": round(rf_score, 3),
        "modelUsed": model_name,
        "featureVector": features_dict,
        "evaluationTimestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# FILE ACCESS SCORING PIPELINE
# ---------------------------------------------------------------------------

def extract_file_features(event: dict, baseline: Optional[dict], today_stats: Optional[dict]) -> Tuple[np.ndarray, dict, List[str], int]:
    reasons = []
    rule_score = 0

    sensitivity = str(event.get("sensitivityLevel") or "internal").lower()
    action = str(event.get("action") or "view").lower()
    file_name = str(event.get("fileName") or "document")

    sens_w = SENSITIVITY_WEIGHT.get(sensitivity, 0.2)
    act_w = ACTION_WEIGHT.get(action, 0.2)

    if sensitivity in ("confidential", "restricted"):
        rule_score += 20
        reasons.append(f"Access to sensitive resource ({sensitivity}): {file_name}")

    if action in ("download", "copy", "delete"):
        rule_score += 15
        reasons.append(f"High-impact file action performed: {action}")

    avg_files = float((baseline or {}).get("avgFilesAccessedPerDay", 3) or 3)
    max_files = float((baseline or {}).get("maxFilesAccessedPerDay", 6) or 6)
    avg_conf = float((baseline or {}).get("avgConfidentialFilesPerDay", 1) or 1)

    total_today = float((today_stats or {}).get("totalFilesToday", 1) or 1)
    conf_today = float((today_stats or {}).get("confidentialFilesToday", 0) or 0)

    volume_ratio = total_today / max(max_files, 1.0)
    conf_ratio = conf_today / max(avg_conf, 1.0)

    if volume_ratio > 3.0:
        rule_score += 40
        reasons.append(f"Abnormally high file access volume today ({int(total_today)}) vs. baseline limit ({int(max_files)})")
    elif volume_ratio > 1.2:
        rule_score += 20
        reasons.append(f"File access volume today ({int(total_today)}) exceeds normal baseline ({int(max_files)})")

    if conf_ratio > 4.0:
        rule_score += 30
        reasons.append(f"Unusually high confidential file activity ({int(conf_today)} events today vs baseline {avg_conf})")

    features_dict = {
        "sensitivity_weight": sens_w,
        "action_weight": act_w,
        "volume_ratio": round(min(volume_ratio, 6.0), 2),
        "confidential_ratio": round(min(conf_ratio, 10.0), 2),
    }

    feature_vector = np.array([sens_w, act_w, min(volume_ratio, 6.0), min(conf_ratio, 10.0)], dtype=float)
    return feature_vector, features_dict, reasons, rule_score


def score_file_event(event: dict, baseline: Optional[dict], today_stats: Optional[dict]) -> dict:
    models = load_models()
    feature_vector, features_dict, reasons, rule_score = extract_file_features(event, baseline, today_stats)

    iso_score = 0.0
    rf_score = 0.0
    model_name = "Rule-based Baseline Scorer"

    if models.get("loaded") and "file_iso" in models and "file_rf" in models:
        try:
            vec_2d = feature_vector.reshape(1, -1)
            raw_decision = models["file_iso"].decision_function(vec_2d)[0]
            iso_score = float(np.clip(1 / (1 + np.exp(raw_decision * 8)), 0.0, 1.0))

            rf_prob = models["file_rf"].predict_proba(vec_2d)[0]
            rf_score = float(rf_prob[1]) if len(rf_prob) > 1 else float(rf_prob[0])
            model_name = "IsolationForest + RandomForest (Ensemble)"
        except Exception as exc:
            logger.warning("Error running ML models for file scoring: %s", exc)

    if model_name.startswith("IsolationForest"):
        ml_score = 0.5 * (iso_score * 100) + 0.5 * (rf_score * 100)
        final_score = int(round(min(100, max(rule_score, 0.4 * rule_score + 0.6 * ml_score))))
    else:
        final_score = min(100, rule_score)

    risk_level = _risk_level(final_score)
    is_suspicious = final_score >= 50

    return {
        "riskScore": final_score,
        "riskLevel": risk_level,
        "isSuspicious": is_suspicious,
        "reasons": reasons if reasons else ["Normal file activity within baseline limits"],
        "mlAnomalyFraction": round(iso_score, 3),
        "mlSuspiciousProb": round(rf_score, 3),
        "modelUsed": model_name,
        "featureVector": features_dict,
        "evaluationTimestamp": datetime.now(timezone.utc).isoformat(),
    }
