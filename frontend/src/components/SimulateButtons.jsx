import { useState } from 'react';
import { Zap, Bug, Loader2 } from 'lucide-react';
import api from '../services/api';

const SimulateButtons = ({ userId, onDone }) => {
  const [loadingType, setLoadingType] = useState(null);
  const [result, setResult] = useState(null);

  const run = async (type) => {
    setLoadingType(type);
    setResult(null);
    try {
      const endpoint = type === 'ato' ? '/simulate/account-takeover' : '/simulate/insider-threat';
      const res = await api.post(endpoint, userId ? { userId } : {});
      setResult({ type, success: true, data: res.data.data });
      onDone?.();
    } catch (err) {
      setResult({ type, success: false, message: err.response?.data?.message || 'Simulation failed' });
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="card">
      <div className="section-title">Demo Simulations</div>
      <p style={{ fontSize: 12.5, color: 'var(--text-mid)', marginTop: -8, marginBottom: 14 }}>
        Generate synthetic suspicious activity to demonstrate detection, alerting, and email notification — no real attack required.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-danger" onClick={() => run('ato')} disabled={loadingType !== null}>
          {loadingType === 'ato' ? <Loader2 size={15} className="mono" style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={15} />}
          Simulate Unauthorized Login
        </button>
        <button className="btn btn-danger" onClick={() => run('insider')} disabled={loadingType !== null}>
          {loadingType === 'insider' ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Bug size={15} />}
          Simulate Insider Threat
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 14, fontSize: 12.5, fontFamily: 'var(--font-mono)', color: result.success ? 'var(--signal-cyan)' : 'var(--sev-critical)' }}>
          {result.success
            ? result.type === 'ato'
              ? `Login event created — risk ${result.data.loginEvent.riskScore} (${result.data.loginEvent.riskLevel}). ${result.data.alert ? 'Alert raised and emailed.' : 'Below alert threshold.'}`
              : `${result.data.fileEventsCreated} file events created. ${result.data.alert ? 'Alert raised and emailed.' : 'Below alert threshold.'}`
            : result.message}
        </div>
      )}
    </div>
  );
};

export default SimulateButtons;
