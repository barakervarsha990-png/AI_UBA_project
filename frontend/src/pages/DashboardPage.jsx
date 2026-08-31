import { useEffect, useState, useCallback } from 'react';
import { Users, UserCheck, LogIn, ShieldAlert, FileText, TriangleAlert, Flame, BellRing } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../services/api';
import StatCard from '../components/StatCard';
import SeverityBadge from '../components/SeverityBadge';
import SimulateButtons from '../components/SimulateButtons';
import { useAlerts } from '../context/AlertContext';

const chartTooltipStyle = {
  background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12,
};

const DashboardPage = () => {
  const [summary, setSummary] = useState(null);
  const [loginTrend, setLoginTrend] = useState([]);
  const [riskTrends, setRiskTrends] = useState({ loginTrend: [], fileTrend: [] });
  const [recentAlerts, setRecentAlerts] = useState([]);
  const { refreshTick } = useAlerts();

  const load = useCallback(async () => {
    const [s, la, rt, al] = await Promise.all([
      api.get('/dashboard/summary'),
      api.get('/dashboard/login-activity'),
      api.get('/dashboard/risk-trends'),
      api.get('/alerts?limit=8'),
    ]);
    setSummary(s.data.data);
    setLoginTrend(la.data.data);
    setRiskTrends(rt.data.data);
    setRecentAlerts(al.data.data);
  }, []);

  useEffect(() => { load(); }, [load, refreshTick]);

  if (!summary) return <div className="page-content">Loading dashboard…</div>;

  return (
    <div className="page-content">
      <div className="stat-grid">
        <StatCard label="Total Users" value={summary.totalUsers} icon={Users} />
        <StatCard label="Active Users" value={summary.activeUsers} icon={UserCheck} accent="var(--signal-cyan)" />
        <StatCard label="Login Attempts" value={summary.loginAttempts} icon={LogIn} />
        <StatCard label="Suspicious Logins" value={summary.suspiciousLogins} icon={ShieldAlert} accent="var(--sev-high)" />
        <StatCard label="File Events" value={summary.fileEvents} icon={FileText} />
        <StatCard label="High-Risk Users" value={summary.highRiskUsers} icon={TriangleAlert} accent="var(--sev-high)" />
        <StatCard label="Critical Alerts" value={summary.criticalAlerts} icon={Flame} accent="var(--sev-critical)" />
        <StatCard label="Open Alerts" value={summary.openAlerts} icon={BellRing} accent="var(--sev-medium)" />
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="section-title">Login Activity (14 days)</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={loginTrend}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#33E6C9" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#33E6C9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="_id" tick={{ fill: 'var(--text-low)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-low)', fontSize: 10 }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="total" stroke="#33E6C9" fill="url(#totalGrad)" strokeWidth={2} name="Total Logins" />
              <Line type="monotone" dataKey="suspicious" stroke="#FF4D6D" strokeWidth={2} dot={false} name="Suspicious" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-title">Recent Alerts</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 240, overflowY: 'auto' }}>
            {recentAlerts.length === 0 && <div style={{ color: 'var(--text-low)', fontSize: 12.5 }}>No alerts yet.</div>}
            {recentAlerts.map((a) => (
              <div key={a._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{a.username}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-low)', fontFamily: 'var(--font-mono)' }}>
                    {a.type === 'account_takeover' ? 'Account Takeover' : 'Insider Threat'} · {a.time}
                  </div>
                </div>
                <SeverityBadge level={a.severity} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="section-title">Risk Score Trend — Logins</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={riskTrends.loginTrend}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="_id" tick={{ fill: 'var(--text-low)', fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-low)', fontSize: 10 }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Line type="monotone" dataKey="avgRisk" stroke="#F2884B" strokeWidth={2} dot={false} name="Avg Risk" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="section-title">Risk Score Trend — File Access</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={riskTrends.fileTrend}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="_id" tick={{ fill: 'var(--text-low)', fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-low)', fontSize: 10 }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="avgRisk" fill="#33E6C9" radius={[3, 3, 0, 0]} name="Avg Risk" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <SimulateButtons onDone={load} />
    </div>
  );
};

export default DashboardPage;
