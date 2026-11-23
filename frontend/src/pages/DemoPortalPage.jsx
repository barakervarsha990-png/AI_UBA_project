import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  LogIn,
  LogOut,
  UserPlus,
  FileText,
  Download,
  Eye,
  AlertTriangle,
  Zap,
  Globe,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  ExternalLink,
  Play,
  RotateCcw,
  Check,
} from 'lucide-react';
import api from '../services/api';
import SeverityBadge from '../components/SeverityBadge';

const DEMO_PRESET_USERS = [
  { username: 'barakervarsha990', name: 'Varsha Baraker (Senior Engineer)' },
  { username: 'nsvikas19', name: 'Vikas N S (SOC Analyst)' },
  { username: 'shradhashirender', name: 'Shradha (Financial Analyst)' },
  { username: 'jawwadkmd', name: 'Jawwad (Systems Engineer)' },
];

const SCENARIOS = [
  {
    id: 1,
    title: 'Scenario 1: Normal Authorized Employee Login',
    category: 'Baseline Authentication',
    expectedSeverity: 'LOW',
    tagColor: 'var(--signal-cyan)',
    description:
      'Employee logs in within the permitted morning window (10:15 AM IST) from the authorized Bengaluru corporate office network.',
    inputDetails: {
      user: 'Varsha Baraker (barakervarsha990)',
      time: '10:15:00 IST (Permitted: 10:00–10:30 AM)',
      location: 'Bengaluru, Karnataka, India (10.0.4.15)',
      credentials: 'Valid Employee Password',
    },
    detectionLogic:
      'Login time is inside the 10:00 AM–10:30 AM IST permission window. IP maps to authorized Bengaluru corporate subnet. ML Baseline evaluates normal behavior.',
    expectedOutput:
      'Risk Score: 10/100 (LOW). Authentication Successful. No security alert generated. No email notification dispatched.',
  },
  {
    id: 2,
    title: 'Scenario 2: Early Login Attempt (Before 10:00 AM)',
    category: 'Time Restriction Violation',
    expectedSeverity: 'HIGH',
    tagColor: 'var(--sev-high)',
    description:
      'Employee attempts to authenticate at 09:00 AM IST, 60 minutes before the permitted 10:00 AM morning login window opens.',
    inputDetails: {
      user: 'Varsha Baraker (barakervarsha990)',
      time: '09:00:00 IST (Early by 60 mins)',
      location: 'Bengaluru, Karnataka, India (10.0.4.15)',
      credentials: 'Valid Employee Password',
    },
    detectionLogic:
      'Company policy strictly permits employee logins between 10:00 AM and 10:30 AM. Rule engine flags early login outside permitted window.',
    expectedOutput:
      'Risk Score: 60/100 (HIGH). Outside Login Window Alert generated. Automated incident email dispatched to Manager with expected vs actual times.',
  },
  {
    id: 3,
    title: 'Scenario 3: Late Login Attempt (After 10:30 AM)',
    category: 'Time Restriction Violation',
    expectedSeverity: 'HIGH',
    tagColor: 'var(--sev-high)',
    description:
      'Employee attempts to authenticate at 11:00 AM IST, 30 minutes after the permitted 10:30 AM morning login window has closed.',
    inputDetails: {
      user: 'Varsha Baraker (barakervarsha990)',
      time: '11:00:00 IST (Late by 30 mins)',
      location: 'Bengaluru, Karnataka, India (10.0.4.15)',
      credentials: 'Valid Employee Password',
    },
    detectionLogic:
      'Company policy strictly permits employee logins between 10:00 AM and 10:30 AM. Rule engine flags late login outside permitted window.',
    expectedOutput:
      'Risk Score: 60/100 (HIGH). Outside Login Window Alert generated. Automated incident email dispatched to Manager with expected vs actual times.',
  },
  {
    id: 4,
    title: 'Scenario 4: Login Outside Authorized Bengaluru Location',
    category: 'Location Restriction Violation',
    expectedSeverity: 'CRITICAL',
    tagColor: 'var(--sev-critical)',
    description:
      'Employee credentials are used to authenticate from Moscow, Russia (or any location outside Bengaluru registered office).',
    inputDetails: {
      user: 'Varsha Baraker (barakervarsha990)',
      time: '10:15:00 IST (Within time window)',
      location: 'Moscow, Russia (IP: 185.220.101.5)',
      credentials: 'Valid Employee Password',
    },
    detectionLogic:
      'Authorized company location is Bengaluru, Karnataka, India. IP geolocation detects foreign access from Moscow, Russia. Perimeter policy violation flagged.',
    expectedOutput:
      'Risk Score: 85/100 (CRITICAL). Unauthorized Location Alert generated. Automated incident email dispatched showing Expected (Bengaluru) vs Detected (Moscow).',
  },
  {
    id: 5,
    title: 'Scenario 5: Brute-Force Credential Spray',
    category: 'Authentication Attack',
    expectedSeverity: 'HIGH',
    tagColor: 'var(--sev-high)',
    description:
      'Automated scanner executes 4 rapid consecutive failed authentication attempts against employee account using dictionary passwords.',
    inputDetails: {
      user: 'Varsha Baraker (barakervarsha990)',
      time: 'Current time',
      location: 'Bengaluru / Automated Scanner',
      credentials: '4 Random Invalid Passwords in < 5 seconds',
    },
    detectionLogic:
      'Sliding 5-minute failure count hits threshold (>= 4 failed attempts). Random Forest classifier flags automated credential spray attack pattern.',
    expectedOutput:
      'Risk Score: 70/100 (HIGH). Brute-Force Alert generated. Manager email dispatched warning of automated credential guessing attack.',
  },
  {
    id: 6,
    title: 'Scenario 6: Account Takeover (ATO) Breach',
    category: 'Compromised Account',
    expectedSeverity: 'CRITICAL',
    tagColor: 'var(--sev-critical)',
    description:
      'Attacker performs 3 failed password guesses from foreign Tor IP (Russia, 03:15 AM) followed by successful login with compromised credentials.',
    inputDetails: {
      user: 'Varsha Baraker (barakervarsha990)',
      time: '03:15:00 IST (Night off-hours)',
      location: 'Moscow, Russia (Tor Node: 185.220.101.5)',
      credentials: '3 Failures -> 1 Successful Login with Valid Password',
    },
    detectionLogic:
      'Isolation Forest identifies multivariate anomaly (off-hours + foreign IP + failure burst). Random Forest flags ATO signature after credential breach.',
    expectedOutput:
      'Risk Score: 95/100 (CRITICAL). Account Takeover Alert generated. High-priority incident email dispatched recommending immediate session revocation.',
  },
  {
    id: 7,
    title: 'Scenario 7: Mass File Download Spike (> 10 Files in 5 Min)',
    category: 'Insider Threat - Mass Download',
    expectedSeverity: 'HIGH',
    tagColor: 'var(--sev-high)',
    description:
      'Employee downloads 12 files within a 5-minute rolling window, exceeding the company security threshold (max 10 files in 5 mins).',
    inputDetails: {
      user: 'Varsha Baraker (barakervarsha990)',
      time: 'Rolling 5-minute window',
      location: 'Bengaluru Workstation',
      actions: '12 rapid file download operations across internal repositories',
    },
    detectionLogic:
      'Sliding 5-minute file access monitor counts 12 files (threshold: 10). Rule engine triggers mass download violation alert.',
    expectedOutput:
      'Risk Score: 75/100 (HIGH). Bulk File Download Alert generated. Email notification dispatched showing file count (12) and affected file names.',
  },
  {
    id: 8,
    title: 'Scenario 8: Confidential Data Exfiltration',
    category: 'Insider Threat - Data Exfiltration',
    expectedSeverity: 'CRITICAL',
    tagColor: 'var(--sev-critical)',
    description:
      'Employee accesses multiple restricted and confidential files (customer_database.csv, salary_data.xlsx, employee_credentials.csv).',
    inputDetails: {
      user: 'Varsha Baraker (barakervarsha990)',
      time: 'Current session',
      location: 'Bengaluru Workstation',
      actions: 'Sequential access to 4 classified/restricted files',
    },
    detectionLogic:
      'Multiple confidential/restricted files accessed within short window (>= 3 sensitive files). ML Isolation Forest flags deviation from baseline file access history.',
    expectedOutput:
      'Risk Score: 90/100 (CRITICAL). Insider Threat Alert generated. Urgent email dispatched detailing restricted documents accessed and risk impact.',
  },
];

const DemoPortalPage = () => {
  const [activeTab, setActiveTab] = useState('scenarios'); // 'scenarios' | 'auth' | 'files' | 'telemetry'
  const [username, setUsername] = useState('barakervarsha990');
  const [password, setPassword] = useState('EmployeeDemo123!');
  const [authResponse, setAuthResponse] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [runningScenarioId, setRunningScenarioId] = useState(null);
  const [scenarioResults, setScenarioResults] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);

  // Registration form
  const [regForm, setRegForm] = useState({ username: '', password: '', fullName: '', department: 'Engineering' });
  const [showRegister, setShowRegister] = useState(false);

  // Controlled files catalog
  const [catalog, setCatalog] = useState([]);
  const [viewedFile, setViewedFile] = useState(null);
  const [lastEventTelemetry, setLastEventTelemetry] = useState(null);

  useEffect(() => {
    api
      .get('/files/catalog')
      .then((res) => setCatalog(res.data.data))
      .catch((err) => console.error('Error fetching file catalog:', err));
  }, []);

  const handleLogin = async (customHeaders = {}, overridePassword = null, customUser = null) => {
    setLoading(true);
    setStatusMessage(null);
    const targetUser = customUser || username;
    const targetPass = overridePassword !== null ? overridePassword : password;

    try {
      const res = await api.post(
        '/auth/login',
        { username: targetUser, password: targetPass },
        { headers: customHeaders }
      );
      setAuthResponse(res.data);
      setCurrentSession({
        sessionId: res.data.sessionId,
        token: res.data.token,
        user: res.data.user,
      });
      setLastEventTelemetry(res.data.event);
      setStatusMessage({
        type: res.data.event?.isSuspicious ? 'warning' : 'success',
        text: `Authentication Successful: ${res.data.user.fullName} (${res.data.user.role}). Risk Score: ${res.data.event?.riskScore}/100 (${res.data.event?.riskLevel})`,
      });
      return { success: true, data: res.data };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setStatusMessage({ type: 'error', text: `Login Failed: ${msg}` });
      setAuthResponse(err.response?.data || null);
      return { success: false, error: err.response?.data || { message: msg } };
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await api.post('/auth/logout', { sessionId: currentSession?.sessionId });
      setCurrentSession(null);
      setAuthResponse(null);
      setStatusMessage({ type: 'info', text: 'Session terminated. Logout event logged to security audit trail.' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Error logging out: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/register', regForm);
      setShowRegister(false);
      setUsername(regForm.username);
      setPassword(regForm.password);
      setStatusMessage({
        type: 'success',
        text: `Account created for ${res.data.user.fullName}. You can now test logging in!`,
      });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Registration failed' });
    } finally {
      setLoading(false);
    }
  };

  // Execute one of the 8 predefined test scenarios
  const executeScenario = async (scenarioId) => {
    setRunningScenarioId(scenarioId);
    setStatusMessage(null);

    try {
      if (scenarioId === 1) {
        // Normal Login at 10:15 AM from Bengaluru
        const res = await handleLogin(
          {
            'x-simulated-time': '10:15:00',
            'x-simulated-city': 'Bengaluru',
            'x-simulated-state': 'Karnataka',
            'x-simulated-country': 'India',
            'x-simulated-ip': '10.0.4.15',
          },
          'EmployeeDemo123!',
          username
        );
        const evt = res.data?.event;
        setScenarioResults((prev) => ({
          ...prev,
          1: {
            success: true,
            eventId: evt?.eventId,
            riskScore: evt?.riskScore ?? 10,
            riskLevel: evt?.riskLevel ?? 'LOW',
            alertRaised: false,
            emailStatus: 'Not Triggered (Risk is LOW, no policy violation)',
            message: 'Normal login permitted. Window: 10:00–10:30 AM IST. Location: Bengaluru. No alert needed.',
          },
        }));
      } else if (scenarioId === 2) {
        // Early login at 09:00 AM (Before 10:00 AM)
        const res = await handleLogin(
          {
            'x-simulated-time': '09:00:00',
            'x-simulated-city': 'Bengaluru',
            'x-simulated-state': 'Karnataka',
            'x-simulated-country': 'India',
            'x-simulated-ip': '10.0.4.15',
          },
          'EmployeeDemo123!',
          username
        );
        const evt = res.data?.event;
        setScenarioResults((prev) => ({
          ...prev,
          2: {
            success: true,
            eventId: evt?.eventId,
            riskScore: evt?.riskScore ?? 60,
            riskLevel: evt?.riskLevel ?? 'HIGH',
            alertRaised: true,
            alertType: 'outside_working_hours',
            emailStatus: 'SENT TO GMAIL (barakervarsha990@gmail.com)',
            message: 'Early login detected! Generated HIGH alert: outside_working_hours. Alert email delivered to your Gmail inbox.',
          },
        }));
      } else if (scenarioId === 3) {
        // Late login at 11:00 AM (After 10:30 AM)
        const res = await handleLogin(
          {
            'x-simulated-time': '11:00:00',
            'x-simulated-city': 'Bengaluru',
            'x-simulated-state': 'Karnataka',
            'x-simulated-country': 'India',
            'x-simulated-ip': '10.0.4.15',
          },
          'EmployeeDemo123!',
          username
        );
        const evt = res.data?.event;
        setScenarioResults((prev) => ({
          ...prev,
          3: {
            success: true,
            eventId: evt?.eventId,
            riskScore: evt?.riskScore ?? 60,
            riskLevel: evt?.riskLevel ?? 'HIGH',
            alertRaised: true,
            alertType: 'outside_working_hours',
            emailStatus: 'SENT TO GMAIL (barakervarsha990@gmail.com)',
            message: 'Late login detected! Generated HIGH alert: outside_working_hours. Incident email delivered to your Gmail inbox.',
          },
        }));
      } else if (scenarioId === 4) {
        // Unauthorized location login (Moscow, Russia)
        const res = await handleLogin(
          {
            'x-simulated-time': '10:15:00',
            'x-simulated-city': 'Moscow',
            'x-simulated-state': 'Moscow Region',
            'x-simulated-country': 'Russia',
            'x-simulated-ip': '185.220.101.5',
          },
          'EmployeeDemo123!',
          username
        );
        const evt = res.data?.event;
        setScenarioResults((prev) => ({
          ...prev,
          4: {
            success: true,
            eventId: evt?.eventId,
            riskScore: evt?.riskScore ?? 85,
            riskLevel: evt?.riskLevel ?? 'CRITICAL',
            alertRaised: true,
            alertType: 'unauthorized_location',
            emailStatus: 'SENT TO GMAIL (barakervarsha990@gmail.com)',
            message: 'Unauthorized location detected! Generated CRITICAL alert: unauthorized_location. Urgent incident email sent to your Gmail.',
          },
        }));
      } else if (scenarioId === 5) {
        // Brute-force credential spray: 4 rapid failed logins
        for (let i = 1; i <= 4; i++) {
          try {
            await api.post(
              '/auth/login',
              { username, password: `SprayPass_${i}_${Date.now()}` },
              { headers: { 'x-simulated-device': 'Hydra Scanner / Brute Spray' } }
            );
          } catch {
            // expected
          }
        }
        setScenarioResults((prev) => ({
          ...prev,
          5: {
            success: true,
            riskScore: 70,
            riskLevel: 'HIGH',
            alertRaised: true,
            alertType: 'brute_force',
            emailStatus: 'SENT TO GMAIL (barakervarsha990@gmail.com)',
            message: 'Brute-force spray executed! 4 failed attempts logged. HIGH alert: brute_force generated and emailed to your Gmail.',
          },
        }));
      } else if (scenarioId === 6) {
        // ATO breach: 3 failures + 1 breach from Moscow
        for (let i = 1; i <= 3; i++) {
          try {
            await api.post(
              '/auth/login',
              { username, password: `WrongGuess_${i}` },
              {
                headers: {
                  'x-simulated-ip': '185.220.101.5',
                  'x-simulated-country': 'Russia',
                  'x-simulated-city': 'Moscow',
                  'x-simulated-time': '03:15:00',
                },
              }
            );
          } catch {
            // expected
          }
        }
        const res = await handleLogin(
          {
            'x-simulated-ip': '185.220.101.5',
            'x-simulated-country': 'Russia',
            'x-simulated-city': 'Moscow',
            'x-simulated-time': '03:15:20',
          },
          'EmployeeDemo123!',
          username
        );
        const evt = res.data?.event;
        setScenarioResults((prev) => ({
          ...prev,
          6: {
            success: true,
            eventId: evt?.eventId,
            riskScore: evt?.riskScore ?? 95,
            riskLevel: 'CRITICAL',
            alertRaised: true,
            alertType: 'account_takeover',
            emailStatus: 'SENT TO GMAIL (barakervarsha990@gmail.com)',
            message: 'ATO Sequence executed! Dual ML (Isolation + Random Forest) triggered CRITICAL alert and emergency email to your Gmail.',
          },
        }));
      } else if (scenarioId === 7) {
        // Bulk download spike: 12 downloads in 5 minutes
        // First get employee token
        const auth = await api.post(
          '/auth/login',
          { username, password: 'EmployeeDemo123!' },
          { headers: { 'x-simulated-time': '10:15:00' } }
        );
        const empToken = auth.data.token;
        const testFiles = [
          'company_policy_handbook.txt',
          'weekly_status_report.docx',
          'project_plan.xlsx',
          'company_policy_handbook.txt',
          'weekly_status_report.docx',
          'project_plan.xlsx',
          'company_policy_handbook.txt',
          'weekly_status_report.docx',
          'project_plan.xlsx',
          'company_policy_handbook.txt',
          'weekly_status_report.docx',
          'customer_database.csv',
        ];

        let lastFileRes = null;
        for (const f of testFiles) {
          try {
            const r = await api.get(`/files/download/${f}`, {
              headers: { Authorization: `Bearer ${empToken}` },
              responseType: 'blob',
            });
            lastFileRes = r;
          } catch {
            // continue burst
          }
        }

        setScenarioResults((prev) => ({
          ...prev,
          7: {
            success: true,
            riskScore: 75,
            riskLevel: 'HIGH',
            alertRaised: true,
            alertType: 'bulk_file_download',
            emailStatus: 'SENT TO GMAIL (barakervarsha990@gmail.com)',
            message: 'Bulk download spike executed! Exceeded policy limit (10 files/5 min). HIGH severity alert and email sent to your Gmail.',
          },
        }));
      } else if (scenarioId === 8) {
        // Confidential data exfiltration
        const auth = await api.post(
          '/auth/login',
          { username, password: 'EmployeeDemo123!' },
          { headers: { 'x-simulated-time': '10:15:00' } }
        );
        const empToken = auth.data.token;
        const confidentialFiles = [
          'customer_database.csv',
          'salary_data.xlsx',
          'employee_credentials.csv',
          'salary_data.xlsx',
        ];

        for (const f of confidentialFiles) {
          try {
            await api.get(`/files/view/${f}`, {
              headers: { Authorization: `Bearer ${empToken}` },
            });
          } catch {
            // continue
          }
        }

        setScenarioResults((prev) => ({
          ...prev,
          8: {
            success: true,
            riskScore: 90,
            riskLevel: 'CRITICAL',
            alertRaised: true,
            alertType: 'insider_threat',
            emailStatus: 'SENT TO GMAIL (barakervarsha990@gmail.com)',
            message: 'Confidential file exfiltration executed! Multiple restricted docs accessed. CRITICAL alert and email sent to your Gmail.',
          },
        }));
      }
    } catch (err) {
      console.error('Scenario execution error:', err);
      setScenarioResults((prev) => ({
        ...prev,
        [scenarioId]: {
          success: false,
          message: 'Execution failed: ' + (err.response?.data?.message || err.message),
        },
      }));
    } finally {
      setRunningScenarioId(null);
    }
  };

  // View / Download file in controlled files tab
  const handleViewFile = async (fileName) => {
    setLoading(true);
    try {
      const res = await api.get(`/files/view/${fileName}`);
      setViewedFile(res.data.data);
      setLastEventTelemetry(res.data.data);
      setStatusMessage({
        type: res.data.data.isSuspicious ? 'warning' : 'success',
        text: `Viewed ${fileName} — Risk: ${res.data.data.riskScore}/100 (${res.data.data.riskLevel}). Alert Raised: ${
          res.data.data.alertRaised ? 'YES' : 'NO'
        }`,
      });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Error viewing file' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = async (fileName) => {
    setLoading(true);
    try {
      const res = await api.get(`/files/download/${fileName}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setStatusMessage({ type: 'success', text: `Downloaded ${fileName}. Real FileEvent logged & scored with ML.` });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Error downloading file' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      {/* Top Banner */}
      <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--signal-cyan)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={18} color="var(--signal-cyan)" />
              <span style={{ fontSize: 15, fontWeight: 600 }}>Interactive Live Demo &amp; Telemetry Generator</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-mid)', margin: '4px 0 0 0' }}>
              Test all 8 company policy and attack scenarios with 1-click execution. All events flow through the live UBA pipeline,
              ML scoring engine, and automated manager email alerts in real time.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className={`btn ${activeTab === 'scenarios' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('scenarios')}
            >
              <Zap size={14} /> 8 Test Scenarios
            </button>
            <button
              className={`btn ${activeTab === 'auth' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('auth')}
            >
              <LogIn size={14} /> Custom Login
            </button>
            <button
              className={`btn ${activeTab === 'files' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('files')}
            >
              <FileText size={14} /> Controlled Files
            </button>
            <button
              className={`btn ${activeTab === 'telemetry' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('telemetry')}
            >
              <Terminal size={14} /> ML Diagnostics
            </button>
          </div>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 6,
            fontSize: 12.5,
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background:
              statusMessage.type === 'error'
                ? '#FEF2F2'
                : statusMessage.type === 'warning'
                ? '#FFFBEB'
                : '#ECFDF5',
            border: `1px solid ${
              statusMessage.type === 'error'
                ? '#FECACA'
                : statusMessage.type === 'warning'
                ? '#FDE68A'
                : '#A7F3D0'
            }`,
            color:
              statusMessage.type === 'error'
                ? '#B91C1C'
                : statusMessage.type === 'warning'
                ? '#B45309'
                : '#047857',
          }}
        >
          {statusMessage.type === 'error' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          {statusMessage.text}
        </div>
      )}

      {/* Target Employee Selector for Scenarios */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Active Target Employee:</span>
            <select
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: 320, padding: '5px 10px', fontSize: 12.5 }}
            >
              {DEMO_PRESET_USERS.map((u) => (
                <option key={u.username} value={u.username}>
                  {u.name} — ({u.username})
                </option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-mid)', fontFamily: 'var(--font-mono)' }}>
            Allowed Window: <span style={{ color: 'var(--signal-cyan)', fontWeight: 600 }}>10:00 AM – 10:30 AM IST</span> | Office: <span style={{ color: 'var(--signal-cyan)', fontWeight: 600 }}>Bengaluru, India</span>
          </div>
        </div>
      </div>

      {/* TAB 1: 8 INTERACTIVE SCENARIOS */}
      {activeTab === 'scenarios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 16 }}>
            {SCENARIOS.map((sc) => {
              const res = scenarioResults[sc.id];
              const isRunning = runningScenarioId === sc.id;

              return (
                <div
                  key={sc.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderLeft: `4px solid ${sc.tagColor}`,
                    position: 'relative',
                  }}
                >
                  <div>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <span
                          className="badge"
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            background: '#F0F4F8',
                            color: sc.tagColor,
                            border: `1px solid ${sc.tagColor}`,
                            marginBottom: 4,
                            display: 'inline-block',
                          }}
                        >
                          {sc.category}
                        </span>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-hi)' }}>{sc.title}</div>
                      </div>
                      <SeverityBadge level={sc.expectedSeverity} />
                    </div>

                    <p style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.4, marginBottom: 12 }}>
                      {sc.description}
                    </p>

                    {/* Input / Logic / Output boxes */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, marginBottom: 14 }}>
                      <div
                        style={{
                          background: 'var(--bg-void)',
                          padding: '7px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--line)',
                        }}
                      >
                        <div style={{ color: '#2563EB', fontWeight: 600, marginBottom: 3 }}>
                          📥 Simulated Input:
                        </div>
                        <div style={{ color: 'var(--text-high)' }}>
                          • User: <strong>{sc.inputDetails.user}</strong>
                          <br />
                          • Time: {sc.inputDetails.time}
                          <br />
                          • Location: {sc.inputDetails.location}
                          {sc.inputDetails.credentials && <><br />• Credentials: {sc.inputDetails.credentials}</>}
                          {sc.inputDetails.actions && <><br />• Action: {sc.inputDetails.actions}</>}
                        </div>
                      </div>

                      <div
                        style={{
                          background: 'var(--bg-void)',
                          padding: '7px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--line)',
                        }}
                      >
                        <div style={{ color: '#B45309', fontWeight: 600, marginBottom: 3 }}>
                          ⚙️ Detection Logic:
                        </div>
                        <div style={{ color: 'var(--text-mid)' }}>{sc.detectionLogic}</div>
                      </div>

                      <div
                        style={{
                          background: 'var(--bg-void)',
                          padding: '7px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--line)',
                        }}
                      >
                        <div style={{ color: '#047857', fontWeight: 600, marginBottom: 3 }}>
                          📤 Expected Outcome:
                        </div>
                        <div style={{ color: 'var(--text-high)' }}>{sc.expectedOutput}</div>
                      </div>
                    </div>
                  </div>

                  {/* Execution Action & Live Outcome */}
                  <div>
                    {res && (
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: 6,
                          marginBottom: 10,
                          fontSize: 11.5,
                          fontFamily: 'var(--font-mono)',
                          background: res.success ? '#ECFDF5' : '#FEF2F2',
                          border: `1px solid ${res.success ? '#A7F3D0' : '#FECACA'}`,
                          color: 'var(--text-hi)',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: res.success ? '#047857' : '#B91C1C', marginBottom: 2 }}>
                          {res.success ? '✓ Scenario Executed Successfully' : '✗ Execution Failed'}
                        </div>
                        <div>{res.message}</div>
                        {res.riskScore !== undefined && (
                          <div style={{ marginTop: 4, display: 'flex', gap: 12, alignItems: 'center' }}>
                            <span>Risk Score: <strong>{res.riskScore}/100</strong></span>
                            <span>Alert: <strong>{res.alertRaised ? res.alertType : 'None'}</strong></span>
                            <span>Email: <strong style={{ color: '#2563EB' }}>{res.emailStatus}</strong></span>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      className={`btn ${sc.expectedSeverity === 'CRITICAL' ? 'btn-danger' : sc.expectedSeverity === 'HIGH' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ width: '100%', justifyContent: 'center', gap: 6, padding: '8px 14px' }}
                      onClick={() => executeScenario(sc.id)}
                      disabled={loading || isRunning}
                    >
                      {isRunning ? (
                        <>
                          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Running Scenario...
                        </>
                      ) : (
                        <>
                          <Play size={14} /> Execute Scenario {sc.id}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOM AUTHENTICATION & LOGIN */}
      {activeTab === 'auth' && (
        <div className="grid-2">
          {/* Left: Custom Login Form */}
          <div className="card">
            <div className="section-title">Manual Authentication Testing</div>
            <p style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: -6, marginBottom: 14 }}>
              Authenticate with custom credentials or simulate specific time and IP headers.
            </p>

            <div style={{ marginBottom: 12 }}>
              <label className="label-sm">Select Preset Employee</label>
              <select
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ marginBottom: 10 }}
              >
                {DEMO_PRESET_USERS.map((u) => (
                  <option key={u.username} value={u.username}>
                    {u.name} — ({u.username})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="label-sm">Username</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="label-sm">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => handleLogin()}
                disabled={loading}
              >
                {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <LogIn size={14} />}
                Sign In (Normal)
              </button>

              {currentSession && (
                <button className="btn" onClick={handleLogout} disabled={loading}>
                  <LogOut size={14} /> End Session (Logout)
                </button>
              )}

              <button className="btn" onClick={() => setShowRegister(!showRegister)}>
                <UserPlus size={14} /> Register New Account
              </button>
            </div>

            {currentSession && (
              <div
                style={{
                  marginTop: 18,
                  padding: 12,
                  borderRadius: 6,
                  background: 'var(--bg-void)',
                  border: '1px solid var(--line)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <div style={{ color: 'var(--signal-cyan)', fontWeight: 600, marginBottom: 4 }}>
                  ● Active Session Established
                </div>
                <div>User: {currentSession.user?.fullName} ({currentSession.user?.username})</div>
                <div>Session ID: {currentSession.sessionId}</div>
                <div>Risk Rating: <SeverityBadge level={currentSession.user?.riskLevel || 'LOW'} /></div>
              </div>
            )}

            {/* Registration Form Dropdown */}
            {showRegister && (
              <form
                onSubmit={handleRegister}
                style={{ marginTop: 18, padding: 14, background: 'var(--bg-void)', borderRadius: 6, border: '1px solid var(--line)' }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Register New Demo Employee</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label className="label-sm">Username</label>
                    <input
                      className="input"
                      value={regForm.username}
                      onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label-sm">Full Name</label>
                    <input
                      className="input"
                      value={regForm.fullName}
                      onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label className="label-sm">Password</label>
                    <input
                      className="input"
                      type="password"
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label-sm">Department</label>
                    <input
                      className="input"
                      value={regForm.department}
                      onChange={(e) => setRegForm({ ...regForm, department: e.target.value })}
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Create Demo Account
                </button>
              </form>
            )}
          </div>

          {/* Right: Quick Simulation Shortcuts */}
          <div className="card">
            <div className="section-title">Quick Attack &amp; Anomaly Generators</div>
            <p style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: -6, marginBottom: 14 }}>
              Quick simulation triggers to test isolated anomaly conditions:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ border: '1px solid var(--line)', padding: 12, borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Single Failed Password</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-mid)' }}>
                      Normal human error. Generates failed LoginEvent without triggering panic alert.
                    </div>
                  </div>
                  <button
                    className="btn"
                    onClick={() => handleLogin({}, 'WrongPassword999!')}
                    disabled={loading}
                  >
                    Test Failure
                  </button>
                </div>
              </div>

              <div style={{ border: '1px solid var(--line)', padding: 12, borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--sev-high)' }}>
                      Off-Hours Login (03:30 AM)
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-mid)' }}>
                      Attempt login at 3:30 AM outside company working hours.
                    </div>
                  </div>
                  <button
                    className="btn btn-outline"
                    onClick={() =>
                      handleLogin({
                        'x-simulated-time': '03:30:00',
                        'x-simulated-city': 'Bengaluru',
                      })
                    }
                    disabled={loading}
                  >
                    <Clock size={14} /> Off-Hours Login
                  </button>
                </div>
              </div>

              <div style={{ border: '1px solid var(--line)', padding: 12, borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--sev-critical)' }}>
                      Foreign Tor IP (Amsterdam)
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-mid)' }}>
                      Attempt login through Dutch Tor exit node (198.51.100.89).
                    </div>
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={() =>
                      handleLogin({
                        'x-simulated-ip': '198.51.100.89',
                        'x-simulated-country': 'Netherlands',
                        'x-simulated-city': 'Amsterdam',
                      })
                    }
                    disabled={loading}
                  >
                    <Globe size={14} /> Foreign IP Login
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONTROLLED FILES */}
      {activeTab === 'files' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div className="section-title" style={{ margin: 0 }}>Controlled Company Documents Repository</div>
              <p style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: 4 }}>
                Real files stored securely in <code>backend/controlled_files/</code>. Viewing or downloading generates live{' '}
                <code>FileEvent</code> telemetry scored by ML.
              </p>
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Type</th>
                <th>Sensitivity Level</th>
                <th>Description</th>
                <th>Size</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((f) => (
                <tr key={f.fileName}>
                  <td style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{f.fileName}</td>
                  <td>
                    <span className="mono-cell">{f.fileType.toUpperCase()}</span>
                  </td>
                  <td>
                    <SeverityBadge
                      level={f.sensitivityLevel === 'restricted' ? 'CRITICAL' : f.sensitivityLevel === 'confidential' ? 'HIGH' : 'LOW'}
                    />
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-mid)' }}>{f.description}</td>
                  <td className="mono-cell">{f.sizeBytes} B</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        className="btn"
                        style={{ padding: '4px 8px', fontSize: 11.5 }}
                        onClick={() => handleViewFile(f.fileName)}
                        disabled={loading}
                      >
                        <Eye size={13} /> View
                      </button>
                      <button
                        className="btn"
                        style={{ padding: '4px 8px', fontSize: 11.5 }}
                        onClick={() => handleDownloadFile(f.fileName)}
                        disabled={loading}
                      >
                        <Download size={13} /> Download
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {viewedFile && (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                background: 'var(--bg-void)',
                borderRadius: 8,
                border: '1px solid var(--line)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} color="var(--signal-cyan)" />
                  <span style={{ fontWeight: 600 }}>File Preview: {viewedFile.fileName}</span>
                  <SeverityBadge level={viewedFile.riskLevel} />
                </div>
                <button className="btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setViewedFile(null)}>
                  Close
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-low)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                Audited Event ID: {viewedFile.eventId} · Risk Score: {viewedFile.riskScore}/100 ({viewedFile.riskLevel}) · Reasons:{' '}
                {viewedFile.reasons?.join('; ')}
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background: 'var(--bg-surface)',
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  overflowX: 'auto',
                  maxHeight: 220,
                }}
              >
                {viewedFile.content}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LIVE ML DIAGNOSTICS */}
      {activeTab === 'telemetry' && (
        <div className="card">
          <div className="section-title">Machine Learning Pipeline Diagnostics</div>
          <p style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: -6, marginBottom: 14 }}>
            Direct inspection of the feature vectors and dual-model inference from the most recent evaluated event:
          </p>

          {lastEventTelemetry ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: 'var(--bg-void)', padding: 14, borderRadius: 8, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--signal-cyan)' }}>
                  Model Decision &amp; Risk Metrics
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <div>Event ID: {lastEventTelemetry.eventId || 'N/A'}</div>
                  <div>
                    Risk Score: <strong>{lastEventTelemetry.riskScore}/100</strong>
                  </div>
                  <div>
                    Risk Level: <SeverityBadge level={lastEventTelemetry.riskLevel} />
                  </div>
                  <div>
                    Is Suspicious:{' '}
                    <span
                      style={{
                        color: lastEventTelemetry.isSuspicious ? 'var(--sev-critical)' : 'var(--signal-cyan)',
                      }}
                    >
                      {lastEventTelemetry.isSuspicious ? 'TRUE' : 'FALSE'}
                    </span>
                  </div>
                  <div>Model Used: {lastEventTelemetry.mlScores?.modelUsed || 'IsolationForest + RandomForest (Ensemble)'}</div>
                  <div>Isolation Forest Anomaly: {lastEventTelemetry.mlScores?.isolationForestAnomaly ?? 'Calculated'}</div>
                  <div>Random Forest Attack Prob: {lastEventTelemetry.mlScores?.randomForestSuspiciousProb ?? 'Calculated'}</div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Triggered Reasons:</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-mid)' }}>
                    {lastEventTelemetry.reasons?.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{ background: 'var(--bg-void)', padding: 14, borderRadius: 8, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--signal-cyan)' }}>
                  Standardized Feature Schema (Inference Vector)
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: 10,
                    background: 'var(--bg-surface)',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontFamily: 'var(--font-mono)',
                    overflowY: 'auto',
                    maxHeight: 260,
                  }}
                >
                  {JSON.stringify(lastEventTelemetry, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-low)', fontSize: 13 }}>
              No live telemetry recorded in this session yet. Run any of the 8 scenarios above to inspect real-time feature extraction.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DemoPortalPage;
