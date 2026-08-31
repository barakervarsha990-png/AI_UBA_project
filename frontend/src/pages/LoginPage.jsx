import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radar, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await login(username, password);
    if (ok) navigate('/');
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-void)',
    }}>
      <div className="card" style={{ width: 380, padding: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Radar size={22} color="var(--signal-cyan)" />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>SENTINEL</span>
        </div>
        <div style={{ color: 'var(--text-mid)', fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 26 }}>
          BEHAVIOUR ANALYTICS · SOC CONSOLE
        </div>

        <form onSubmit={handleSubmit}>
          <label className="label-sm">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} style={{ marginBottom: 14 }} autoFocus />

          <label className="label-sm">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 20 }} />

          {error && <div style={{ color: 'var(--sev-critical)', fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            <Lock size={14} />
            {loading ? 'Authenticating…' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 20, fontSize: 11.5, color: 'var(--text-low)', fontFamily: 'var(--font-mono)' }}>
          Demo credentials come from your seeded .env (ADMIN_EMAIL / ADMIN_PASSWORD → username "admin").
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
