import { useEffect, useState } from 'react';
import api from '../services/api';
import SeverityBadge from '../components/SeverityBadge';

const LoginActivityPage = () => {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const params = filter === 'suspicious' ? '?suspicious=true&limit=100' : '?limit=100';
    api.get(`/login-events${params}`).then((res) => setEvents(res.data.data));
  }, [filter]);

  return (
    <div className="page-content">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0 }}>Login Activity</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ background: filter === 'all' ? 'var(--bg-void)' : undefined, borderColor: filter === 'all' ? 'var(--signal-cyan)' : undefined }} onClick={() => setFilter('all')}>All</button>
            <button className="btn" style={{ background: filter === 'suspicious' ? 'var(--bg-void)' : undefined, borderColor: filter === 'suspicious' ? 'var(--sev-critical)' : undefined }} onClick={() => setFilter('suspicious')}>Suspicious Only</button>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date/Time</th><th>User</th><th>Location</th><th>IP</th><th>Device</th><th>Status</th><th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e._id}>
                <td className="mono-cell">{e.date} {e.time}</td>
                <td>{e.username}</td>
                <td style={{ fontSize: 12 }}>{e.city}, {e.state}, {e.country}</td>
                <td className="mono-cell">{e.ipAddress}</td>
                <td style={{ fontSize: 12 }}>{e.device}</td>
                <td style={{ fontSize: 11.5, color: e.loginStatus === 'success' ? 'var(--signal-cyan)' : 'var(--sev-critical)' }}>{e.loginStatus}</td>
                <td><SeverityBadge level={e.riskLevel} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LoginActivityPage;
