import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  LogIn,
  ShieldAlert,
  FileText,
  TriangleAlert,
  Flame,
  BellRing,
  Radio,
  CheckCircle,
  XCircle,
  Terminal,
  Activity,
  Check,
  MapPin,
  Clock,
  UserCheck,
  AlertOctagon,
  BarChart3,
  Layers,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import api from '../services/api';
import StatCard from '../components/StatCard';
import SeverityBadge from '../components/SeverityBadge';
import SimulateButtons from '../components/SimulateButtons';
import { useAlerts } from '../context/AlertContext';

const chartTooltipStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 8,
  fontSize: 12,
  color: '#26374A',
  boxShadow: '0 4px 6px -1px rgba(38, 55, 74, 0.08)',
};

const RISK_COLORS = {
  LOW: '#059669',
  MEDIUM: '#D97706',
  HIGH: '#EA580C',
  CRITICAL: '#DC2626',
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [hourlyActivity, setHourlyActivity] = useState([]);
  const [suspiciousCategories, setSuspiciousCategories] = useState([]);
  const [locationActivity, setLocationActivity] = useState([]);
  const [fileStats, setFileStats] = useState({ byAction: [], bySensitivity: [], bulkDownloadsCount: 0 });
  const [riskDistribution, setRiskDistribution] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [ackLoading, setAckLoading] = useState(null);
  const { refreshTick } = useAlerts();

  const load = useCallback(async () => {
    try {
      const [
        sumRes,
        hourlyRes,
        suspRes,
        locRes,
        fileRes,
        riskDistRes,
        alertsRes,
      ] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/login-activity-by-time'),
        api.get('/dashboard/suspicious-logins'),
        api.get('/dashboard/location-activity'),
        api.get('/dashboard/file-activity'),
        api.get('/dashboard/risk-distribution'),
        api.get('/alerts?limit=8'),
      ]);

      setSummary(sumRes.data.data);
      setHourlyActivity(hourlyRes.data.data || []);
      setSuspiciousCategories(suspRes.data.data || []);
      setLocationActivity(locRes.data.data || []);
      setFileStats(fileRes.data.data || { byAction: [], bySensitivity: [], bulkDownloadsCount: 0 });
      setRiskDistribution(riskDistRes.data.data || []);
      setRecentAlerts(alertsRes.data.data || []);
    } catch (err) {
      console.error('Error loading dashboard analytics:', err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshTick]);

  const handleAcknowledge = async (alertId) => {
    setAckLoading(alertId);
    try {
      await api.patch(`/alerts/${alertId}/status`, { status: 'acknowledged' });
      load();
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    } finally {
      setAckLoading(null);
    }
  };

  if (!summary) return <div className="page-content">Loading live SOC telemetry and UBA metrics…</div>;

  return (
    <div className="page-content">
      {/* Top Banner / Live Link */}
      <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--signal-cyan)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="pulse-dot" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                Real-Time UBA Pipeline Active · Dual-Model ML (Isolation Forest + Random Forest)
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-mid)', fontFamily: 'var(--font-mono)' }}>
                Policy Enforced: Login Permitted 10:00–10:30 AM IST · Office: Bengaluru, India · File Threshold: 10/5min
              </div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/portal')}>
            <Terminal size={14} /> Open Live Demo Portal
          </button>
        </div>
      </div>

      {/* SECTION 1: ALL 11 REQUIRED STAT CARDS */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mid)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Company Overview &amp; Incident Metrics (11 Core SOC Telemetry Indicators)
        </div>
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 12 }}>
          <StatCard label="Total Employees" value={summary.totalEmployees ?? summary.totalUsers} icon={Users} />
          <StatCard label="Active Employees" value={summary.activeEmployees ?? 0} icon={UserCheck} accent="var(--signal-cyan)" />
          <StatCard label="Total Login Attempts" value={summary.totalLoginAttempts ?? summary.loginAttempts} icon={LogIn} />
          <StatCard label="Successful Logins" value={summary.successfulLogins ?? 0} icon={CheckCircle} accent="var(--signal-cyan)" />
          <StatCard label="Failed Logins" value={summary.failedLogins ?? 0} icon={XCircle} accent="var(--sev-critical)" />
          <StatCard label="Suspicious Logins" value={summary.suspiciousLogins} icon={ShieldAlert} accent="var(--sev-high)" />
          <StatCard label="Unauthorized Locations" value={summary.unauthorizedLocationLogins ?? 0} icon={MapPin} accent="var(--sev-critical)" />
          <StatCard label="Suspicious File Events" value={summary.suspiciousFileAccessEvents ?? 0} icon={FileText} accent="var(--sev-high)" />
          <StatCard label="High-Risk Employees" value={summary.highRiskEmployees ?? summary.highRiskUsers} icon={TriangleAlert} accent="var(--sev-high)" />
          <StatCard label="Critical Alerts" value={summary.criticalAlerts} icon={Flame} accent="var(--sev-critical)" />
          <StatCard label="Open Alerts" value={summary.openAlerts} icon={BellRing} accent="var(--sev-medium)" />
        </div>
      </div>

      {/* SECTION 2: 5 REQUIRED CHARTS */}

      {/* Chart 1: Hourly Login Activity (00:00–23:00) with Highlighted 10:00–10:30 Window */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>
              Hourly Login Activity &amp; Permitted Window Telemetry (00:00–23:00 IST)
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: 4 }}>
              Highlights company permitted employee login window (<strong>10:00 AM – 10:30 AM IST</strong>) in cyan. Logins outside this window trigger policy alerts.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, background: 'var(--signal-cyan)', borderRadius: 2 }} />
              Permitted Window (10:00–10:30 AM)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, background: 'var(--primary)', borderRadius: 2 }} />
              Regular Hourly Volume
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, background: 'var(--sev-critical)', borderRadius: 2 }} />
              Suspicious / Outside Window
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={hourlyActivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: 'var(--text-low)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'var(--text-low)', fontSize: 10 }} allowDecimals={false} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(val, name, item) => {
                if (name === 'Total Logins' && item.payload.isPermittedLoginHour) {
                  return [`${val} (Permitted Employee Window: 10:00–10:30 AM)`, name];
                }
                return [val, name];
              }}
            />
            <Bar dataKey="total" name="Total Logins" radius={[3, 3, 0, 0]}>
              {hourlyActivity.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isPermittedLoginHour ? 'var(--signal-cyan)' : 'var(--primary)'}
                  stroke={entry.isPermittedLoginHour ? 'var(--text-hi)' : undefined}
                  strokeWidth={entry.isPermittedLoginHour ? 1.5 : 0}
                />
              ))}
            </Bar>
            <Bar dataKey="outsideWindow" name="Outside Permitted Window" fill="var(--sev-critical)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Row 2: Charts 2 & 3 */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Chart 2: Suspicious Logins by Category */}
        <div className="card">
          <div className="section-title">Suspicious Logins by Category</div>
          <div style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: -6, marginBottom: 12 }}>
            Classification breakdown across policy and credential violation categories:
          </div>

          <ResponsiveContainer width="100%" height={210}>
            <BarChart
              layout="vertical"
              data={suspiciousCategories.filter((c) => c.category !== 'Normal')}
              margin={{ top: 5, right: 20, left: 35, bottom: 5 }}
            >
              <CartesianGrid stroke="var(--line)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-low)', fontSize: 10 }} allowDecimals={false} />
              <YAxis dataKey="category" type="category" tick={{ fill: 'var(--text-high)', fontSize: 11 }} width={120} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" name="Violations" radius={[0, 4, 4, 0]}>
                {suspiciousCategories.map((entry, index) => {
                  let fill = '#EA580C';
                  if (entry.category === 'Outside Login Window') fill = '#D97706';
                  if (entry.category === 'Unauthorized Location') fill = '#DC2626';
                  if (entry.category === 'Authentication Failure') fill = '#E11D48';
                  return <Cell key={`susp-${index}`} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Location-Based Login Activity (Bengaluru vs Outside) */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div className="section-title" style={{ margin: 0 }}>Location-Based Login Activity</div>
            <span
              className="badge"
              style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: 10.5 }}
            >
              Authorized: Bengaluru, India
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 12 }}>
            Geographic distribution of observed authentication events:
          </div>

          <div style={{ maxHeight: 210, overflowY: 'auto' }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Detected City / Region</th>
                  <th>Country</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {locationActivity.map((loc, idx) => {
                  const city = loc._id.city || 'Unknown';
                  const country = loc._id.country || 'Unknown';
                  const isAuth = ['Bengaluru', 'Bangalore'].includes(city) && country === 'India';

                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: isAuth ? 600 : 500 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <MapPin size={12} color={isAuth ? 'var(--signal-cyan)' : 'var(--sev-critical)'} />
                          {city}
                        </span>
                      </td>
                      <td>{country}</td>
                      <td className="mono-cell">{loc.count}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            fontSize: 10,
                            background: isAuth ? '#ECFDF5' : '#FEF2F2',
                            color: isAuth ? '#047857' : '#B91C1C',
                            border: `1px solid ${isAuth ? '#A7F3D0' : '#FECACA'}`,
                          }}
                        >
                          {isAuth ? 'AUTHORIZED' : 'UNAUTHORIZED'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3: Charts 4 & 5 */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Chart 4: File Access Activity (By Action & Sensitivity) */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div className="section-title" style={{ margin: 0 }}>File Access Activity &amp; Insider Threat</div>
            {fileStats.bulkDownloadsCount > 0 && (
              <span
                className="badge"
                style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', fontSize: 10.5 }}
              >
                {fileStats.bulkDownloadsCount} Mass Downloads Detected (&gt;10/5min)
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 10 }}>
            Audited file interactions categorized by sensitivity classification:
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={fileStats.bySensitivity.map((s) => ({
                sensitivity: s._id.toUpperCase(),
                count: s.count,
              }))}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="sensitivity" tick={{ fill: 'var(--text-low)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-low)', fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" name="Files Accessed" radius={[3, 3, 0, 0]}>
                {fileStats.bySensitivity.map((entry, index) => {
                  let fill = 'var(--primary)';
                  if (entry._id === 'confidential') fill = '#EA580C';
                  if (entry._id === 'restricted') fill = '#DC2626';
                  if (entry._id === 'public') fill = 'var(--signal-cyan)';
                  return <Cell key={`sens-${index}`} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 5: Employee Risk Distribution */}
        <div className="card">
          <div className="section-title">Employee Risk Distribution (0–100 Scale)</div>
          <div style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: -6, marginBottom: 10 }}>
            Active workforce categorized across standard UBA risk severity tiers:
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={riskDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="level" tick={{ fill: 'var(--text-low)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-low)', fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(val, name, item) => {
                  let tierDesc = '';
                  if (item.payload.level === 'LOW') tierDesc = ' (Score: 0–29)';
                  if (item.payload.level === 'MEDIUM') tierDesc = ' (Score: 30–49)';
                  if (item.payload.level === 'HIGH') tierDesc = ' (Score: 50–79)';
                  if (item.payload.level === 'CRITICAL') tierDesc = ' (Score: 80–100)';
                  return [`${val} Employees${tierDesc}`, 'Count'];
                }}
              />
              <Bar dataKey="count" name="Employees" radius={[3, 3, 0, 0]}>
                {riskDistribution.map((entry, index) => (
                  <Cell key={`risk-${index}`} fill={RISK_COLORS[entry.level] || '#33E6C9'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 3: RECENT SECURITY INCIDENTS & ACTIONS */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={16} color="var(--signal-cyan)" />
            <div className="section-title" style={{ margin: 0 }}>Recent Incident Alerts &amp; SOC Dispatches</div>
          </div>
          <button className="btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => navigate('/alerts')}>
            View All Incident Alerts &rarr;
          </button>
        </div>

        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Alert ID</th>
                <th>Employee / User</th>
                <th>Incident Type</th>
                <th>Detected Reasons</th>
                <th>Risk Score</th>
                <th>Severity</th>
                <th>Email Delivery</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recentAlerts.map((a) => (
                <tr key={a._id}>
                  <td className="mono-cell" style={{ fontWeight: 600 }}>{a.alertId || `ALT-${a._id.slice(-6).toUpperCase()}`}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{a.employeeName || a.username}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-mid)' }}>{a.username}</div>
                  </td>
                  <td style={{ fontSize: 12, fontWeight: 500 }}>
                    {a.type === 'outside_working_hours'
                      ? 'Outside Login Window'
                      : a.type === 'unauthorized_location'
                      ? 'Unauthorized Location'
                      : a.type === 'bulk_file_download'
                      ? 'Bulk File Download'
                      : a.type === 'account_takeover'
                      ? 'Account Takeover'
                      : a.type === 'brute_force'
                      ? 'Brute Force Spray'
                      : a.type}
                  </td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-mid)', maxWidth: 220 }}>
                    {a.reasons?.slice(0, 2).join('; ') || 'Threshold exceeded'}
                  </td>
                  <td className="mono-cell" style={{ fontWeight: 600 }}>{a.riskScore}</td>
                  <td><SeverityBadge level={a.severity} /></td>
                  <td>
                    {a.emailStatus === 'sent' && (
                      <span className="badge" style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: 10 }}>
                        ✓ SENT
                      </span>
                    )}
                    {a.emailStatus === 'ethereal' && (
                      <span className="badge" style={{ background: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD', fontSize: 10 }}>
                        ✓ ACCEPTED
                      </span>
                    )}
                    {a.emailStatus === 'failed' && (
                      <span className="badge" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', fontSize: 10 }}>
                        FAILED
                      </span>
                    )}
                    {(!a.emailStatus || a.emailStatus === 'pending') && (
                      <span className="badge" style={{ background: '#FAF5FF', color: '#7E22CE', border: '1px solid #E9D5FF', fontSize: 10 }}>
                        PENDING
                      </span>
                    )}
                  </td>
                  <td>
                    {a.status === 'open' ? (
                      <button
                        className="btn"
                        style={{ padding: '2px 6px', fontSize: 10.5 }}
                        onClick={() => handleAcknowledge(a._id)}
                        disabled={ackLoading === a._id}
                      >
                        <Check size={11} /> Ack
                      </button>
                    ) : (
                      <span style={{ fontSize: 10.5, color: 'var(--text-low)', fontFamily: 'var(--font-mono)' }}>{a.status}</span>
                    )}
                  </td>
                </tr>
              ))}
              {recentAlerts.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 20, color: 'var(--text-low)' }}>
                    No security alerts currently active. System operating normally.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: REAL-TIME TELEMETRY FEED */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} color="var(--signal-cyan)" />
            <div className="section-title" style={{ margin: 0 }}>Live Real-Time Telemetry Stream</div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-low)', fontFamily: 'var(--font-mono)' }}>Auto-updating via WebSockets</span>
        </div>

        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Employee / User</th>
                <th>Operation / Result</th>
                <th>Location / IP</th>
                <th>Risk Score</th>
              </tr>
            </thead>
            <tbody>
              {(summary.recentEvents || []).map((e, idx) => (
                <tr key={e._id || idx}>
                  <td className="mono-cell">{e.date} {e.time}</td>
                  <td>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10.5,
                        fontFamily: 'var(--font-mono)',
                        background: e.feedType === 'login' ? 'var(--secondary)' : '#FEF3C7',
                        color: e.feedType === 'login' ? 'var(--text-hi)' : '#92400E',
                        border: `1px solid ${e.feedType === 'login' ? 'var(--primary)' : '#FDE68A'}`,
                      }}
                    >
                      {e.feedType === 'login' ? 'AUTH' : 'FILE'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{e.employeeName || e.username}</td>
                  <td style={{ fontSize: 12 }}>{e.title}</td>
                  <td style={{ fontSize: 11.5 }}>{e.city ? `${e.city}, ${e.country}` : e.location || e.ipAddress}</td>
                  <td><SeverityBadge level={e.riskLevel} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SimulateButtons onDone={load} />
    </div>
  );
};

export default DashboardPage;
