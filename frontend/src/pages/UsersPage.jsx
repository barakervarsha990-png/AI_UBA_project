import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import SeverityBadge from '../components/SeverityBadge';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/users').then((res) => setUsers(res.data.data));
  }, []);

  return (
    <div className="page-content">
      <div className="card">
        <div className="section-title">All Monitored Users ({users.length})</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Department</th>
              <th>Job Title</th>
              <th>Status</th>
              <th>Risk Level</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} onClick={() => navigate(`/users/${u._id}`)} style={{ cursor: 'pointer' }}>
                <td className="mono-cell">{u.employeeId}</td>
                <td>{u.fullName} <span style={{ color: 'var(--text-low)', fontSize: 11.5 }}>@{u.username}</span></td>
                <td>{u.department}</td>
                <td>{u.jobTitle}</td>
                <td>
                  <span style={{ fontSize: 11.5, color: u.status === 'active' ? 'var(--signal-cyan)' : 'var(--text-low)' }}>
                    {u.status}
                  </span>
                </td>
                <td><SeverityBadge level={u.riskLevel} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UsersPage;
