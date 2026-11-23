import { useEffect, useState } from 'react';
import api from '../services/api';
import SeverityBadge from '../components/SeverityBadge';
import { Clock, MapPin, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';

const LoginActivityPage = () => {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let url = '/login-events?limit=100';
    if (filter === 'suspicious') url += '&suspicious=true';
    else if (filter === 'failed') url += '&status=failed';
    else if (filter === 'outside_window') url += '&outsideWindow=true';
    else if (filter === 'unauthorized_location') url += '&unauthorizedLocation=true';
    else if (filter === 'permitted_window') url += '&permittedWindow=true';

    api.get(url).then((res) => setEvents(res.data.data));
  }, [filter]);

  return (
    <div className="page-content">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>Authentication Event Telemetry</div>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: 4 }}>
              Immutable audit stream of all valid, failed, and suspicious login attempts with policy enforcement details.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              style={{
                background: filter === 'all' ? 'var(--bg-void)' : undefined,
                borderColor: filter === 'all' ? 'var(--signal-cyan)' : undefined,
              }}
              onClick={() => setFilter('all')}
            >
              All Events
            </button>
            <button
              className="btn"
              style={{
                background: filter === 'permitted_window' ? 'rgba(51, 230, 201, 0.15)' : undefined,
                borderColor: filter === 'permitted_window' ? 'var(--signal-cyan)' : undefined,
                color: filter === 'permitted_window' ? 'var(--signal-cyan)' : undefined,
              }}
              onClick={() => setFilter('permitted_window')}
            >
              <Clock size={13} /> 10:00–10:30 Permitted
            </button>
            <button
              className="btn"
              style={{
                background: filter === 'outside_window' ? '#FFFBEB' : undefined,
                borderColor: filter === 'outside_window' ? '#F59E0B' : undefined,
                color: filter === 'outside_window' ? '#B45309' : undefined,
              }}
              onClick={() => setFilter('outside_window')}
            >
              <Clock size={13} /> Outside Window
            </button>
            <button
              className="btn"
              style={{
                background: filter === 'unauthorized_location' ? '#FEF2F2' : undefined,
                borderColor: filter === 'unauthorized_location' ? '#DC2626' : undefined,
                color: filter === 'unauthorized_location' ? '#DC2626' : undefined,
              }}
              onClick={() => setFilter('unauthorized_location')}
            >
              <MapPin size={13} /> Outside Bengaluru
            </button>
            <button
              className="btn"
              style={{
                background: filter === 'suspicious' ? '#FFF7ED' : undefined,
                borderColor: filter === 'suspicious' ? '#EA580C' : undefined,
                color: filter === 'suspicious' ? '#C2410C' : undefined,
              }}
              onClick={() => setFilter('suspicious')}
            >
              Suspicious Only
            </button>
            <button
              className="btn"
              style={{
                background: filter === 'failed' ? '#FEF2F2' : undefined,
                borderColor: filter === 'failed' ? '#DC2626' : undefined,
                color: filter === 'failed' ? '#DC2626' : undefined,
              }}
              onClick={() => setFilter('failed')}
            >
              Failed Attempts
            </button>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Event ID</th>
              <th>Date / Time (IST)</th>
              <th>Employee / User</th>
              <th>Auth Status</th>
              <th>Time Window Policy</th>
              <th>Geographic Location</th>
              <th>Source IP</th>
              <th>Device / Agent</th>
              <th>Reasons / Telemetry</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e._id}>
                <td className="mono-cell" style={{ fontSize: 11, color: 'var(--text-low)' }}>
                  {e.eventId ? e.eventId.slice(0, 14) + '…' : e._id.slice(-8)}
                </td>
                <td className="mono-cell">{e.date} {e.time}</td>
                <td style={{ fontWeight: 500 }}>
                  <div>{e.employeeName || e.username}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-mid)' }}>{e.username}</div>
                </td>
                <td>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontFamily: 'var(--font-mono)',
                      background: e.loginStatus === 'success' ? '#ECFDF5' : '#FEF2F2',
                      color: e.loginStatus === 'success' ? '#047857' : '#DC2626',
                      border: `1px solid ${e.loginStatus === 'success' ? '#A7F3D0' : '#FECACA'}`,
                    }}
                  >
                    {e.eventType === 'logout' ? 'LOGOUT' : e.loginStatus.toUpperCase()}
                  </span>
                </td>
                <td>
                  {e.isTimeUnauthorized ? (
                    <span
                      className="badge"
                      style={{ background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', fontSize: 10.5 }}
                      title={`Expected: ${e.expectedTimeWindow || '10:00 AM–10:30 AM'}\nActual: ${e.actualLoginTime || e.time}`}
                    >
                      OUTSIDE WINDOW ({e.actualLoginTime || e.time})
                    </span>
                  ) : e.timePolicyStatus === 'permitted_window' ? (
                    <span
                      className="badge"
                      style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: 10.5 }}
                    >
                      ✓ 10:00–10:30 AM
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-low)' }}>
                      {e.userRole === 'admin' || e.userRole === 'manager' ? 'EXEMPT (SOC)' : 'STANDARD'}
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin
                      size={12}
                      color={e.isLocationUnauthorized ? 'var(--sev-critical)' : 'var(--signal-cyan)'}
                    />
                    <span>{e.city ? `${e.city}, ${e.country}` : 'Location unavailable'}</span>
                  </div>
                  {e.isLocationUnauthorized && (
                    <div style={{ fontSize: 10, color: 'var(--sev-critical)', marginTop: 2 }}>
                      UNAUTHORIZED PERIMETER
                    </div>
                  )}
                </td>
                <td className="mono-cell">{e.ipAddress}</td>
                <td style={{ fontSize: 11.5, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.device}
                </td>
                <td style={{ fontSize: 11, color: 'var(--text-mid)', maxWidth: 200 }}>
                  {e.failureReasonCategory && (
                    <span style={{ color: 'var(--sev-high)', fontWeight: 600 }}>
                      [{e.failureReasonCategory}]&nbsp;
                    </span>
                  )}
                  {e.reasons?.slice(0, 2).join('; ') || 'Normal telemetry'}
                </td>
                <td><SeverityBadge level={e.riskLevel} /></td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 30, color: 'var(--text-low)' }}>
                  No login telemetry events recorded matching selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LoginActivityPage;
