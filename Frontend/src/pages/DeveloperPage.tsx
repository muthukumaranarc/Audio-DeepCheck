import React, { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../services/api';

interface LogEntry {
  ts: string;
  level: 'info' | 'success' | 'warn' | 'error';
  msg: string;
}

interface Stats {
  totalSessions: unknown;
  callIdSequence: unknown;
  timestamp: string;
  offline?: boolean;
}

const nowTime = () => new Date().toLocaleTimeString();

function badgeColor(level: LogEntry['level']) {
  const map: Record<LogEntry['level'], string> = {
    info: '#60a5fa',
    success: '#34d399',
    warn: '#fbbf24',
    error: '#f87171',
  };
  return map[level];
}

interface ConfirmProps { message: string; onConfirm: () => void; onCancel: () => void; }
const ConfirmDialog: React.FC<ConfirmProps> = ({ message, onConfirm, onCancel }) => (
  <div style={styles.overlay}>
    <div style={styles.dialog}>
      <p style={{ margin: '0 0 20px', color: '#f1f5f9', fontSize: 15 }}>⚠️ {message}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button style={{ ...styles.btn, background: '#334155' }} onClick={onCancel}>Cancel</button>
        <button style={{ ...styles.btn, background: '#ef4444' }} onClick={onConfirm}>Confirm</button>
      </div>
    </div>
  </div>
);

export const DeveloperPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([
    { ts: nowTime(), level: 'info', msg: 'Developer panel loaded. All actions are logged here.' },
  ]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteCallId, setDeleteCallId] = useState('');
  const [confirm, setConfirm] = useState<{ msg: string; action: () => void } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((level: LogEntry['level'], msg: string) => {
    setLogs(prev => [...prev, { ts: nowTime(), level, msg }]);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    addLog('info', 'Fetching system stats...');
    const data = await api.developerGetStats();
    setStats(data as unknown as Stats);
    if ((data as unknown as Stats).offline) {
      addLog('warn', 'Backend offline – stats unavailable.');
    } else {
      addLog('success', `Stats: ${data.totalSessions} sessions, ID seq @ ${data.callIdSequence}`);
    }
    setLoadingStats(false);
  }, [addLog]);


  useEffect(() => { loadStats(); }, [loadStats]);

  const handleResetAll = () => {
    setConfirm({
      msg: 'DELETE all call sessions and analysis data from the backend. Continue?',
      action: async () => {
        setConfirm(null);
        setBusy('reset');
        addLog('warn', 'Sending RESET ALL to backend...');
        const res = await api.developerResetAll();
        res.success ? addLog('success', `Reset complete: ${res.message}`) : addLog('error', `Reset failed: ${res.message}`);
        setBusy(null);
        loadStats();
      },
    });
  };

  const handleSeed = async () => {
    setBusy('seed');
    addLog('info', 'Seeding demo call...');
    const res = await api.developerSeedDemo();
    res.success ? addLog('success', `Demo created: ${res.callId} — ${res.message}`) : addLog('error', `Seed failed: ${res.message}`);
    setBusy(null);
    loadStats();
  };

  const handleDeleteCall = () => {
    const id = deleteCallId.trim();
    if (!id) { addLog('warn', 'Enter a Call ID first.'); return; }
    setConfirm({
      msg: `Delete call "${id}"? Cannot be undone.`,
      action: async () => {
        setConfirm(null);
        setBusy('delete');
        addLog('warn', `Deleting call ${id}...`);
        const res = await api.developerDeleteCall(id);
        if (res.success) { addLog('success', `Deleted: ${res.message}`); setDeleteCallId(''); }
        else addLog('error', `Delete failed: ${res.message}`);
        setBusy(null);
        loadStats();
      },
    });
  };

  const handleClearStorage = () => {
    setConfirm({
      msg: 'Clear all audio_deepcheck_* localStorage keys and sessionStorage?',
      action: () => {
        setConfirm(null);
        const keys = Object.keys(localStorage).filter(k => k.startsWith('audio_deepcheck'));
        keys.forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
        addLog('success', `Cleared ${keys.length} localStorage key(s) + sessionStorage.`);
      },
    });
  };

  const handleClearLog = () => setLogs([{ ts: nowTime(), level: 'info', msg: 'Log cleared.' }]);

  return (
    <div style={styles.page}>
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={confirm.action} onCancel={() => setConfirm(null)} />}

      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🛠️</span>
          <div>
            <h1 style={styles.title}>Developer Control Panel</h1>
            <p style={styles.subtitle}>Hidden endpoint — accessible via <code style={styles.code}>/developer</code> only. Not shown in sidebar.</p>
          </div>
        </div>
        <span style={styles.warningBadge}>⚠ Dev Only</span>
      </div>

      <div style={styles.grid}>

        {/* Stats */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>📊 Live Stats</h2>
          {loadingStats ? <p style={styles.muted}>Loading…</p> : stats ? (
            <table style={styles.table}><tbody>
              <tr><td style={styles.td}>Total Sessions</td><td style={{ ...styles.td, color: '#34d399' }}>{String(stats.totalSessions)}</td></tr>
              <tr><td style={styles.td}>ID Sequence</td><td style={{ ...styles.td, color: '#60a5fa' }}>{String(stats.callIdSequence)}</td></tr>
              <tr><td style={styles.td}>Backend</td><td style={{ ...styles.td, color: stats.offline ? '#f87171' : '#34d399' }}>{stats.offline ? 'OFFLINE' : 'ONLINE'}</td></tr>
              <tr><td style={styles.td}>Checked At</td><td style={{ ...styles.td, color: '#94a3b8' }}>{new Date(stats.timestamp).toLocaleTimeString()}</td></tr>
            </tbody></table>
          ) : <p style={styles.muted}>No data.</p>}
          <button style={{ ...styles.btn, marginTop: 12 }} onClick={loadStats} disabled={loadingStats}>🔄 Refresh</button>
        </div>

        {/* Data Reset */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>🗑️ Data Reset</h2>
          <p style={styles.muted}>Purge all backend sessions & analyses. Resets ID counter to 1000.</p>
          <button style={{ ...styles.btn, background: '#7f1d1d', border: '1px solid #ef4444', width: '100%', marginTop: 8 }}
            onClick={handleResetAll} disabled={busy === 'reset'}>
            {busy === 'reset' ? '⏳ Resetting…' : '💥 Purge All Call History & Analyses'}
          </button>
          <p style={{ ...styles.muted, marginTop: 16 }}>Seed a fresh demo call after reset:</p>
          <button style={{ ...styles.btn, background: '#14532d', border: '1px solid #22c55e', width: '100%', marginTop: 6 }}
            onClick={handleSeed} disabled={busy === 'seed'}>
            {busy === 'seed' ? '⏳ Seeding…' : '🌱 Seed Demo Call'}
          </button>
        </div>

        {/* Delete Single Call */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>🔍 Delete Single Call</h2>
          <p style={styles.muted}>Delete one call session by its ID.</p>
          <input style={styles.input} placeholder="e.g. CALL-1001"
            value={deleteCallId} onChange={e => setDeleteCallId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleDeleteCall()} />
          <button style={{ ...styles.btn, background: '#7c3aed', border: '1px solid #a78bfa', width: '100%', marginTop: 8 }}
            onClick={handleDeleteCall} disabled={busy === 'delete'}>
            {busy === 'delete' ? '⏳ Deleting…' : '❌ Delete Call'}
          </button>
        </div>

        {/* Browser Storage */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>🧹 Browser Storage</h2>
          <p style={styles.muted}>Clears all <code style={styles.code}>audio_deepcheck_*</code> localStorage keys and sessionStorage. Does NOT affect backend.</p>
          <button style={{ ...styles.btn, background: '#1e3a5f', border: '1px solid #60a5fa', width: '100%', marginTop: 12 }}
            onClick={handleClearStorage}>
            🗑️ Clear LocalStorage & SessionStorage
          </button>
        </div>

      </div>

      {/* Activity Log */}
      <div style={{ ...styles.card, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ ...styles.cardTitle, marginBottom: 0 }}>📜 Activity Log</h2>
          <button style={{ ...styles.btn, padding: '4px 12px', fontSize: 12 }} onClick={handleClearLog}>Clear</button>
        </div>
        <div ref={logRef} style={styles.logBox}>
          {logs.map((entry, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <span style={{ color: '#64748b', marginRight: 8, fontSize: 11 }}>[{entry.ts}]</span>
              <span style={{ color: badgeColor(entry.level), fontWeight: 600, marginRight: 6 }}>{entry.level.toUpperCase()}</span>
              <span style={{ color: '#cbd5e1' }}>{entry.msg}</span>
            </div>
          ))}
        </div>
      </div>

      <p style={{ ...styles.muted, marginTop: 16, textAlign: 'center', fontSize: 11 }}>
        🔒 Not linked from the sidebar. Share this URL only with developers.
      </p>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page:         { minHeight: '100vh', background: '#0f172a', padding: '32px 28px', fontFamily: "'Inter','Segoe UI',sans-serif", color: '#e2e8f0', maxWidth: 1200, margin: '0 auto' },
  header:       { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, paddingBottom: 20, borderBottom: '1px solid #1e293b', flexWrap: 'wrap', gap: 12 },
  title:        { margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' },
  subtitle:     { margin: '4px 0 0', fontSize: 13, color: '#64748b' },
  warningBadge: { background: '#7c2d12', border: '1px solid #ea580c', color: '#fb923c', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 },
  card:         { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20 },
  cardTitle:    { margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#f1f5f9' },
  btn:          { background: '#334155', border: '1px solid #475569', color: '#e2e8f0', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  input:        { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginTop: 8 },
  muted:        { color: '#64748b', fontSize: 13, margin: '0 0 4px', lineHeight: 1.5 },
  code:         { background: '#0f172a', border: '1px solid #334155', borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace', fontSize: 12, color: '#a78bfa' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  td:           { padding: '5px 4px', color: '#94a3b8', borderBottom: '1px solid #1e293b' },
  logBox:       { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '12px 14px', height: 200, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  dialog:       { background: '#1e293b', border: '1px solid #475569', borderRadius: 12, padding: 28, maxWidth: 420, width: '90%' },
};

export default DeveloperPage;
