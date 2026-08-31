import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import SeverityBadge from '../components/SeverityBadge';
import { useAlerts } from '../context/AlertContext';

const statusOptions = ['open', 'acknowledged', 'resolved'];

const AlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const { refreshTick } = useAlerts();

  const load = useCallback(async () => {
    const q = statusFilter ? `?status=${statusFilter}` : '';
    const res = await api.get(`/alerts${q}`);
    setAlerts(res.data.data);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load, refreshTick]);

  const updateStatus = async (id, status) => {
    await api.patch(`/alerts/${id}/status`, { status });
    load();
  };

  return (
    <div className="page-content">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0 }}>Alerts</div>
          <select className="input" style={{ width: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Time</th><th>User</th><th>Type</th><th>Reasons</th><th>Risk</th><th>Severity</th><th>Status</th></tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a._id}>
                <td className="mono-cell">{new Date(a.createdAt).toLocaleString()}</td>
                <td>{a.username}</td>
                <td style={{ fontSize: 12 }}>{a.type === 'account_takeover' ? 'Account Takeover' : 'Insider Threat'}</td>
                <td style={{ fontSize: 11.5, color: 'var(--text-mid)', maxWidth: 260 }}>{a.reasons?.slice(0, 2).join('; ')}</td>
                <td className="mono-cell">{a.riskScore}</td>
                <td><SeverityBadge level={a.severity} /></td>
                <td>
                  <select
                    className="input"
                    style={{ padding: '4px 8px', fontSize: 11.5, width: 130 }}
                    value={a.status}
                    onChange={(e) => updateStatus(a._id, e.target.value)}
                  >
                    {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AlertsPage;
