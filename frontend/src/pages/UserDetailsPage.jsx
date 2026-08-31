import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import SeverityBadge from '../components/SeverityBadge';
import SimulateButtons from '../components/SimulateButtons';

const UserDetailsPage = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const res = await api.get(`/users/${id}`);
    setData(res.data.data);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="page-content">Loading…</div>;
  const { user, baseline, recentLogins, recentFiles, alerts } = data;

  return (
    <div className="page-content">
      <div className="grid-2" style={{ marginBottom: 16, alignItems: 'start' }}>
        <div className="card">
          <div className="section-title">Employee Profile</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            <div><span className="label-sm">Employee ID</span><div className="mono">{user.employeeId}</div></div>
            <div><span className="label-sm">Username</span><div className="mono">{user.username}</div></div>
            <div><span className="label-sm">Full Name</span><div>{user.fullName}</div></div>
            <div><span className="label-sm">Email</span><div className="mono">{user.email}</div></div>
            <div><span className="label-sm">Department</span><div>{user.department}</div></div>
            <div><span className="label-sm">Job Title</span><div>{user.jobTitle}</div></div>
            <div><span className="label-sm">Status</span><div>{user.status}</div></div>
            <div><span className="label-sm">Risk Level</span><SeverityBadge level={user.riskLevel} /></div>
          </div>

          {baseline && (
            <>
              <hr className="divider" />
              <div className="section-title" style={{ fontSize: 13 }}>Behaviour Baseline</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12.5 }}>
                <div><span className="label-sm">Normal Countries</span><div>{baseline.normalCountries.join(', ') || '—'}</div></div>
                <div><span className="label-sm">Normal Devices</span><div style={{ fontSize: 11.5 }}>{baseline.normalDevices.join(', ') || '—'}</div></div>
                <div><span className="label-sm">Typical Login Hours</span><div className="mono">{baseline.typicalLoginHourStart}:00 – {baseline.typicalLoginHourEnd}:00</div></div>
                <div><span className="label-sm">Avg Files/Day</span><div className="mono">{baseline.avgFilesAccessedPerDay}</div></div>
                <div><span className="label-sm">Max Files/Day</span><div className="mono">{baseline.maxFilesAccessedPerDay}</div></div>
                <div><span className="label-sm">Avg Confidential Files/Day</span><div className="mono">{baseline.avgConfidentialFilesPerDay}</div></div>
              </div>
            </>
          )}
        </div>

        <SimulateButtons userId={user._id} onDone={load} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Recent Login Events</div>
        <table className="data-table">
          <thead><tr><th>Date/Time</th><th>Location</th><th>IP</th><th>Device</th><th>Risk</th></tr></thead>
          <tbody>
            {recentLogins.map((l) => (
              <tr key={l._id}>
                <td className="mono-cell">{l.date} {l.time}</td>
                <td>{l.city}, {l.state}, {l.country}</td>
                <td className="mono-cell">{l.ipAddress}</td>
                <td style={{ fontSize: 12 }}>{l.device}</td>
                <td><SeverityBadge level={l.riskLevel} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Recent File Access Events</div>
        <table className="data-table">
          <thead><tr><th>Date/Time</th><th>File</th><th>Sensitivity</th><th>Action</th><th>Risk</th></tr></thead>
          <tbody>
            {recentFiles.map((f) => (
              <tr key={f._id}>
                <td className="mono-cell">{f.date} {f.time}</td>
                <td className="mono-cell">{f.fileName}</td>
                <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{f.sensitivityLevel}</td>
                <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{f.action}</td>
                <td><SeverityBadge level={f.riskLevel} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="section-title">Alert History</div>
        <table className="data-table">
          <thead><tr><th>Time</th><th>Type</th><th>Reasons</th><th>Severity</th><th>Status</th></tr></thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a._id}>
                <td className="mono-cell">{a.time}</td>
                <td style={{ fontSize: 12 }}>{a.type === 'account_takeover' ? 'Account Takeover' : 'Insider Threat'}</td>
                <td style={{ fontSize: 11.5, color: 'var(--text-mid)' }}>{a.reasons?.slice(0, 2).join('; ')}</td>
                <td><SeverityBadge level={a.severity} /></td>
                <td style={{ fontSize: 11.5, textTransform: 'capitalize' }}>{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserDetailsPage;
