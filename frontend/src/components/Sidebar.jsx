import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  LogIn,
  FileText,
  Bell,
  ShieldAlert,
  MapPin,
  Settings,
  Radar,
  LogOut,
  Terminal,
  Briefcase,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const socLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/portal', label: 'Live Demo Portal', icon: Terminal },
  { to: '/users', label: 'Users Management', icon: Users },
  { to: '/login-activity', label: 'Login Activity', icon: LogIn },
  { to: '/file-activity', label: 'File Activity', icon: FileText },
  { to: '/alerts', label: 'Security Alerts', icon: Bell },
  { to: '/risk-analysis', label: 'Risk Analysis', icon: ShieldAlert },
  { to: '/location-activity', label: 'Location Activity', icon: MapPin },
  { to: '/settings', label: 'Settings & Policy', icon: Settings },
];

const employeeLinks = [
  { to: '/employee-portal', label: 'My Workspace', icon: Briefcase, end: true },
];

const Sidebar = () => {
  const { user, logout, isManagerOrAdmin } = useAuth();
  const links = isManagerOrAdmin ? socLinks : employeeLinks;

  const roleLabel =
    user?.role === 'admin'
      ? 'SOC ADMIN'
      : user?.role === 'manager'
      ? 'SECURITY MANAGER'
      : `EMPLOYEE (${user?.employeeId || 'STAFF'})`;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="dot" />
        <div className="sidebar-brand-text">
          SENTINEL
          <span>{isManagerOrAdmin ? 'BEHAVIOUR ANALYTICS' : 'EMPLOYEE PORTAL'}</span>
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
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 8 }}>
          <Radar size={16} color={isManagerOrAdmin ? '#4A90E2' : '#059669'} />
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.fullName || user?.username}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-low)', fontFamily: 'var(--font-mono)' }}>
              {roleLabel}
            </div>
          </div>
        </div>
        <div className="nav-link" onClick={logout} style={{ cursor: 'pointer' }}>
          <LogOut size={16} />
          Sign Out
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
