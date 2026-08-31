import { useAuth } from '../context/AuthContext';

const SettingsPage = () => {
  const { user } = useAuth();

  return (
    <div className="page-content">
      <div className="card" style={{ maxWidth: 620, marginBottom: 16 }}>
        <div className="section-title">Administrator Account</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
          <div><span className="label-sm">Full Name</span><div>{user?.fullName}</div></div>
          <div><span className="label-sm">Username</span><div className="mono">{user?.username}</div></div>
          <div><span className="label-sm">Email</span><div className="mono">{user?.email}</div></div>
          <div><span className="label-sm">Role</span><div style={{ textTransform: 'capitalize' }}>{user?.role}</div></div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 620, marginBottom: 16 }}>
        <div className="section-title">Alert Thresholds</div>
        <table className="data-table">
          <thead><tr><th>Risk Score Range</th><th>Severity</th></tr></thead>
          <tbody>
            <tr><td className="mono-cell">0 – 29</td><td>LOW</td></tr>
            <tr><td className="mono-cell">30 – 49</td><td>MEDIUM</td></tr>
            <tr><td className="mono-cell">50 – 74</td><td>HIGH (triggers alert + email)</td></tr>
            <tr><td className="mono-cell">75 – 100</td><td>CRITICAL (triggers alert + email)</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 11.5, color: 'var(--text-low)', marginTop: 10 }}>
          Thresholds are configured server-side in <code>services/alertService.js</code> and the ML scoring model.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        <div className="section-title">System Configuration</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-mid)' }}>
          SMTP, JWT secrets, database connection, and the ML service URL are configured via environment variables
          on the backend (<code>.env</code>) — never hard-coded. See the project README for the full list.
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;
