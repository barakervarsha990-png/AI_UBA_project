import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import SeverityBadge from '../components/SeverityBadge';
import { useAlerts } from '../context/AlertContext';
import { Clock, MapPin, FileText, CheckCircle, ExternalLink, ShieldAlert } from 'lucide-react';

const statusOptions = ['open', 'acknowledged', 'resolved'];
const severityOptions = ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const incidentLabels = {
  account_takeover: 'Account Takeover (ATO)',
  brute_force: 'Brute Force Spray',
  impossible_travel: 'Impossible Travel / Off-Hours',
  insider_threat: 'Insider Threat Exfiltration',
  outside_working_hours: 'Outside Login Window',
  unauthorized_location: 'Unauthorized Location',
  bulk_file_download: 'Bulk File Download',
};

const AlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [resendingId, setResendingId] = useState(null);
  const [emailBanner, setEmailBanner] = useState(null);
  const { refreshTick } = useAlerts();

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (severityFilter) params.append('severity', severityFilter);
    params.append('limit', '100');

    try {
      const res = await api.get(`/alerts?${params.toString()}`);
      setAlerts(res.data.data);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  }, [statusFilter, severityFilter]);

  useEffect(() => {
    load();
  }, [load, refreshTick]);

  const updateStatus = async (id, status) => {
    await api.patch(`/alerts/${id}/status`, { status });
    load();
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setEmailBanner(null);
    try {
      const res = await api.post('/alerts/test-email', {});
      setEmailBanner({
        type: 'success',
        message: res.data.message || 'Test alert email sent successfully!',
        previewUrl: res.data.data?.previewUrl,
        recipient: res.data.data?.recipient,
      });
    } catch (err) {
      const data = err.response?.data;
      setEmailBanner({
        type: 'error',
        message: data?.message || err.message,
        hint: data?.hint,
      });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleResendEmail = async (alertId) => {
    setResendingId(alertId);
    try {
      const res = await api.post(`/alerts/${alertId}/resend-email`);
      setEmailBanner({
        type: res.data.success ? 'success' : 'error',
        message: res.data.message,
        previewUrl: res.data.data?.emailPreviewUrl,
        hint: res.data.hint,
      });
      load();
    } catch (err) {
      const data = err.response?.data;
      setEmailBanner({
        type: 'error',
        message: data?.message || err.message,
        hint: data?.hint,
      });
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="page-content">
      {emailBanner && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
            background: emailBanner.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${emailBanner.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
            color: emailBanner.type === 'success' ? '#065F46' : '#991B1B',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
          }}
        >
          <div>
            <strong>{emailBanner.type === 'success' ? '✅ Email Dispatch Verified: ' : '❌ Email Dispatch Failed: '}</strong>
            {emailBanner.message}
            {emailBanner.hint && (
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.9 }}>
                💡 <em>{emailBanner.hint}</em>
              </div>
            )}
            {emailBanner.previewUrl && (
              <div style={{ marginTop: 6 }}>
                <a
                  href={emailBanner.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#2563EB', textDecoration: 'underline', fontWeight: 600 }}
                >
                  View Accepted Email Preview Online &rarr;
                </a>
              </div>
            )}
          </div>
          <button
            onClick={() => setEmailBanner(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 16,
              marginLeft: 16,
            }}
          >
            &times;
          </button>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>Security Incident Alerts</div>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: 4 }}>
              Incident alerts triggered by Company Security Policy &amp; Dual ML Ensemble with automated Manager Email Dispatch.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline"
              onClick={handleTestEmail}
              disabled={testingEmail}
              style={{ fontSize: 12.5, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>{testingEmail ? '⏳ Dispatching...' : '✉️ Test Email Notification'}</span>
            </button>
            <select
              className="input"
              style={{ width: 140 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              className="input"
              style={{ width: 140 }}
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="">All severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Alert ID</th>
              <th>Time (Local/IST)</th>
              <th>Employee / User</th>
              <th>Incident Type</th>
              <th>Policy &amp; Detection Telemetry</th>
              <th>Risk Score</th>
              <th>Severity</th>
              <th>Manager Email</th>
              <th>SOC Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a._id}>
                <td className="mono-cell" style={{ fontWeight: 600 }}>{a.alertId || `ALT-${a._id.slice(-6).toUpperCase()}`}</td>
                <td className="mono-cell" style={{ fontSize: 11 }}>{new Date(a.createdAt).toLocaleString()}</td>
                <td style={{ fontWeight: 500 }}>
                  <div>{a.employeeName || a.username}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-mid)' }}>
                    {a.employeeId ? `${a.employeeId} · ` : ''}{a.username}
                  </div>
                </td>
                <td style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-hi)' }}>
                  {incidentLabels[a.type] || a.type}
                </td>
                <td style={{ fontSize: 11.5, color: 'var(--text-mid)', maxWidth: 280 }}>
                  {/* Detailed Policy Context */}
                  {a.expectedTimeWindow && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#B45309', marginBottom: 2 }}>
                      <Clock size={11} /> Expected: {a.expectedTimeWindow} · Actual: {a.actualTime || 'Outside Window'}
                    </div>
                  )}
                  {a.detectedLocation && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#DC2626', marginBottom: 2 }}>
                      <MapPin size={11} /> Expected: {a.expectedLocation || 'Bengaluru, India'} &rarr; Detected: {a.detectedLocation}
                    </div>
                  )}
                  {a.fileCount && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2563EB', marginBottom: 2 }}>
                      <FileText size={11} /> Files: {a.fileCount} in 5min {a.fileNames?.length ? `(${a.fileNames.slice(0, 2).join(', ')})` : ''}
                    </div>
                  )}
                  <div>{a.reasons?.slice(0, 2).join('; ') || 'Threshold breach'}</div>
                  {a.detectionSource && (
                    <div style={{ fontSize: 10, color: 'var(--text-low)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      Engine: {a.detectionSource.toUpperCase()}
                    </div>
                  )}
                </td>
                <td className="mono-cell" style={{ fontWeight: 600 }}>{a.riskScore}</td>
                <td><SeverityBadge level={a.severity} /></td>
                <td>
                  {a.emailStatus === 'sent' && (
                    <span
                      className="badge"
                      style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: 10.5 }}
                      title={`Delivered to: ${a.emailRecipient || 'Manager'}\nMessage ID: ${a.emailMessageId || 'N/A'}`}
                    >
                      ✓ SENT
                    </span>
                  )}
                  {a.emailStatus === 'ethereal' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span
                        className="badge"
                        style={{ background: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD', fontSize: 10.5 }}
                      >
                        ✓ ACCEPTED
                      </span>
                      {a.emailPreviewUrl && (
                        <a
                          href={a.emailPreviewUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 10, color: '#2563EB', textDecoration: 'underline' }}
                        >
                          View Email &rarr;
                        </a>
                      )}
                    </div>
                  )}
                  {a.emailStatus === 'simulated' && (
                    <span
                      className="badge"
                      style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', fontSize: 10.5 }}
                      title="SMTP credentials not set in backend/.env"
                    >
                      SIMULATED
                    </span>
                  )}
                  {a.emailStatus === 'failed' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        className="badge"
                        style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', fontSize: 10.5 }}
                        title={a.emailError || 'Email delivery failed'}
                      >
                        FAILED
                      </span>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '2px 6px', fontSize: 10 }}
                        onClick={() => handleResendEmail(a._id)}
                        disabled={resendingId === a._id}
                        title="Retry sending notification email"
                      >
                        {resendingId === a._id ? '...' : 'Retry'}
                      </button>
                    </div>
                  )}
                  {(!a.emailStatus || a.emailStatus === 'pending') && (
                    <span
                      className="badge"
                      style={{ background: '#FAF5FF', color: '#7E22CE', border: '1px solid #E9D5FF', fontSize: 10.5 }}
                    >
                      PENDING
                    </span>
                  )}
                </td>
                <td>
                  <select
                    className="input"
                    style={{
                      padding: '4px 8px',
                      fontSize: 11.5,
                      background: 'var(--bg-void)',
                      border: '1px solid var(--line)',
                    }}
                    value={a.status}
                    onChange={(e) => updateStatus(a._id, e.target.value)}
                  >
                    {statusOptions.map((st) => (
                      <option key={st} value={st}>
                        {st.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-low)' }}>
                  No incident alerts found matching criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AlertsPage;
