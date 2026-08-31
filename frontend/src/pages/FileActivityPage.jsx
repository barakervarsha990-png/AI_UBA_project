import { useEffect, useState } from 'react';
import api from '../services/api';
import SeverityBadge from '../components/SeverityBadge';

const FileActivityPage = () => {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const params = filter === 'suspicious' ? '?suspicious=true&limit=150' : '?limit=150';
    api.get(`/file-events${params}`).then((res) => setEvents(res.data.data));
  }, [filter]);

  return (
    <div className="page-content">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0 }}>File Access Activity</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ borderColor: filter === 'all' ? 'var(--signal-cyan)' : undefined }} onClick={() => setFilter('all')}>All</button>
            <button className="btn" style={{ borderColor: filter === 'suspicious' ? 'var(--sev-critical)' : undefined }} onClick={() => setFilter('suspicious')}>Suspicious Only</button>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Date/Time</th><th>User</th><th>File</th><th>Sensitivity</th><th>Action</th><th>Location</th><th>Risk</th></tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e._id}>
                <td className="mono-cell">{e.date} {e.time}</td>
                <td>{e.username}</td>
                <td className="mono-cell">{e.fileName}</td>
                <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{e.sensitivityLevel}</td>
                <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{e.action}</td>
                <td style={{ fontSize: 12 }}>{e.location}</td>
                <td><SeverityBadge level={e.riskLevel} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FileActivityPage;
