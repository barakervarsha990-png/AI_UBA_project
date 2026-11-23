import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AlertToastStack from './components/AlertToastStack';
import ProtectedRoute from './components/ProtectedRoute';
import { AlertProvider } from './context/AlertContext';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import UserDetailsPage from './pages/UserDetailsPage';
import LoginActivityPage from './pages/LoginActivityPage';
import FileActivityPage from './pages/FileActivityPage';
import AlertsPage from './pages/AlertsPage';
import RiskAnalysisPage from './pages/RiskAnalysisPage';
import LocationActivityPage from './pages/LocationActivityPage';
import SettingsPage from './pages/SettingsPage';
import DemoPortalPage from './pages/DemoPortalPage';
import EmployeePortalPage from './pages/EmployeePortalPage';
import { useAuth } from './context/AuthContext';

const pageTitles = {
  '/': ['SOC Dashboard', 'REAL-TIME BEHAVIOUR & COMPANY POLICY OVERVIEW'],
  '/portal': ['Live Demo & Attack Simulator', 'POLICY & THREAT SCENARIO SUITE'],
  '/users': ['Users Management', 'MONITORED EMPLOYEE DIRECTORY'],
  '/login-activity': ['Login Activity', 'AUTHENTICATION & POLICY TELEMETRY'],
  '/file-activity': ['File Activity', 'DATA ACCESS & BULK DOWNLOAD MONITOR'],
  '/alerts': ['Security Incident Alerts', 'POLICY VIOLATION & THREAT INCIDENTS'],
  '/risk-analysis': ['Risk Analysis', 'UBA ANOMALY & POLICY SCORING ENGINE'],
  '/location-activity': ['Location Activity', 'BENGALURU RESTRICTION & GEOGRAPHIC DISTRIBUTION'],
  '/settings': ['Settings & Policy', 'WORKING TIME, LOCATION & SMTP CONFIGURATION'],
  '/employee-portal': ['Employee Workspace', 'AUTHORIZED ACCESS & PERSONAL ACTIVITY'],
};

const AppShell = ({ children }) => {
  const path = window.location.pathname.replace(/\/users\/.+/, '/users');
  const [title, sub] = pageTitles[path] || ['SENTINEL UBA', 'SECURITY OPERATIONS CONSOLE'];

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <div className="topbar">
          <div>
            <div className="topbar-title">{title}</div>
            <div className="topbar-sub">{sub}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-low)', fontFamily: 'var(--font-mono)' }}>
            <span className="pulse-dot" style={{ width: 6, height: 6 }} />
            LIVE &bull; ASIA/KOLKATA
          </div>
        </div>
        {children}
      </div>
    </div>
  );
};

const App = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Employee dedicated portal route */}
      <Route
        path="/employee-portal"
        element={
          <ProtectedRoute>
            <AlertProvider>
              <AppShell>
                <EmployeePortalPage />
              </AppShell>
            </AlertProvider>
          </ProtectedRoute>
        }
      />

      {/* SOC Manager / Admin Routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute requireManager={true}>
            <AlertProvider>
              <AppShell>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/portal" element={<DemoPortalPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/users/:id" element={<UserDetailsPage />} />
                  <Route path="/login-activity" element={<LoginActivityPage />} />
                  <Route path="/file-activity" element={<FileActivityPage />} />
                  <Route path="/alerts" element={<AlertsPage />} />
                  <Route path="/risk-analysis" element={<RiskAnalysisPage />} />
                  <Route path="/location-activity" element={<LocationActivityPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
              <AlertToastStack />
            </AlertProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default App;
