import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import api from '../services/api';
import SeverityBadge from '../components/SeverityBadge';

const SEV_COLORS = { LOW: '#33E6C9', MEDIUM: '#F2C14E', HIGH: '#F2884B', CRITICAL: '#FF4D6D' };

const RiskAnalysisPage = () => {
  const [users, setUsers] = useState([]);
  const [fileStats, setFileStats] = useState({ byAction: [], bySensitivity: [] });

  useEffect(() => {
    api.get('/users').then((res) => setUsers(res.data.data));
    api.get('/dashboard/file-activity').then((res) => setFileStats(res.data.data));
  }, []);

  const riskDistribution = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((level) => ({
    name: level,
    value: users.filter((u) => u.riskLevel === level).length,
  }));

  const highRiskUsers = users.filter((u) => u.riskLevel === 'HIGH' || u.riskLevel === 'CRITICAL');

  return (
    <div className="page-content">
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="section-title">User Risk Distribution</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={riskDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {riskDistribution.map((d) => <Cell key={d.name} fill={SEV_COLORS[d.name]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-title">File Sensitivity Breakdown</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={fileStats.bySensitivity}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="_id" tick={{ fill: 'var(--text-low)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-low)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: 8 }} />
              <Bar dataKey="count" fill="#33E6C9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="section-title">High &amp; Critical Risk Users</div>
        <table className="data-table">
          <thead><tr><th>Employee ID</th><th>Name</th><th>Department</th><th>Risk Level</th></tr></thead>
          <tbody>
            {highRiskUsers.map((u) => (
              <tr key={u._id}>
                <td className="mono-cell">{u.employeeId}</td>
                <td>{u.fullName}</td>
                <td>{u.department}</td>
                <td><SeverityBadge level={u.riskLevel} /></td>
              </tr>
            ))}
            {highRiskUsers.length === 0 && (
              <tr><td colSpan={4} style={{ color: 'var(--text-low)', textAlign: 'center', padding: 20 }}>No high or critical risk users currently.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RiskAnalysisPage;
