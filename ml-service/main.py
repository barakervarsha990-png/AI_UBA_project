"""
FastAPI ML microservice for the Sentinel Behaviour Analytics platform.

Exposes:
  GET  /health        - health check
  GET  /model/status  - status of Isolation Forest and Random Forest models
  POST /model/train   - trigger model retraining and persistence
  POST /score/login   - score a real-time login event
  POST /score/file    - score a real-time file-access event
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model import score_login_event, score_file_event, get_model_status, load_models
from train_models import train_and_save_models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sentinel.ml-service")

app = FastAPI(
    title="Sentinel Behaviour Analytics - ML Service",
    description="Dual-Model Anomaly Detection (Isolation Forest) & Attack Classification (Random Forest).",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Preload models at startup
@app.on_event("startup")
def startup_event():
    load_models()


@app.get("/health")
def health():
    return {
        "success": True,
        "status": "ok",
        "service": "sentinel-ml-service",
        "version": "2.0.0",
    }


@app.get("/model/status")
def model_status():
    return {
        "success": True,
        "data": get_model_status(),
    }


@app.post("/model/train")
def train_models_endpoint():
    try:
        metadata = train_and_save_models()
        load_models()  # reload into memory
        return {
            "success": True,
            "message": "Models successfully retrained and persisted.",
            "data": metadata,
        }
    except Exception as exc:
        logger.exception("Error retraining models: %s", exc)
        return {
            "success": False,
            "message": f"Retraining failed: {exc}",
        }


@app.post("/score/login")
async def score_login(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    event = body.get("event") or {}
    baseline = body.get("baseline")

    try:
        result = score_login_event(event, baseline)
        return result
    except Exception as exc:
        logger.exception("Error scoring login event: %s", exc)
        return {
            "riskScore": 25,
            "riskLevel": "LOW",
            "isSuspicious": False,
            "reasons": [f"Evaluation fallback triggered: {exc}"],
            "modelUsed": "Fallback Heuristic Scorer",
        }


@app.post("/score/file")
async def score_file(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    event = body.get("event") or {}
    baseline = body.get("baseline")
    today_stats = body.get("todayStats")

    try:
        result = score_file_event(event, baseline, today_stats)
        return result
    except Exception as exc:
        logger.exception("Error scoring file event: %s", exc)
        return {
            "riskScore": 20,
            "riskLevel": "LOW",
            "isSuspicious": False,
            "reasons": [f"Evaluation fallback triggered: {exc}"],
            "modelUsed": "Fallback Heuristic Scorer",
        }
