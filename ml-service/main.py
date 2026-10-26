"""
FastAPI ML microservice for the AI-Driven User Behaviour Analytics platform.

Exposes:
  GET  /health
  POST /score/login   - score a login event against a user's baseline
  POST /score/file    - score a file-access event against a user's baseline

Run with: uvicorn main:app --reload --port 8001
"""

from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model import score_login_event, score_file_event

app = FastAPI(
    title="Insider Threat & Account Takeover Detection - ML Service",
    description="Isolation Forest based anomaly scoring for login and file-access behaviour.",
    version="1.0.0",
)

# Allow the Node backend to call this service. Restrict origins in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginEventPayload(BaseModel):
    username: Optional[str] = None
    date: Optional[str] = None
    time: str
    country: str
    state: Optional[str] = None
    city: Optional[str] = None
    ipAddress: str
    device: str
    loginStatus: str = "success"


class BaselinePayload(BaseModel):
    normalCountries: List[str] = []
    normalDevices: List[str] = []
    normalIpAddresses: List[str] = []
    typicalLoginHourStart: int = 9
    typicalLoginHourEnd: int = 19


class ScoreLoginRequest(BaseModel):
    event: LoginEventPayload
    baseline: Optional[BaselinePayload] = None


class FileEventPayload(BaseModel):
    fileName: str
    fileType: Optional[str] = None
    sensitivityLevel: str = "internal"
    action: str = "view"


class FileBaselinePayload(BaseModel):
    avgFilesAccessedPerDay: float = 3
    maxFilesAccessedPerDay: float = 6
    avgConfidentialFilesPerDay: float = 1


class TodayStatsPayload(BaseModel):
    totalFilesToday: int = 1
    confidentialFilesToday: int = 0


class ScoreFileRequest(BaseModel):
    event: FileEventPayload
    baseline: Optional[FileBaselinePayload] = None
    todayStats: Optional[TodayStatsPayload] = None


@app.get("/health")
def health():
    return {"success": True, "status": "ok", "service": "ml-service"}


@app.post("/score/login")
def score_login(payload: ScoreLoginRequest):
    baseline_dict = payload.baseline.model_dump() if payload.baseline else None
    result = score_login_event(payload.event.model_dump(), baseline_dict)
    return result


@app.post("/score/file")
def score_file(payload: ScoreFileRequest):
    baseline_dict = payload.baseline.model_dump() if payload.baseline else None
    today_stats_dict = payload.todayStats.model_dump() if payload.todayStats else None
    result = score_file_event(payload.event.model_dump(), baseline_dict, today_stats_dict)
    return result
