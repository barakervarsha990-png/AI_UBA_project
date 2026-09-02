"""
FastAPI ML microservice for the AI-Driven User Behaviour Analytics platform.

Exposes:
  GET  /health
  POST /score/login   - score a login event against a user's baseline
  POST /score/file    - score a file-access event against a user's baseline

Run with: uvicorn main:app --reload --port 8001

NOTE ON ROBUSTNESS: these endpoints deliberately accept a raw JSON body
(dict) instead of a strict Pydantic schema. Threat-detection scoring must
never hard-fail with a 422 just because the caller's payload is missing an
optional field or uses a slightly different shape than expected — a bad
request should degrade gracefully to a safe default score, not break the
pipeline. Every field is read defensively with .get()/fallbacks below.
"""

import logging
from typing import Any, Dict, Optional

from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware

from model import score_login_event, score_file_event

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ml-service")

app = FastAPI(
    title="Insider Threat & Account Takeover Detection - ML Service",
    description="Isolation Forest based anomaly scoring for login and file-access behaviour.",
    version="1.0.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _safe_str(value: Any, default: str) -> str:
    return value if isinstance(value, str) and value.strip() else default


def _safe_number(value: Any, default: float) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _extract_login_event(body: Dict[str, Any]) -> Dict[str, Any]:
    event = body.get("event") or {}
    return {
        "username": event.get("username"),
        "date": event.get("date"),
        "time": _safe_str(event.get("time"), "12:00:00"),
        "country": _safe_str(event.get("country"), "Unknown"),
        "state": event.get("state"),
        "city": event.get("city"),
        "ipAddress": _safe_str(event.get("ipAddress"), "0.0.0.0"),
        "device": _safe_str(event.get("device"), "Unknown Device"),
        "loginStatus": _safe_str(event.get("loginStatus"), "success"),
    }


def _extract_login_baseline(body: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    baseline = body.get("baseline")
    if not baseline:
        return None
    return {
        "normalCountries": baseline.get("normalCountries") or [],
        "normalDevices": baseline.get("normalDevices") or [],
        "normalIpAddresses": baseline.get("normalIpAddresses") or [],
        "typicalLoginHourStart": int(_safe_number(baseline.get("typicalLoginHourStart"), 9)),
        "typicalLoginHourEnd": int(_safe_number(baseline.get("typicalLoginHourEnd"), 19)),
    }


def _extract_file_event(body: Dict[str, Any]) -> Dict[str, Any]:
    event = body.get("event") or {}
    return {
        "fileName": _safe_str(event.get("fileName"), "unknown_file"),
        "fileType": event.get("fileType"),
        "sensitivityLevel": _safe_str(event.get("sensitivityLevel"), "internal"),
        "action": _safe_str(event.get("action"), "view"),
    }


def _extract_file_baseline(body: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    baseline = body.get("baseline")
    if not baseline:
        return None
    return {
        "avgFilesAccessedPerDay": _safe_number(baseline.get("avgFilesAccessedPerDay"), 3),
        "maxFilesAccessedPerDay": _safe_number(baseline.get("maxFilesAccessedPerDay"), 6),
        "avgConfidentialFilesPerDay": _safe_number(baseline.get("avgConfidentialFilesPerDay"), 1),
    }


def _extract_today_stats(body: Dict[str, Any]) -> Dict[str, Any]:
    stats = body.get("todayStats") or {}
    return {
        "totalFilesToday": int(_safe_number(stats.get("totalFilesToday"), 1)),
        "confidentialFilesToday": int(_safe_number(stats.get("confidentialFilesToday"), 0)),
    }


@app.get("/health")
def health():
    return {"success": True, "status": "ok", "service": "ml-service"}


@app.post("/score/login")
def score_login(body: Dict[str, Any] = Body(...)):
    try:
        event = _extract_login_event(body)
        baseline = _extract_login_baseline(body)
        return score_login_event(event, baseline)
    except Exception as exc:
        logger.exception("[/score/login] Unexpected error, returning safe fallback. Raw body: %s", body)
        return {
            "riskScore": 0,
            "riskLevel": "LOW",
            "isSuspicious": False,
            "reasons": [f"Scoring error (fell back to LOW): {exc}"],
        }


@app.post("/score/file")
def score_file(body: Dict[str, Any] = Body(...)):
    try:
        event = _extract_file_event(body)
        baseline = _extract_file_baseline(body)
        today_stats = _extract_today_stats(body)
        return score_file_event(event, baseline, today_stats)
    except Exception as exc:
        logger.exception("[/score/file] Unexpected error, returning safe fallback. Raw body: %s", body)
        return {
            "riskScore": 0,
            "riskLevel": "LOW",
            "isSuspicious": False,
            "reasons": [f"Scoring error (fell back to LOW): {exc}"],
        }