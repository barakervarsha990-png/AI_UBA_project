import { AlertTriangle, X } from 'lucide-react';
import { useAlerts } from '../context/AlertContext';
import SeverityBadge from './SeverityBadge';

const AlertToastStack = () => {
  const { liveAlerts, dismissAlert } = useAlerts();

  if (!liveAlerts || liveAlerts.length === 0) return null;

  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {liveAlerts.map((alert) => (
        <div className="toast-alert" key={alert._id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <AlertTriangle size={15} color="var(--sev-critical)" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>
                {alert.type === 'account_takeover' ? 'Account Takeover' : 'Insider Threat'}
              </span>
            </div>
            <X size={14} style={{ cursor: 'pointer', color: 'var(--text-low)' }} onClick={() => dismissAlert(alert._id)} />
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-mid)', marginBottom: 8 }}>
            <span className="mono">{alert.username}</span> · risk score <span className="mono">{alert.riskScore}</span>
          </div>
          <SeverityBadge level={alert.severity} />
        </div>
      ))}
    </div>
  );
};

export default AlertToastStack;
