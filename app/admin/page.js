'use client';
import { useState, useEffect, useRef } from 'react';

const REFRESH_INTERVAL = 15;

export default function AdminPage() {
  const [password, setPassword]           = useState('');
  const [loggedIn, setLoggedIn]           = useState(false);
  const [sessionName, setSessionName]     = useState('');
  const [sessionId, setSessionId]         = useState(null);
  const [activeSession, setActiveSession] = useState(false);
  const [phase, setPhase]                 = useState('checkin'); // 'checkin' | 'checkout'
  const [currentQR, setCurrentQR]         = useState('');
  const [countdown, setCountdown]         = useState(REFRESH_INTERVAL);
  const [report, setReport]               = useState({ complete: [], incomplete: [], checkedIn: 0, total: 0 });
  const [creating, setCreating]           = useState(false);
  const [error, setError]                 = useState('');

  const qrTimer     = useRef(null);
  const reportTimer = useRef(null);
  const phaseRef    = useRef('checkin'); // ref so interval always reads latest phase

  // ── Fetch QR for current phase ─────────────────────────────────────────────
  async function fetchQR(sid, qrPhase) {
    const res  = await fetch(`/api/session/qr?sessionId=${sid}&type=${qrPhase}&adminPassword=${password}`);
    const data = await res.json();
    if (data.qr) setCurrentQR(data.qr);
  }

  // ── Start rotating QR loop ─────────────────────────────────────────────────
  function startQRLoop(sid) {
    clearInterval(qrTimer.current);
    setCountdown(REFRESH_INTERVAL);
    let secs = REFRESH_INTERVAL;
    qrTimer.current = setInterval(() => {
      secs--;
      setCountdown(secs);
      if (secs <= 0) {
        secs = REFRESH_INTERVAL;
        setCountdown(REFRESH_INTERVAL);
        fetchQR(sid, phaseRef.current); // always use latest phase
      }
    }, 1000);
  }

  // ── Switch to Check-Out phase ──────────────────────────────────────────────
  async function switchToCheckout() {
    if (!confirm('Switch to Check-Out phase? Students will no longer be able to check in.')) return;
    phaseRef.current = 'checkout';
    setPhase('checkout');
    setCurrentQR('');
    await fetchQR(sessionId, 'checkout');
  }

  // ── Report polling ─────────────────────────────────────────────────────────
  async function fetchReport(sid) {
    const res  = await fetch(`/api/session/report?sessionId=${sid}&adminPassword=${password}`);
    const data = await res.json();
    if (res.ok) setReport(data);
  }

  function startReportLoop(sid) {
    fetchReport(sid);
    reportTimer.current = setInterval(() => fetchReport(sid), 5000);
  }

  // ── Create Session ─────────────────────────────────────────────────────────
  async function createSession() {
    setCreating(true);
    setError('');
    const res  = await fetch('/api/session/create', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sessionName || 'Club Session', adminPassword: password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setCreating(false); return; }

    const sid = data.sessionId;
    setSessionId(sid);
    setActiveSession(true);
    phaseRef.current = 'checkin';
    setPhase('checkin');
    await fetchQR(sid, 'checkin');
    startQRLoop(sid);
    startReportLoop(sid);
    setCreating(false);
  }

  // ── End Session ────────────────────────────────────────────────────────────
  async function endSession() {
    if (!confirm('End this session completely?')) return;
    await fetch('/api/session/end', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, adminPassword: password }),
    });
    clearInterval(qrTimer.current);
    clearInterval(reportTimer.current);
    setActiveSession(false);
    setSessionId(null);
    setCurrentQR('');
    setPhase('checkin');
    phaseRef.current = 'checkin';
    setReport({ complete: [], incomplete: [], checkedIn: 0, total: 0 });
    setSessionName('');
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────
  function exportCSV() {
    const all  = [...(report.complete || []), ...(report.incomplete || [])];
    const rows = [
      ['Name', 'Email', 'Department', 'Check-In', 'Check-Out', 'Status'],
      ...all.map(r => [
        r.name, r.email, r.department,
        r.checkIn  ? new Date(r.checkIn).toLocaleTimeString()  : '',
        r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '',
        r.checkOut ? 'Complete' : 'Pending',
      ]),
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `attendance_${sessionId || 'report'}.csv`;
    a.click();
  }

  useEffect(() => () => {
    clearInterval(qrTimer.current);
    clearInterval(reportTimer.current);
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  if (!loggedIn) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">🔐 Admin Login</h1>
        <p className="text-slate-500 text-sm mb-6">Enter your admin password to continue.</p>
        <input
          type="password"
          placeholder="Admin Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setLoggedIn(true)}
          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={() => setLoggedIn(true)}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
        >
          Login →
        </button>
      </div>
    </div>
  );

  // ── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        <h1 className="text-3xl font-bold text-slate-800">🎓 Attendance Dashboard</h1>

        {/* Session Card */}
        <div className="bg-white rounded-2xl shadow p-6">
          {!activeSession ? (
            <>
              <h2 className="text-lg font-semibold text-slate-700 mb-4">Create New Session</h2>
              <input
                placeholder="Session Name (e.g. Web Dev Workshop)"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
              <button
                onClick={createSession}
                disabled={creating}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
              >
                {creating ? 'Creating...' : '🚀 Start Session'}
              </button>
            </>
          ) : (
            <>
              {/* Session Header */}
              <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{sessionName || 'Club Session'}</h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {sessionId}</p>
                </div>
                <button
                  onClick={endSession}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
                >
                  🛑 End Session
                </button>
              </div>

              {/* Phase indicator */}
              <div className="flex items-center gap-3 mb-6">
                <span className={`px-4 py-1.5 rounded-full text-sm font-semibold
                  ${phase === 'checkin' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                  ① Check-In
                </span>
                <span className="text-slate-300 font-bold">→</span>
                <span className={`px-4 py-1.5 rounded-full text-sm font-semibold
                  ${phase === 'checkout' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                  ② Check-Out
                </span>
              </div>

              {/* QR Display */}
              <div className={`border-2 rounded-xl p-6 text-center max-w-xs mx-auto
                ${phase === 'checkin' ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
                <p className="font-semibold text-slate-700 mb-3 text-lg">
                  {phase === 'checkin' ? '🟢 Check-In QR' : '🟡 Check-Out QR'}
                </p>
                {currentQR
                  ? <img src={currentQR} alt="QR Code" className="w-52 h-52 mx-auto rounded-lg" />
                  : <div className="w-52 h-52 mx-auto bg-slate-200 rounded-lg animate-pulse" />
                }
                {/* Countdown bar */}
                <div className="mt-4 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                    style={{ width: `${(countdown / REFRESH_INTERVAL) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">QR refreshes in {countdown}s</p>
              </div>

              {/* Switch to checkout button — only in checkin phase */}
              {phase === 'checkin' && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-slate-500 mb-3">
                    When everyone has checked in, switch to Check-Out phase.
                  </p>
                  <button
                    onClick={switchToCheckout}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
                  >
                    Switch to Check-Out Phase →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { num: report.checkedIn,              label: 'Checked In',     color: 'text-indigo-600' },
            { num: report.total,                   label: 'Complete ✅',    color: 'text-green-600'  },
            { num: report.incomplete?.length || 0, label: 'Not Out Yet ⏳', color: 'text-amber-600'  },
          ].map(({ num, label, color }) => (
            <div key={label} className="bg-white rounded-xl shadow p-4 text-center">
              <p className={`text-3xl font-black ${color}`}>{num}</p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Attendance Table */}
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">📊 Live Attendance</h2>
            <button
              onClick={exportCSV}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              ⬇️ Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-left">
                  {['Name', 'Email', 'Department', 'Check-In', 'Check-Out', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...(report.complete || []), ...(report.incomplete || [])].length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-400 py-8">No check-ins yet</td>
                  </tr>
                ) : (
                  [...(report.complete || []), ...(report.incomplete || [])].map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-medium">{r.name}</td>
                      <td className="px-3 py-2.5 text-slate-500">{r.email}</td>
                      <td className="px-3 py-2.5">{r.department}</td>
                      <td className="px-3 py-2.5">{r.checkIn  ? new Date(r.checkIn).toLocaleTimeString()  : '—'}</td>
                      <td className="px-3 py-2.5">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                          ${r.checkOut ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {r.checkOut ? '✅ Complete' : '⏳ Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
