import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, LogIn, FileText, Bell, ShieldAlert, MapPin, Settings, Radar, LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/login-activity', label: 'Login Activity', icon: LogIn },
  { to: '/file-activity', label: 'File Activity', icon: FileText },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/risk-analysis', label: 'Risk Analysis', icon: ShieldAlert },
  { to: '/location-activity', label: 'Location Activity', icon: MapPin },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const Sidebar = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="dot" />
        <div className="sidebar-brand-text">
          SENTINEL
          <span>BEHAVIOUR ANALYTICS</span>
        </div>
      </div>

      <nav>
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 8 }}>
          <Radar size={15} color="var(--signal-cyan)" />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>{user?.fullName}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-low)', fontFamily: 'var(--font-mono)' }}>SOC ADMIN</div>
          </div>
        </div>
        <div className="nav-link" onClick={logout} style={{ cursor: 'pointer' }}>
          <LogOut />
          Sign Out
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
