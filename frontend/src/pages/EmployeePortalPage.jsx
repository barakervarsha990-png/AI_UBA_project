import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Clock,
  MapPin,
  FileText,
  ShieldCheck,
  Download,
  Eye,
  CheckCircle,
  AlertTriangle,
  Building,
  User,
  LogOut,
  RefreshCw,
} from 'lucide-react';

const EmployeePortalPage = () => {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('files'); // 'files' | 'logins' | 'history'
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileMessage, setFileMessage] = useState(null);
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  // Update IST clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const istString = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setCurrentTimeStr(istString);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const [dashRes, catRes] = await Promise.all([
        api.get('/employee/dashboard'),
        api.get('/files/catalog'),
      ]);
      setData(dashRes.data.data);
      setCatalog(catRes.data.data || []);
    } catch (err) {
      console.error('Failed to load employee portal data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleViewFile = async (fileName) => {
    setFileMessage(null);
    try {
      const res = await api.get(`/files/view/${fileName}`);
      setSelectedFile(res.data.data);
      setFileMessage({
        type: 'success',
        text: `Viewing ${fileName} (Classification: ${res.data.data.sensitivityLevel.toUpperCase()})`,
      });
      loadDashboard();
    } catch (err) {
      setFileMessage({ type: 'error', text: err.response?.data?.message || 'Failed to view file' });
    }
  };

  const handleDownloadFile = async (fileName) => {
    setFileMessage(null);
    try {
      const response = await api.get(`/files/download/${fileName}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setFileMessage({ type: 'success', text: `Downloaded ${fileName} successfully.` });
      loadDashboard();
    } catch (err) {
      setFileMessage({ type: 'error', text: err.response?.data?.message || 'Download failed' });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-mid)' }}>
        Loading employee portal...
      </div>
    );
  }

  const profile = data?.profile || user;
  const policy = data?.companyPolicy;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
      {/* Top Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
          marginBottom: 24,
          background: '#FFFFFF',
          border: '1px solid var(--line, #E5E7EB)',
          borderRadius: 12,
          padding: '18px 24px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building size={20} color="#2563EB" />
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-hi)' }}>
              Sentinel Enterprise Employee Workspace
            </h1>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-mid)', marginTop: 4 }}>
            Welcome, <strong>{profile?.fullName}</strong> &bull; Employee ID: <span className="mono">{profile?.employeeId}</span> &bull; {profile?.department} ({profile?.jobTitle})
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-outline"
            onClick={loadDashboard}
            style={{ fontSize: 12.5, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            className="btn btn-outline"
            onClick={logout}
            style={{ fontSize: 12.5, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, borderColor: '#FECACA', color: '#DC2626' }}
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </div>

      {/* Grid: Profile Info & Company Policy Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Profile Card */}
        <div className="card">
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={16} color="#2563EB" /> Employee Profile
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            <div>
              <span className="label-sm">Employee ID</span>
              <div className="mono" style={{ color: '#2563EB', fontWeight: 600 }}>{profile?.employeeId}</div>
            </div>
            <div>
              <span className="label-sm">Username</span>
              <div className="mono">{profile?.username}</div>
            </div>
            <div>
              <span className="label-sm">Department</span>
              <div>{profile?.department}</div>
            </div>
            <div>
              <span className="label-sm">Designation</span>
              <div>{profile?.jobTitle}</div>
            </div>
            <div>
              <span className="label-sm">Official Email</span>
              <div className="mono" style={{ fontSize: 12 }}>{profile?.email}</div>
            </div>
            <div>
              <span className="label-sm">Assigned Location</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#059669', fontWeight: 500 }}>
                <MapPin size={13} /> {profile?.assignedLocation || 'Bengaluru, India'}
              </div>
            </div>
          </div>
        </div>

        {/* Company Policy & Current Status */}
        <div className="card">
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color="#7C3AED" /> Company Working Hours & Location Policy
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, marginBottom: 14 }}>
            <div>
              <span className="label-sm">Current Company Time (IST)</span>
              <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#2563EB' }}>
                {currentTimeStr || '10:15:00 AM IST'}
              </div>
            </div>
            <div>
              <span className="label-sm">Permitted Login Window</span>
              <div style={{ fontWeight: 600, color: '#D97706' }}>
                10:00 AM – 10:30 AM IST
              </div>
            </div>
            <div>
              <span className="label-sm">Office Working Hours</span>
              <div>10:00 AM – 5:00 PM IST</div>
            </div>
            <div>
              <span className="label-sm">Authorized Office Location</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#059669', fontWeight: 500 }}>
                <ShieldCheck size={13} /> Bengaluru, Karnataka, India
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: policy?.isWithinLoginWindow ? '#ECFDF5' : '#FFFBEB',
              border: `1px solid ${policy?.isWithinLoginWindow ? '#A7F3D0' : '#FDE68A'}`,
              color: policy?.isWithinLoginWindow ? '#065F46' : '#92400E',
              fontSize: 12.5,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {policy?.isWithinLoginWindow ? (
              <>
                <CheckCircle size={16} color="#059669" />
                <span>Morning employee login permission window is currently <strong>ACTIVE</strong>.</span>
              </>
            ) : (
              <>
                <Clock size={16} color="#2563EB" />
                <span>Notice: Official morning employee login window is <strong>10:00 AM to 10:30 AM IST</strong>. Logins outside this window trigger security notifications.</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* File Action Feedback */}
      {fileMessage && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            marginBottom: 16,
            background: fileMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${fileMessage.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
            color: fileMessage.type === 'success' ? '#065F46' : '#991B1B',
            fontSize: 13,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{fileMessage.text}</span>
          <button
            onClick={() => setFileMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Tabs navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--line, #E5E7EB)', paddingBottom: 10 }}>
        <button
          className={`btn ${activeTab === 'files' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('files')}
          style={{ fontSize: 13, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <FileText size={15} /> Authorized File Repository ({catalog.length})
        </button>
        <button
          className={`btn ${activeTab === 'logins' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('logins')}
          style={{ fontSize: 13, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Clock size={15} /> My Login Activity ({data?.recentLogins?.length || 0})
        </button>
        <button
          className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('history')}
          style={{ fontSize: 13, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ShieldCheck size={15} /> My File Operations ({data?.recentFiles?.length || 0})
        </button>
      </div>

      {/* Tab 1: Authorized File Catalog */}
      {activeTab === 'files' && (
        <div className="card">
          <div className="section-title">Authorized Company File Repository</div>
          <p style={{ fontSize: 12.5, color: 'var(--text-mid)', marginBottom: 14 }}>
            Access authorized corporate documents for your active assignments. All actions are audited by Sentinel UBA.
          </p>

          <table className="data-table">
            <thead>
              <tr>
                <th>Document Name</th>
                <th>Classification</th>
                <th>Type</th>
                <th>Description</th>
                <th>File Size</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((f) => (
                <tr key={f.fileName}>
                  <td className="mono-cell" style={{ fontWeight: 600 }}>{f.fileName}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        textTransform: 'uppercase',
                        fontSize: 10.5,
                        background:
                          f.sensitivityLevel === 'public'
                            ? '#F0F9FF'
                            : f.sensitivityLevel === 'internal'
                            ? '#ECFDF5'
                            : f.sensitivityLevel === 'confidential'
                            ? '#FFF7ED'
                            : '#FEF2F2',
                        color:
                          f.sensitivityLevel === 'public'
                            ? '#0369A1'
                            : f.sensitivityLevel === 'internal'
                            ? '#047857'
                            : f.sensitivityLevel === 'confidential'
                            ? '#C2410C'
                            : '#B91C1C',
                        border: `1px solid ${
                          f.sensitivityLevel === 'public'
                            ? '#BAE6FD'
                            : f.sensitivityLevel === 'internal'
                            ? '#A7F3D0'
                            : f.sensitivityLevel === 'confidential'
                            ? '#FED7AA'
                            : '#FECACA'
                        }`,
                      }}
                    >
                      {f.sensitivityLevel}
                    </span>
                  </td>
                  <td className="mono-cell" style={{ fontSize: 11, textTransform: 'uppercase' }}>{f.fileType}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-mid)' }}>{f.description}</td>
                  <td className="mono-cell" style={{ fontSize: 11 }}>
                    {f.sizeBytes ? `${(f.sizeBytes / 1024).toFixed(1)} KB` : 'N/A'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handleViewFile(f.fileName)}
                      >
                        <Eye size={13} /> View
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handleDownloadFile(f.fileName)}
                      >
                        <Download size={13} /> Download
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Modal / In-Page Document Preview */}
          {selectedFile && (
            <div
              style={{
                marginTop: 20,
                border: '1px solid var(--line, #E5E7EB)',
                borderRadius: 8,
                background: '#FFFFFF',
                padding: 16,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-hi)' }}>
                  📄 Previewing: <span className="mono">{selectedFile.fileName}</span>
                </div>
                <button
                  className="btn btn-outline"
                  style={{ padding: '2px 8px', fontSize: 12 }}
                  onClick={() => setSelectedFile(null)}
                >
                  Close Preview
                </button>
              </div>
              <pre
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E5E7EB',
                  padding: 14,
                  borderRadius: 6,
                  fontSize: 12,
                  maxHeight: 220,
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  color: '#26374A',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedFile.content || 'Content preview not available for this binary format.'}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: My Login Activity */}
      {activeTab === 'logins' && (
        <div className="card">
          <div className="section-title">My Recent Authentication Telemetry</div>
          <p style={{ fontSize: 12.5, color: 'var(--text-mid)', marginBottom: 14 }}>
            Historical record of your login attempts as recorded by Sentinel UBA.
          </p>

          <table className="data-table">
            <thead>
              <tr>
                <th>Time (IST)</th>
                <th>Status</th>
                <th>Location</th>
                <th>IP Address</th>
                <th>Device</th>
                <th>Policy Compliance</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentLogins || []).map((l) => (
                <tr key={l._id}>
                  <td className="mono-cell" style={{ fontSize: 11.5 }}>
                    {new Date(l.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: l.loginStatus === 'success' ? '#ECFDF5' : '#FEF2F2',
                        color: l.loginStatus === 'success' ? '#047857' : '#B91C1C',
                        border: `1px solid ${l.loginStatus === 'success' ? '#A7F3D0' : '#FECACA'}`,
                        fontSize: 11,
                      }}
                    >
                      {l.loginStatus.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{l.city}, {l.country}</td>
                  <td className="mono-cell" style={{ fontSize: 11 }}>{l.ipAddress}</td>
                  <td style={{ fontSize: 11.5 }}>{l.device}</td>
                  <td>
                    {l.isTimeUnauthorized ? (
                      <span className="badge" style={{ background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', fontSize: 10.5 }}>
                        Outside Window
                      </span>
                    ) : (
                      <span className="badge" style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: 10.5 }}>
                        Compliant
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {(!data?.recentLogins || data.recentLogins.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-low)' }}>
                    No login records found for your account.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: My File Operations */}
      {activeTab === 'history' && (
        <div className="card">
          <div className="section-title">My File Access Log</div>
          <p style={{ fontSize: 12.5, color: 'var(--text-mid)', marginBottom: 14 }}>
            Audit log of documents accessed or downloaded under your user session.
          </p>

          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp (IST)</th>
                <th>File Name</th>
                <th>Action</th>
                <th>Classification</th>
                <th>Audit Event ID</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentFiles || []).map((f) => (
                <tr key={f._id}>
                  <td className="mono-cell" style={{ fontSize: 11.5 }}>
                    {new Date(f.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>
                  <td className="mono-cell" style={{ fontWeight: 600 }}>{f.fileName}</td>
                  <td>
                    <span className="badge" style={{ textTransform: 'uppercase', fontSize: 10.5 }}>
                      {f.action}
                    </span>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        textTransform: 'uppercase',
                        fontSize: 10.5,
                        background:
                          f.sensitivityLevel === 'confidential'
                            ? '#FFF7ED'
                            : f.sensitivityLevel === 'restricted'
                            ? '#FEF2F2'
                            : '#F0F9FF',
                        color:
                          f.sensitivityLevel === 'confidential'
                            ? '#C2410C'
                            : f.sensitivityLevel === 'restricted'
                            ? '#B91C1C'
                            : '#0369A1',
                        border: `1px solid ${
                          f.sensitivityLevel === 'confidential'
                            ? '#FED7AA'
                            : f.sensitivityLevel === 'restricted'
                            ? '#FECACA'
                            : '#BAE6FD'
                        }`,
                      }}
                    >
                      {f.sensitivityLevel}
                    </span>
                  </td>
                  <td className="mono-cell" style={{ fontSize: 10.5, color: 'var(--text-low)' }}>
                    {f.eventId || 'FEVT-N/A'}
                  </td>
                </tr>
              ))}
              {(!data?.recentFiles || data.recentFiles.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-low)' }}>
                    No file operation records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EmployeePortalPage;

