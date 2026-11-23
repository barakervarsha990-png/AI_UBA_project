# SENTINEL — AI-Driven User Behaviour Analytics (UBA) for Real-Time Insider Threat & Account Takeover Detection

An enterprise-grade, event-driven Security Operations Center (SOC) and User Behaviour Analytics (UBA) platform. Upgraded from static simulations into a **working real-time security monitoring system** that captures live authentication requests, extracts behavioral features against per-user baselines, evaluates threat probability via a **Dual-Model ML Ensemble (Isolation Forest + Random Forest)**, persists security telemetry to MongoDB, and pushes instant alerts across WebSockets (Socket.IO) to an auto-updating SOC dashboard.

---

## 1. System Architecture & Real-Time Event Pipeline

```
[ Authentication / Activity Request ]
                 │
                 ▼
[ Authentication & Activity Service (Node.js/Express) ]
   ├── Password verification (bcrypt)
   ├── Session creation & rolling failed-attempt tracking
   ├── Metadata parser (Source IP, User-Agent, Device, Time)
                 │
                 ▼
[ Real-Time Security Event Collector ]
   ├── Generates unique eventId (UUID)
   ├── Records event to persistent MongoDB (LoginEvent / FileEvent)
                 │
                 ▼
[ Feature Engineering Engine ]
   ├── Normalized 8-dim login feature schema / 4-dim file feature schema
   ├── Baseline deviation calculation (Country, Device, IP, Work Hours, Volume)
   ├── Signature triggers (e.g. Failure burst, ATO sequence: failures -> foreign IP success)
                 │
                 ▼
[ Dual-Model ML Scoring Service (FastAPI / Scikit-Learn) ]
   ├── Isolation Forest: Unsupervised anomaly scoring [0, 1]
   ├── Random Forest Classifier: Supervised attack probability [0, 1]
   ├── Heuristic Explainability: Human-readable detection reasons
                 │
                 ▼
[ Risk Evaluation & Alert Dispatcher ]
   ├── Risk Score: 0–100 scale (LOW, MEDIUM, HIGH, CRITICAL)
   ├── Alert deduplication window (prevents alert spam)
   ├── Persistent storage to MongoDB (Alert collection)
   ├── SMTP Email alert notification
                 │
                 ▼
[ Live WebSocket Broadcast (Socket.IO) ]
   └── Real-time dashboard updates without page refresh or CSV polling
```

---

## 2. Machine Learning Architecture: Dual-Model Ensemble

Sentinel utilizes a consistent feature schema between offline training and live inference:

### 2.1 Standardized Feature Schema

#### Login Activity Features (8 Dimensions)
1. `hour_of_day`: Current local hour (0–23).
2. `hour_dev`: Distance in hours outside user's established historical window (clipped to 6.0).
3. `is_new_country`: Binary indicator (`1.0` if country not in user baseline, else `0.0`).
4. `is_new_device`: Binary indicator (`1.0` if device unrecognized, else `0.0`).
5. `is_new_ip`: Binary indicator (`1.0` if IP address not in baseline, else `0.0`).
6. `failed_attempts_in_window`: Count of failed logins within rolling 5-minute window.
7. `is_after_failures`: Key ATO indicator (`1.0` if successful login immediately follows 2+ failures).
8. `is_failed`: Binary indicator (`1.0` if current attempt failed, else `0.0`).

#### File Access Features (4 Dimensions)
1. `sensitivity_weight`: Numeric sensitivity ranking (Public: 0.0, Internal: 0.2, Confidential: 0.6, Restricted: 1.0).
2. `action_weight`: Action severity (View: 0.1, Modify: 0.4, Copy: 0.6, Download: 0.7, Delete: 1.0).
3. `volume_ratio`: Current daily file count relative to baseline maximum (`totalFilesToday / maxFilesPerDay`).
4. `confidential_ratio`: Confidential file count relative to daily baseline average.

### 2.2 Model Serialization & Inference
- Pre-trained models are saved using `joblib` in `ml-service/models/`:
  - `login_isolation_forest.joblib` (unsupervised anomaly detection)
  - `login_random_forest.joblib` (supervised attack classification)
  - `file_isolation_forest.joblib`
  - `file_random_forest.joblib`
  - `model_metadata.json` (versioning, feature names, training metrics)
- **Safe Fallback**: If the ML service is temporarily down, the Node.js backend automatically falls back to an identical rule-based heuristic evaluator (`Local Fallback Rule Engine`), ensuring the SOC never drops an incoming event.

---

## 3. Directory Structure

```
insider-threat-detection/
├── backend/
│   ├── config/              # MongoDB connection
│   ├── controlled_files/    # Physical files for authorized insider threat testing
│   ├── controllers/
│   │   ├── authController.js        # Employee & admin login, registration, sessions
│   │   ├── fileAccessController.js  # Real file viewing & downloading telemetry
│   │   ├── dashboardController.js   # SOC metrics, active sessions, live ticker
│   │   ├── loginEventController.js  # Authentication audit trail
│   │   ├── fileEventController.js   # File activity audit trail
│   │   └── alertController.js       # Alert listing and administrator acknowledgement
│   ├── models/              # Mongoose schemas (User, LoginEvent, FileEvent, Session, Alert, Baseline)
│   ├── routes/              # Express API route declarations
│   ├── services/            # ML client, Socket.IO, Email, Baseline calculator, Alert dispatcher
│   ├── tests/
│   │   └── test_sentinel_pipeline.js # Automated test suite for all 12 required scenarios
│   └── server.js            # Express & Socket.IO entry point
├── ml-service/
│   ├── models/              # Persisted joblib model artifacts
│   ├── main.py              # FastAPI endpoints (/health, /model/status, /score/login, /score/file)
│   ├── model.py             # Dual-model inference, feature extraction, and explainability
│   ├── train_models.py      # Offline model training & validation script
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx     # SOC console, live event stream, active sessions
│   │   │   ├── DemoPortalPage.jsx    # Interactive Employee Portal & live attack simulator
│   │   │   ├── AlertsPage.jsx        # Security incident triage & acknowledgement
│   │   │   ├── LoginActivityPage.jsx # Authentication telemetry table
│   │   │   ├── FileActivityPage.jsx  # File access telemetry & CSV export
│   │   │   ├── RiskAnalysisPage.jsx  # Risk distribution analytics
│   │   │   └── LocationActivityPage.jsx # Geographic distribution
│   │   ├── components/      # StatCard, Sidebar, SeverityBadge, AlertToastStack
│   │   └── services/        # Axios API & Socket.IO client
└── run_live_demo.py         # Terminal-based end-to-end demonstration script
```

---

## 4. Setup and Execution Guide

### 4.1 Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **Python**: v3.10 or v3.11 (tested on Python 3.11.9)
- **MongoDB**: Local MongoDB instance running on `localhost:27017`

### 4.2 Step 1: Start MongoDB
Ensure MongoDB is running. On Windows (PowerShell):
```powershell
Get-Service -Name MongoDB
```
If not running:
```powershell
Start-Service -Name MongoDB
```

### 4.3 Step 2: Start the Python ML Service
In Terminal 1 (from project root):
```powershell
cd ml-service
.\venv\Scripts\activate
uvicorn main:app --reload --port 8001
```
Verify ML service:
```powershell
curl http://localhost:8001/health
```

### 4.4 Step 3: Seed and Start the Backend
In Terminal 2:
```powershell
cd backend
npm install
npm run seed      # Populates baseline history for core users (Varsha, Vikas, Shradha, Jawwad)
npm run dev       # Starts server on port 5050
```
Verify API:
```powershell
curl http://localhost:5050/api/health
```

### 4.5 Step 4: Start the Frontend SOC Dashboard
In Terminal 3:
```powershell
cd frontend
npm install
npm run dev       # Launches Vite dashboard on http://localhost:3000
```
Open **http://localhost:3000** in your browser.

---

## 5. Authorized Demonstration Accounts

The database is pre-seeded with realistic baseline behavior for the core employees:

| Role | Username | Password | Purpose |
|---|---|---|---|
| **SOC Administrator** | `admin` | `ChangeMe123!` | Full SOC Console access, alert acknowledgement |
| **Senior Engineer** | `barakervarsha990` | `EmployeeDemo123!` | Target for normal login, brute-force & ATO demos |
| **SOC Analyst** | `nsvikas19` | `EmployeeDemo123!` | Target for insider threat confidential burst demos |
| **Financial Analyst**| `shradhashirender` | `EmployeeDemo123!` | General monitored employee profile |
| **Systems Engineer** | `jawwadkmd` | `EmployeeDemo123!` | General monitored employee profile |

---

## 6. Testing & Demonstration Workflows

### 6.1 Automated Verification Test Suite
Run the comprehensive 13-test automated test suite:
```powershell
cd backend
node tests/test_sentinel_pipeline.js
```
This automatically tests and validates:
1. Successful authentication with valid credentials.
2. Failed login with incorrect password.
3. Repeated failed login attempts (brute-force burst).
4. Successful login following multiple failures (Account Takeover signature).
5. Login from previously unseen device.
6. Normal baseline activity (verified LOW risk, no alerts).
7. Security Alert generation on high-risk events.
8. Database persistence after application restart.
9. Live Socket.IO event emission.
10. Malformed / missing event metadata safe degradation.
11. Verification that passwords NEVER appear in logs or event records.
12. Dual ML model status and scoring.
13. Controlled file access and insider threat detection.

### 6.2 Interactive Browser-Based Live Demo
1. Log in to the SOC Console at **http://localhost:3000** as `admin` (`ChangeMe123!`).
2. Click **"Live Demo Portal"** in the sidebar (or top banner).
3. In the **Authentication & ATO** tab:
   - Click **"Sign In (Normal)"**: Generates normal login event. SOC dashboard updates with a green LOW risk indicator.
   - Click **"Launch Spray"**: Executes 4 rapid failed logins within seconds. Notice failure count escalation and brute-force alert.
   - Click **"Execute ATO"**: Simulates 3 failures followed by an attacker logging in from Moscow, Russia (Tor exit node, 03:15 AM). The Dual-Model ML engine flags a **CRITICAL** risk score (100/100) and an instant **Account Takeover Alert** appears on the screen in real time.
4. In the **Controlled Files** tab:
   - Click **"View"** or **"Download"** on `weekly_status_report.docx`: Demonstrates authorized normal access.
   - Click **"Simulate Confidential Data Spike"**: Accesses `employee_credentials.csv`, `customer_database.csv`, and `salary_data.xlsx` in rapid succession. Notice the **CRITICAL Insider Threat Alert** triggered immediately.
5. In the **Live ML Diagnostics** tab:
   - View the raw feature vector and exact Isolation Forest & Random Forest probabilities for the last evaluated event.

### 6.3 Command-Line Live Pipeline Runner
Run the interactive Python terminal demo:
```powershell
python run_live_demo.py
```
This triggers real HTTP requests against the running application and logs the live scores and alerts.

---

## 7. Real Capabilities, Heuristics & Production Limitations

To maintain academic and professional integrity, Sentinel clearly distinguishes its capabilities:

| Capability | Implementation Type | Description |
|---|---|---|
| **Real-Time Authentication Telemetry** | **Real / Production** | Captures real HTTP requests, hashes passwords with bcrypt, manages real sessions, and records full audit telemetry with unique UUIDs. |
| **Dual-Model ML Scoring** | **Real / Production** | Genuine `IsolationForest` (unsupervised anomaly detection) + `RandomForestClassifier` (supervised attack classification) serialized via `joblib`. |
| **Real-Time Socket.IO Streaming** | **Real / Production** | Live WebSocket broadcast pushes new events and alerts directly to connected dashboards without page reloads or CSV polling. |
| **Controlled File Auditing** | **Real / Application-Level** | Monitors views and downloads of physical files managed within the application (`backend/controlled_files/`). |
| **Operating System File Monitoring** | *Limitation* | Does **not** hook into arbitrary Windows/Linux OS kernel file access without dedicated OS agents (e.g. OSQuery or Windows Event Forwarding). |
| **IP Geolocation** | *Demo Approximation* | Uses sample geolocation mapping for demonstration. Includes documented extension points (`backend/utils/sampleGeoData.js`) to plug in MaxMind GeoIP2 or ipapi.co. |
| **External Platform Credentials** | *Policy / Boundary* | Sentinel strictly monitors systems you own or are authorized to audit. It does **not** scrape, intercept, or capture passwords from external third-party services (Instagram, Google, Facebook). |
| **Model Dataset Scale** | *Limitation* | Initial baseline profiles represent the 4 core demo users. Models are trained on baseline data blended with standard security attack vectors. For general-purpose production deployment, continuous online retraining with thousands of historical enterprise events is recommended. |
