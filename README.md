# SENTINEL — AI-Driven User Behaviour Analytics for Insider Threat & Account Takeover Detection

A full-stack Security Operations Center (SOC) platform that monitors employee login and file-access
behaviour, builds a per-user behavioural baseline, and uses an Isolation Forest anomaly-detection model
(blended with rule-based signals) to score every event 0–100 and flag possible **account takeover** or
**insider threat** activity in real time.

> Built for authorized, defensive security monitoring only. Includes audit logging, JWT auth, and
> role-based access; no real credentials, API keys, or secrets are hard-coded anywhere in this codebase.

---

## 1. Architecture

```
insider-threat-detection/
├── backend/          Node.js + Express API, MongoDB (Mongoose), Socket.IO, Nodemailer, JWT auth
├── ml-service/        Python FastAPI + Scikit-learn Isolation Forest anomaly scoring
├── frontend/           React (Vite) SOC dashboard, Socket.IO client, Recharts
├── docker-compose.yml  Runs all four services (Mongo, ML service, backend, frontend) together
└── README.md
```

**Data flow:** Login/simulated event → backend builds a feature payload from the user's baseline →
calls the FastAPI ML service (`/score/login` or `/score/file`) → Isolation Forest + rule-based scoring
returns a 0–100 risk score, level, and reasons → backend stores the event → if HIGH/CRITICAL, an Alert
is created, broadcast over Socket.IO to the dashboard instantly, and emailed to the security admin via
Nodemailer. If the ML service is unreachable, the backend falls back to an equivalent local rule-based
scorer so the app keeps working.

### Risk levels
| Score | Level | Alert + Email? |
|---|---|---|
| 0–29 | LOW | No |
| 30–49 | MEDIUM | No |
| 50–74 | HIGH | Yes |
| 75–100 | CRITICAL | Yes |

---

## 2. Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB (local install or Docker)
- (Optional) Docker + Docker Compose for one-command startup

---

## 3. Quick Start — Docker (recommended for demo)

```bash
cd insider-threat-detection

# Copy env files and fill in real values (SMTP, JWT secret, admin password)
cp backend/.env.example backend/.env
cp ml-service/.env.example ml-service/.env
cp frontend/.env.example frontend/.env

docker compose up --build
```

Then, in a separate terminal, seed the database (run once, against the running backend container's Mongo):

```bash
docker compose exec backend npm run seed
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- ML service: http://localhost:8001

Login with username `admin` and the password you set as `ADMIN_PASSWORD` in `backend/.env`.

---

## 4. Manual Setup (without Docker)

### 4.1 MongoDB
Make sure MongoDB is running locally (`mongod`) or point `MONGO_URI` in `backend/.env` at a remote instance
(e.g. MongoDB Atlas).

### 4.2 ML Service (FastAPI)
```bash
cd ml-service
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8001
```
Verify: `curl http://localhost:8001/health`

### 4.3 Backend (Node/Express)
```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set MONGO_URI, JWT_SECRET, SMTP_*, ADMIN_EMAIL, ADMIN_PASSWORD, ML_SERVICE_URL
npm run seed     # populates demo data (10 users, 50+ logins, 100+ file events, alerts)
npm run dev      # starts on http://localhost:5000
```

### 4.4 Frontend (React/Vite)
```bash
cd frontend
npm install
cp .env.example .env
npm run dev      # starts on http://localhost:3000
```

Log in with username `admin` and the password from `backend/.env` (`ADMIN_PASSWORD`).

---

## 5. Environment Variables

All secrets are loaded from `.env` files (never hard-coded). See `backend/.env.example`,
`ml-service/.env.example`, and `frontend/.env.example` for the full list. Key ones:

| File | Variable | Purpose |
|---|---|---|
| backend/.env | `MONGO_URI` | MongoDB connection string |
| backend/.env | `JWT_SECRET` | Signs admin auth tokens |
| backend/.env | `SMTP_HOST/PORT/USER/PASS` | Nodemailer email alerts |
| backend/.env | `ALERT_EMAIL_TO` | Security admin inbox for alerts |
| backend/.env | `ML_SERVICE_URL` | FastAPI ML service endpoint |
| backend/.env | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Used only by the seed script to create the admin account |
| frontend/.env | `VITE_API_URL` / `VITE_SOCKET_URL` | Backend API and Socket.IO URLs |

**Nodemailer note:** if SMTP credentials are not configured, the backend logs alert emails to the
console instead of failing — useful for local demos without a real mailbox.

---

## 6. Demonstrating the System (no real attack required)

1. Log in to the dashboard as `admin`.
2. On the **Dashboard** page (or a specific user's **User Details** page), use the **Demo Simulations** card:
   - **Simulate Unauthorized Login** — generates a login from a new country, new device, and new IP at
     2:30 AM, scores it against the target user's baseline, and (if HIGH/CRITICAL) raises an alert,
     pushes it to the dashboard instantly via Socket.IO, and emails the security admin.
   - **Simulate Insider Threat** — generates 20–30 rapid confidential-file access events
     (`employee_credentials.csv`, `customer_database.csv`, `salary_data.xlsx`) for the target user,
     scores the burst against their normal daily file-access baseline, and raises an alert the same way.
3. Watch the **Alerts** page and the real-time toast notification appear immediately.
4. Check the **User Details** page for the affected employee to see the full event trail and reasons.

---

## 7. API Overview

All routes except `/api/auth/login` and `/api/health` require `Authorization: Bearer <JWT>`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Admin login, returns JWT |
| GET | `/api/auth/me` | Current admin profile |
| GET | `/api/dashboard/summary` | Top-line SOC metrics |
| GET | `/api/dashboard/login-activity` | 14-day login volume trend |
| GET | `/api/dashboard/risk-trends` | 14-day average risk score trend |
| GET | `/api/dashboard/location-activity` | Login counts grouped by location |
| GET | `/api/dashboard/file-activity` | File events grouped by action/sensitivity |
| GET | `/api/users` | List all monitored employees |
| GET | `/api/users/:id` | Employee profile, baseline, recent events, alerts |
| GET | `/api/login-events?suspicious=true` | Login event log |
| GET | `/api/file-events?suspicious=true` | File event log |
| GET | `/api/alerts?status=open` | Alert list |
| PATCH | `/api/alerts/:id/status` | Update alert status (open/acknowledged/resolved) |
| POST | `/api/simulate/account-takeover` | Trigger ATO demo (body: `{ userId? }`) |
| POST | `/api/simulate/insider-threat` | Trigger insider-threat demo (body: `{ userId? }`) |

ML service (internal, called by backend):
| Method | Route |
|---|---|
| POST | `/score/login` |
| POST | `/score/file` |

---

## 8. Security Controls Implemented

- JWT authentication with expiry; bcrypt password hashing (10 salt rounds)
- Helmet HTTP security headers, CORS restricted to the configured client origin
- Express-rate-limit on all API routes, stricter limit on `/auth/login`
- Input validation via `express-validator`
- Audit log collection (`AuditLog`) recording admin logins, simulations, and alert status changes
- No secrets committed to source: all credentials come from `.env` files (`.env` is gitignored;
  only `.env.example` files are tracked)
- Approximate/sample IP geolocation is used for the demo, with a clear extension point
  (`backend/utils/sampleGeoData.js`) to plug in a real IP-geolocation API and provider key later

---

## 9. Extending to Production

- Replace `backend/utils/sampleGeoData.js` with a real IP-geolocation API call (e.g. MaxMind GeoIP2,
  ipapi.co) behind the same `getRandomLocation`-style interface.
- Persist per-user historical feature vectors and periodically retrain the Isolation Forest
  (`ml-service/model.py`) instead of fitting a synthetic-normal distribution per request.
- Add a scheduled job (e.g. `node-cron`) to call `baselineService.recalculateBaseline()` nightly per user.
- Move admin/employee identity to your real SSO/IdP; keep JWT for internal service-to-service calls only.
- Add TLS termination (reverse proxy / load balancer) in front of all three services in production.

---

## 10. Tech Stack

- **Frontend:** React 18, Vite, React Router, Recharts, Socket.IO client, lucide-react
- **Backend:** Node.js, Express, Mongoose, Socket.IO, Nodemailer, JWT, bcryptjs, Helmet, express-rate-limit
- **ML Service:** Python, FastAPI, Scikit-learn (IsolationForest), NumPy, Pydantic
- **Database:** MongoDB
- **Infra:** Docker, Docker Compose, Nginx (frontend serving)
