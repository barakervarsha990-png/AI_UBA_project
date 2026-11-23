import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radar, Lock, UserCheck, Shield, Briefcase } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('ChangeMe123!');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await login(username, password);
    if (res.success) {
      if (res.user.role === 'employee') {
        navigate('/employee-portal');
      } else {
        navigate('/');
      }
    }
  };

  const setPreset = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main, #FFFDF5)',
        padding: 20,
      }}
    >
      <div className="card" style={{ width: 440, padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Radar size={24} color="#5B9BD5" />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: 0.5 }}>
            SENTINEL
          </span>
        </div>
        <div style={{ color: 'var(--text-mid)', fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 20 }}>
          AI-DRIVEN USER BEHAVIOUR ANALYTICS (UBA)
        </div>

        <div
          style={{
            background: 'var(--secondary, #DCEAF7)',
            border: '1px solid var(--primary, #A7C7E7)',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 20,
            fontSize: 12,
            color: 'var(--text-hi, #26374A)',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-hi, #26374A)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏢 Company Policy Notice:</span>
          </div>
          <div>Permitted Employee Login: <strong>10:00 AM – 10:30 AM IST</strong></div>
          <div>Authorized Location: <strong>Bengaluru, Karnataka, India</strong></div>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="label-sm" style={{ display: 'block', marginBottom: 4 }}>
            Username
          </label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', marginBottom: 14 }}
            placeholder="Username"
            autoFocus
            required
          />

          <label className="label-sm" style={{ display: 'block', marginBottom: 4 }}>
            Password
          </label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', marginBottom: 16 }}
            placeholder="••••••••••••"
            required
          />

          {error && (
            <div
              style={{
                color: '#B91C1C',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 12.5,
                marginBottom: 16,
                lineHeight: 1.4,
              }}
            >
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: 13.5 }}
          >
            <Lock size={15} />
            {loading ? 'Authenticating & Verifying Policy…' : 'Sign In'}
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--line, #E5E7EB)' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-low)', letterSpacing: 0.5, marginBottom: 8, fontWeight: 600 }}>
            Quick Demo Account Select:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: 11.5, padding: '5px 10px', justifyContent: 'flex-start', textAlign: 'left' }}
              onClick={() => setPreset('admin', 'ChangeMe123!')}
            >
              <Shield size={13} color="#2563EB" />
              <span><strong>SOC Administrator</strong> (admin / ChangeMe123!)</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: 11.5, padding: '5px 10px', justifyContent: 'flex-start', textAlign: 'left' }}
              onClick={() => setPreset('manager', 'ManagerDemo123!')}
            >
              <Briefcase size={13} color="#7C3AED" />
              <span><strong>Security Manager</strong> (manager / ManagerDemo123!)</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: 11.5, padding: '5px 10px', justifyContent: 'flex-start', textAlign: 'left' }}
              onClick={() => setPreset('barakervarsha990', 'EmployeeDemo123!')}
            >
              <UserCheck size={13} color="#059669" />
              <span><strong>Employee: Varsha Baraker</strong> (barakervarsha990 / EmployeeDemo123!)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
