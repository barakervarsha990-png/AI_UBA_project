import { Routes, Route } from 'react-router-dom';
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
import { useAuth } from './context/AuthContext';

const pageTitles = {
  '/': ['Dashboard', 'REAL-TIME BEHAVIOUR OVERVIEW'],
  '/users': ['Users', 'MONITORED EMPLOYEE ACCOUNTS'],
  '/login-activity': ['Login Activity', 'AUTHENTICATION TELEMETRY'],
  '/file-activity': ['File Activity', 'CONFIDENTIAL DATA ACCESS LOG'],
  '/alerts': ['Alerts', 'DETECTED THREAT EVENTS'],
  '/risk-analysis': ['Risk Analysis', 'ANOMALY SCORING BREAKDOWN'],
  '/location-activity': ['Location Activity', 'GEOGRAPHIC LOGIN DISTRIBUTION'],
  '/settings': ['Settings', 'SYSTEM CONFIGURATION'],
};

const AppShell = ({ children }) => {
  const path = window.location.pathname.replace(/\/users\/.+/, '/users');
  const [title, sub] = pageTitles[path] || ['SENTINEL', 'SOC CONSOLE'];

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
            LIVE
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
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AlertProvider>
              <AppShell>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/users/:id" element={<UserDetailsPage />} />
                  <Route path="/login-activity" element={<LoginActivityPage />} />
                  <Route path="/file-activity" element={<FileActivityPage />} />
                  <Route path="/alerts" element={<AlertsPage />} />
                  <Route path="/risk-analysis" element={<RiskAnalysisPage />} />
                  <Route path="/location-activity" element={<LocationActivityPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
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
