import { useCallback, useEffect, useState } from 'react';
import { Copy, Download, Check, Trash2, Eraser } from 'lucide-react';
import api from '../services/api';
import SeverityBadge from '../components/SeverityBadge';

const COLUMNS = ['Date/Time', 'User', 'File', 'Sensitivity', 'Action', 'Location', 'Risk Level', 'Risk Score'];

const toRow = (e) => [
  `${e.date} ${e.time}`,
  e.username,
  e.fileName,
  e.sensitivityLevel,
  e.action,
  e.location,
  e.riskLevel,
  e.riskScore,
];

// Stops spreadsheet apps from running a cell that starts with = + - @ as a formula.
const safeCell = (value) => {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

const toCsv = (events) => {
  const escape = (v) => `"${safeCell(v).replace(/"/g, '""')}"`;
  return [COLUMNS, ...events.map(toRow)].map((row) => row.map(escape).join(',')).join('\r\n');
};

// Tab-separated text pastes straight into Excel, Google Sheets or Notepad.
const toTsv = (events) =>
  [COLUMNS, ...events.map(toRow)]
    .map((row) => row.map((v) => safeCell(v).replace(/[\t\r\n]+/g, ' ')).join('\t'))
    .join('\n');

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
  }
};

const FileActivityPage = () => {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'ok' | 'error', text }

  const load = useCallback(async () => {
    const params = filter === 'suspicious' ? '?suspicious=true&limit=150' : '?limit=150';
    const res = await api.get(`/file-events${params}`);
    setEvents(res.data.data);
  }, [filter]);

  useEffect(() => {
    setSelected(new Set());
    load();
  }, [load]);

  const showError = (err) =>
    setNotice({ type: 'error', text: err.response?.data?.message || 'Request failed. Check the backend terminal.' });

  const handleCopy = async () => {
    await copyText(toTsv(events));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    // The leading BOM makes Excel read the file as UTF-8.
    const blob = new Blob(['\ufeff', toCsv(events)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `file-activity-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = events.length > 0 && selected.size === events.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(events.map((e) => e._id)));

  const run = async (action, doneText) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await action();
      setNotice({ type: 'ok', text: `${doneText(res.data.deletedCount)}` });
      setSelected(new Set());
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };

  const deleteOne = (e) => {
    if (!window.confirm(`Delete this event?\n\n${e.fileName} (${e.action}) by ${e.username}`)) return;
    run(() => api.delete(`/file-events/${e._id}`), () => 'Event deleted.');
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} selected event(s)? This cannot be undone.`)) return;
    run(
      () => api.post('/file-events/delete-many', { ids: [...selected] }),
      (n) => `${n} event(s) deleted.`
    );
  };

  const clearSimulated = () => {
    if (!window.confirm('Delete every event created by the "Simulate" buttons? Seeded history is kept.')) return;
    run(() => api.post('/file-events/clear-simulated'), (n) => `${n} simulated event(s) deleted.`);
  };

  return (
    <div className="page-content">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>File Access Activity</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" style={{ borderColor: filter === 'all' ? 'var(--signal-cyan)' : undefined }} onClick={() => setFilter('all')}>All</button>
            <button className="btn" style={{ borderColor: filter === 'suspicious' ? 'var(--sev-critical)' : undefined }} onClick={() => setFilter('suspicious')}>Suspicious Only</button>
            <button className="btn" onClick={handleCopy} disabled={events.length === 0} title="Copy the table to the clipboard">
              {copied ? <Check size={15} color="var(--signal-cyan)" /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="btn btn-primary" onClick={handleDownload} disabled={events.length === 0} title="Download the table as a CSV file">
              <Download size={15} />
              Download CSV
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <button className="btn btn-danger" onClick={deleteSelected} disabled={busy || selected.size === 0}>
            <Trash2 size={15} />
            Delete selected{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
          <button className="btn btn-danger" onClick={clearSimulated} disabled={busy} title="Removes only events made by the Simulate buttons">
            <Eraser size={15} />
            Clear simulated
          </button>
          {notice && (
            <span style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', color: notice.type === 'ok' ? 'var(--signal-cyan)' : 'var(--sev-critical)' }}>
              {notice.text}
            </span>
          )}
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 34 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={events.length === 0}
                  aria-label="Select all events"
                  style={{ accentColor: 'var(--signal-cyan)' }}
                />
              </th>
              <th>Date/Time</th><th>User</th><th>File</th><th>Sensitivity</th><th>Action</th><th>Location</th><th>Risk</th><th style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e._id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(e._id)}
                    onChange={() => toggleOne(e._id)}
                    aria-label={`Select ${e.fileName}`}
                    style={{ accentColor: 'var(--signal-cyan)' }}
                  />
                </td>
                <td className="mono-cell">{e.date} {e.time}</td>
                <td>{e.username}</td>
                <td className="mono-cell">{e.fileName}</td>
                <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{e.sensitivityLevel}</td>
                <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{e.action}</td>
                <td style={{ fontSize: 12 }}>{e.location}</td>
                <td><SeverityBadge level={e.riskLevel} /></td>
                <td>
                  <button
                    onClick={() => deleteOne(e)}
                    disabled={busy}
                    title="Delete this event"
                    aria-label={`Delete ${e.fileName}`}
                    style={{ background: 'none', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', color: 'var(--text-low)', padding: 4 }}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={9} style={{ color: 'var(--text-low)', textAlign: 'center', padding: 20 }}>No file events.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FileActivityPage;