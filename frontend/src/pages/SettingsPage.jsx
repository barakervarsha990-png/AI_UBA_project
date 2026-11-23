import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Clock, MapPin, FileText, CheckCircle2, AlertTriangle, Save, Loader2 } from 'lucide-react';
import api from '../services/api';

const SettingsPage = () => {
  const { user } = useAuth();
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [testRecipient, setTestRecipient] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Company Policy State
  const [policy, setPolicy] = useState(null);
  const [policyForm, setPolicyForm] = useState({
    companyName: 'Sentinel Security Enterprise',
    timezone: 'Asia/Kolkata',
    workingHoursStart: '10:00',
    workingHoursEnd: '17:00',
    loginWindowStart: '10:00',
    loginWindowEnd: '10:30',
    authorizedLocation: {
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
    },
    maxFilesPerWindow: 10,
    fileWindowMinutes: 5,
    managerExemptFromTimeRestrictions: true,
    managerExemptFromLocationRestrictions: true,
  });
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyBanner, setPolicyBanner] = useState(null);

  useEffect(() => {
    // Load SMTP status
    api.get('/alerts/email-status')
      .then((res) => {
        setSmtpStatus(res.data.data);
        if (res.data.data?.recipient) {
          setTestRecipient(res.data.data.recipient);
        }
      })
      .catch((err) => console.error('Failed to load SMTP status:', err));

    // Load Company Policy
    api.get('/settings/policy')
      .then((res) => {
        if (res.data.data) {
          setPolicy(res.data.data);
          setPolicyForm(res.data.data);
        }
      })
      .catch((err) => console.error('Failed to load policy:', err));
  }, []);

  const handleSendTest = async (e) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    try {
      const res = await api.post('/alerts/test-email', {
        recipient: testRecipient || undefined,
      });
      setTestResult({
        success: true,
        message: res.data.message,
        previewUrl: res.data.data?.previewUrl,
        provider: res.data.data?.provider,
      });
    } catch (err) {
      const data = err.response?.data;
      setTestResult({
        success: false,
        message: data?.message || err.message,
        hint: data?.hint,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    setPolicyLoading(true);
    setPolicyBanner(null);

    try {
      const res = await api.put('/settings/policy', policyForm);
      setPolicy(res.data.data);
      setPolicyBanner({
        type: 'success',
        text: 'Company security policy successfully updated and active across authentication & telemetry services!',
      });
    } catch (err) {
      setPolicyBanner({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save security policy',
      });
    } finally {
      setPolicyLoading(false);
    }
  };

  return (
    <div className="page-content">
      {/* Administrator Profile */}
      <div className="card" style={{ maxWidth: 860, marginBottom: 16 }}>
        <div className="section-title">Security Administrator Account</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, fontSize: 13 }}>
          <div><span className="label-sm">Full Name</span><div>{user?.fullName}</div></div>
          <div><span className="label-sm">Username</span><div className="mono">{user?.username}</div></div>
          <div><span className="label-sm">Email</span><div className="mono">{user?.email}</div></div>
          <div><span className="label-sm">Security Role</span><div style={{ textTransform: 'uppercase', color: 'var(--signal-cyan)', fontWeight: 600 }}>{user?.role}</div></div>
        </div>
      </div>

      {/* COMPANY SECURITY & LOGIN POLICY CONFIGURATION */}
      <div className="card" style={{ maxWidth: 860, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} color="var(--signal-cyan)" />
            <div className="section-title" style={{ margin: 0 }}>Company Working Time &amp; Location Security Policy</div>
          </div>
          <span
            className="badge"
            style={{ background: 'rgba(51, 230, 201, 0.1)', color: 'var(--signal-cyan)', border: '1px solid var(--signal-cyan)', fontSize: 11 }}
          >
            ACTIVE ENFORCEMENT
          </span>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-mid)', lineHeight: 1.5, margin: '0 0 16px' }}>
          Configures enterprise perimeter and schedule rules. Logins outside the permitted employee window
          or outside the authorized corporate location generate automated SOC alerts and email incident advisories.
        </p>

        {policyBanner && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 12.5,
              background: policyBanner.type === 'success' ? '#ECFDF5' : '#FEF2F2',
              border: `1px solid ${policyBanner.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
              color: policyBanner.type === 'success' ? '#065F46' : '#991B1B',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {policyBanner.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {policyBanner.text}
          </div>
        )}

        <form onSubmit={handleSavePolicy}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
            {/* Timezone */}
            <div>
              <label className="label-sm">Corporate Timezone</label>
              <input
                className="input"
                style={{ width: '100%' }}
                value={policyForm.timezone}
                onChange={(e) => setPolicyForm({ ...policyForm, timezone: e.target.value })}
                required
              />
              <div style={{ fontSize: 11, color: 'var(--text-low)', marginTop: 4 }}>Standard: Asia/Kolkata (IST)</div>
            </div>

            {/* Operating Hours Start */}
            <div>
              <label className="label-sm">Company Starting Time</label>
              <input
                className="input"
                type="time"
                style={{ width: '100%' }}
                value={policyForm.workingHoursStart}
                onChange={(e) => setPolicyForm({ ...policyForm, workingHoursStart: e.target.value })}
                required
              />
              <div style={{ fontSize: 11, color: 'var(--text-low)', marginTop: 4 }}>Company opens: 10:00 AM</div>
            </div>

            {/* Operating Hours End */}
            <div>
              <label className="label-sm">Company Closing Time</label>
              <input
                className="input"
                type="time"
                style={{ width: '100%' }}
                value={policyForm.workingHoursEnd}
                onChange={(e) => setPolicyForm({ ...policyForm, workingHoursEnd: e.target.value })}
                required
              />
              <div style={{ fontSize: 11, color: 'var(--text-low)', marginTop: 4 }}>Company closes: 5:00 PM (17:00)</div>
            </div>

            {/* Permitted Login Window Start */}
            <div>
              <label className="label-sm" style={{ color: 'var(--signal-cyan)' }}>Employee Login Window Start</label>
              <input
                className="input"
                type="time"
                style={{ width: '100%', borderColor: 'var(--signal-cyan)' }}
                value={policyForm.loginWindowStart}
                onChange={(e) => setPolicyForm({ ...policyForm, loginWindowStart: e.target.value })}
                required
              />
              <div style={{ fontSize: 11, color: 'var(--text-low)', marginTop: 4 }}>Permission begins: 10:00 AM</div>
            </div>

            {/* Permitted Login Window End */}
            <div>
              <label className="label-sm" style={{ color: 'var(--signal-cyan)' }}>Employee Login Window End</label>
              <input
                className="input"
                type="time"
                style={{ width: '100%', borderColor: 'var(--signal-cyan)' }}
                value={policyForm.loginWindowEnd}
                onChange={(e) => setPolicyForm({ ...policyForm, loginWindowEnd: e.target.value })}
                required
              />
              <div style={{ fontSize: 11, color: 'var(--text-low)', marginTop: 4 }}>Permission ends: 10:30 AM</div>
            </div>

            {/* Authorized City */}
            <div>
              <label className="label-sm">Authorized Corporate City</label>
              <input
                className="input"
                style={{ width: '100%' }}
                value={policyForm.authorizedLocation?.city || ''}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    authorizedLocation: { ...policyForm.authorizedLocation, city: e.target.value },
                  })
                }
                required
              />
              <div style={{ fontSize: 11, color: 'var(--text-low)', marginTop: 4 }}>Company Headquarters: Bengaluru</div>
            </div>

            {/* Authorized State */}
            <div>
              <label className="label-sm">Authorized State</label>
              <input
                className="input"
                style={{ width: '100%' }}
                value={policyForm.authorizedLocation?.state || ''}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    authorizedLocation: { ...policyForm.authorizedLocation, state: e.target.value },
                  })
                }
                required
              />
              <div style={{ fontSize: 11, color: 'var(--text-low)', marginTop: 4 }}>State: Karnataka</div>
            </div>

            {/* Authorized Country */}
            <div>
              <label className="label-sm">Authorized Country</label>
              <input
                className="input"
                style={{ width: '100%' }}
                value={policyForm.authorizedLocation?.country || ''}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    authorizedLocation: { ...policyForm.authorizedLocation, country: e.target.value },
                  })
                }
                required
              />
              <div style={{ fontSize: 11, color: 'var(--text-low)', marginTop: 4 }}>Country: India</div>
            </div>

            {/* Mass Download Threshold */}
            <div>
              <label className="label-sm">Max Files Per Window (Threshold)</label>
              <input
                className="input"
                type="number"
                min="1"
                max="100"
                style={{ width: '100%' }}
                value={policyForm.maxFilesPerWindow}
                onChange={(e) => setPolicyForm({ ...policyForm, maxFilesPerWindow: parseInt(e.target.value, 10) || 10 })}
                required
              />
              <div style={{ fontSize: 11, color: 'var(--text-low)', marginTop: 4 }}>Triggers Bulk Alert if &gt; 10 files</div>
            </div>

            {/* File Window Minutes */}
            <div>
              <label className="label-sm">File Monitoring Window (Minutes)</label>
              <input
                className="input"
                type="number"
                min="1"
                max="60"
                style={{ width: '100%' }}
                value={policyForm.fileWindowMinutes}
                onChange={(e) => setPolicyForm({ ...policyForm, fileWindowMinutes: parseInt(e.target.value, 10) || 5 })}
                required
              />
              <div style={{ fontSize: 11, color: 'var(--text-low)', marginTop: 4 }}>Sliding Window: 5 minutes</div>
            </div>
          </div>

          {/* Manager Exemptions */}
          <div style={{ background: 'var(--bg-void)', padding: 12, borderRadius: 6, border: '1px solid var(--line)', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--signal-cyan)', marginBottom: 8 }}>
              Manager / Administrator Privileged Exemptions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={policyForm.managerExemptFromTimeRestrictions}
                  onChange={(e) =>
                    setPolicyForm({ ...policyForm, managerExemptFromTimeRestrictions: e.target.checked })
                  }
                />
                Exempt Managers and Admins from 10:00 AM–10:30 AM login window restrictions (24/7 incident response capability)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={policyForm.managerExemptFromLocationRestrictions}
                  onChange={(e) =>
                    setPolicyForm({ ...policyForm, managerExemptFromLocationRestrictions: e.target.checked })
                  }
                />
                Exempt Managers and Admins from Bengaluru location restrictions (enables remote security incident handling)
              </label>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={policyLoading} style={{ padding: '8px 20px', gap: 8 }}>
            {policyLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
            Save Company Security Policy
          </button>
        </form>
      </div>

      {/* Automated Email Notification System */}
      <div className="card" style={{ maxWidth: 860, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>Automated Email Notification System</div>
          {smtpStatus && (
            <span
              className="badge"
              style={{
                background: smtpStatus.configured ? '#ECFDF5' : '#FEF2F2',
                color: smtpStatus.configured ? '#047857' : '#B91C1C',
                border: `1px solid ${smtpStatus.configured ? '#A7F3D0' : '#FECACA'}`,
                fontSize: 11,
              }}
            >
              {smtpStatus.isEthereal ? 'ETHEREAL TEST MODE' : smtpStatus.configured ? 'SMTP CONFIGURED' : 'NOT CONFIGURED'}
            </span>
          )}
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-mid)', lineHeight: 1.5, margin: '0 0 14px' }}>
          When HIGH or CRITICAL security incidents are detected (Outside Login Window, Unauthorized Location, Mass File Downloads, Brute-Force, or ATO),
          Sentinel dispatches an automated incident advisory to the configured SOC recipient.
        </p>

        {smtpStatus && (
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--line, #E5E7EB)',
              borderRadius: 8,
              padding: 14,
              marginBottom: 16,
              fontSize: 12.5,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <span className="label-sm">SMTP Server Host</span>
                <div className="mono" style={{ color: '#2563EB' }}>{smtpStatus.host}:{smtpStatus.port}</div>
              </div>
              <div>
                <span className="label-sm">Sender Account</span>
                <div className="mono">{smtpStatus.user || 'None'}</div>
              </div>
              <div>
                <span className="label-sm">Alert Recipient (ALERT_EMAIL_TO)</span>
                <div className="mono">{smtpStatus.recipient || 'None'}</div>
              </div>
              <div>
                <span className="label-sm">TLS Self-Signed Bypass</span>
                <div className="mono">{smtpStatus.allowSelfSigned ? 'Enabled (Antivirus safe)' : 'Disabled'}</div>
              </div>
            </div>

            {smtpStatus.host?.includes('gmail') && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line, #E5E7EB)', fontSize: 12, color: 'var(--text-mid)' }}>
                ℹ️ <strong>Gmail Note:</strong> Google accounts require a 16-character <strong>App Password</strong> with 2-Step Verification enabled.
                Current password is <strong>{smtpStatus.passLength} characters</strong> {smtpStatus.isGmailAppPassFormat ? '✓ (Valid App Password format)' : '⚠️ (Expected 16 characters)'}.
                Manage App Passwords at{' '}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#2563EB', textDecoration: 'underline' }}
                >
                  myaccount.google.com/apppasswords
                </a>.
              </div>
            )}
          </div>
        )}

        {/* Live Email Test Dispatch Form */}
        <form onSubmit={handleSendTest} style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label className="label-sm" style={{ display: 'block', marginBottom: 4 }}>
                Send Test Alert Verification To:
              </label>
              <input
                type="email"
                className="input"
                style={{ width: '100%' }}
                placeholder="soc-team@company.com"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={testing}
              style={{ padding: '8px 18px', fontSize: 13 }}
            >
              {testing ? 'Verifying & Sending...' : '✉️ Send Test Security Alert Email'}
            </button>
          </div>
        </form>

        {testResult && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 6,
              fontSize: 12.5,
              background: testResult.success ? '#ECFDF5' : '#FEF2F2',
              border: `1px solid ${testResult.success ? '#A7F3D0' : '#FECACA'}`,
              color: testResult.success ? '#065F46' : '#991B1B',
            }}
          >
            <strong>{testResult.success ? '✅ Success: ' : '❌ Delivery Failed: '}</strong>
            {testResult.message}
            {testResult.hint && (
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                💡 <em>{testResult.hint}</em>
              </div>
            )}
            {testResult.previewUrl && (
              <div style={{ marginTop: 8 }}>
                <a
                  href={testResult.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#2563EB', textDecoration: 'underline', fontWeight: 600 }}
                >
                  Open Delivered Security Email in Web Preview &rarr;
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alert Thresholds */}
      <div className="card" style={{ maxWidth: 860, marginBottom: 16 }}>
        <div className="section-title">Alert Thresholds &amp; Trigger Rules</div>
        <table className="data-table">
          <thead>
            <tr><th>Risk Score Range</th><th>Severity</th><th>Automated Action</th></tr>
          </thead>
          <tbody>
            <tr><td className="mono-cell">0 – 29</td><td>LOW</td><td>Logged to security database · Baseline operation</td></tr>
            <tr><td className="mono-cell">30 – 49</td><td>MEDIUM</td><td>Logged to audit stream · SOC live telemetry monitor</td></tr>
            <tr><td className="mono-cell">50 – 74</td><td>HIGH</td><td><strong>Triggers SOC Incident Alert + Manager Email Dispatch</strong></td></tr>
            <tr><td className="mono-cell">75 – 100</td><td>CRITICAL</td><td><strong>Immediate Alert + High Priority Email Dispatch + Recommended Containment</strong></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SettingsPage;
