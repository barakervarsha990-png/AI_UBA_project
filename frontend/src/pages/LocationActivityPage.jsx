import { useEffect, useState } from 'react';
import api from '../services/api';

const LocationActivityPage = () => {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    api.get('/dashboard/location-activity').then((res) => setLocations(res.data.data));
  }, []);

  const maxCount = Math.max(...locations.map((l) => l.count), 1);

  return (
    <div className="page-content">
      <div className="card">
        <div className="section-title">Login Activity by Location</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-mid)', marginTop: -8, marginBottom: 18 }}>
          Approximate geolocation derived from sample IP data. Replace <code>utils/sampleGeoData.js</code> with a real
          IP-geolocation API integration in production.
        </p>
        <table className="data-table">
          <thead>
            <tr><th>City</th><th>State</th><th>Country</th><th>Total Logins</th><th>Suspicious</th><th style={{ width: 200 }}>Volume</th></tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={`${l._id.city}-${l._id.state}-${l._id.country}`}>
                <td>{l._id.city}</td>
                <td>{l._id.state}</td>
                <td>{l._id.country}</td>
                <td className="mono-cell">{l.count}</td>
                <td className="mono-cell" style={{ color: l.suspicious > 0 ? 'var(--sev-critical)' : 'var(--text-mid)' }}>{l.suspicious}</td>
                <td>
                  <div style={{ background: 'var(--bg-void)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={{
                      width: `${(l.count / maxCount) * 100}%`, height: '100%',
                      background: l.suspicious > 0 ? 'var(--sev-critical)' : 'var(--signal-cyan)',
                    }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LocationActivityPage;
