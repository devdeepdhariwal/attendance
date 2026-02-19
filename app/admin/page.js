'use client';
import { useState, useEffect, useRef } from 'react';

const REFRESH_INTERVAL = 15;

export default function AdminPage() {
  const [password, setPassword]       = useState('');
  const [loggedIn, setLoggedIn]       = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessionId, setSessionId]     = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [creating, setCreating]       = useState(false);
  const [error, setError]             = useState('');

  // Independent window states
  const [checkinActive, setCheckinActive]   = useState(false);
  const [checkoutActive, setCheckoutActive] = useState(false);
  const [checkinQR, setCheckinQR]           = useState('');
  const [checkoutQR, setCheckoutQR]         = useState('');
  const [checkinCountdown, setCheckinCountdown]   = useState(REFRESH_INTERVAL);
  const [checkoutCountdown, setCheckoutCountdown] = useState(REFRESH_INTERVAL);

  const [report, setReport] = useState({ complete: [], incomplete: [], checkedIn: 0, total: 0 });

  const checkinTimer  = useRef(null);
  const checkoutTimer = useRef(null);
  const reportTimer   = useRef(null);

  // ── QR fetch ──────────────────────────────────────────────────────────────
  async function fetchQR(type) {
    const res  = await fetch(`/api/session/qr?sessionId=${sessionId}&type=${type}&adminPassword=${password}`);
    const data = await res.json();
    if (type === 'checkin')  setCheckinQR(data.qr  || '');
    if (type === 'checkout') setCheckoutQR(data.qr || '');
  }

  // ── Start rotating QR for a window ────────────────────────────────────────
  function startQRLoop(type) {
    const setCountdown = type === 'checkin' ? setCheckinCountdown : setCheckoutCountdown;
    const timerRef     = type === 'checkin' ? checkinTimer        : checkoutTimer;

    clearInterval(timerRef.current);
    setCountdown(REFRESH_INTERVAL);
    let secs = REFRESH_INTERVAL;

    timerRef.current = setInterval(() => {
      secs--;
      setCountdown(secs);
      if (secs <= 0) {
        secs = REFRESH_INTERVAL;
        setCountdown(REFRESH_INTERVAL);
        fetchQR(type);
      }
    }, 1000);
  }

  // ── Open / Close window ───────────────────────────────────────────────────
  async function toggleWindow(type, action) {
    await fetch('/api/session/window', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, type, action, adminPassword: password }),
    });

    if (type === 'checkin') {
      if (action === 'open') {
        setCheckinActive(true);
        await fetchQR('checkin');
        startQRLoop('checkin');
      } else {
        setCheckinActive(false);
        setCheckinQR('');
        clearInterval(checkinTimer.current);
      }
    } else {
      if (action === 'open') {
        setCheckoutActive(true);
        await fetchQR('checkout');
        startQRLoop('checkout');
      } else {
        setCheckoutActive(false);
        setCheckoutQR('');
        clearInterval(checkoutTimer.current);
      }
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  async function fetchReport(sid) {
    const res  = await fetch(`/api/session/report?sessionId=${sid}&adminPassword=${password}`);
    const data = await res.json();
    if (res.ok) setReport(data);
  }

  // ── Create session ─────────────────────────────────────────────────────────
  async function createSession() {
    setCreating(true); setError('');
    const res  = await fetch('/api/session/create', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sessionName || 'Club Session', adminPassword: password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setCreating(false); return; }

    setSessionId(data.sessionId);
    setSessionActive(true);
    setCreating(false);
    reportTimer.current = setInterval(() => fetchReport(data.sessionId), 5000);
    fetchReport(data.sessionId);
  }

  // ── End session ────────────────────────────────────────────────────────────
  async function endSession() {
    if (!confirm('End the entire session?')) return;
    await fetch('/api/session/end', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, adminPassword: password }),
    });
    clearInterval(checkinTimer.current);
    clearInterval(checkoutTimer.current);
    clearInterval(reportTimer.current);
    setSessionActive(false);
    setSessionId(null);
    setCheckinActive(false);
    setCheckoutActive(false);
    setCheckinQR('');
    setCheckoutQR('');
    setReport({ complete: [], incomplete: [], checkedIn: 0, total: 0 });
    setSessionName('');
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────
  function exportCSV() {
    const all  = [...(report.complete || []), ...(report.incomplete || [])];
    const rows = [
      ['Name', 'Email', 'Roll No', 'Department', 'Check-In', 'Check-Out', 'Status'],
      ...all.map(r => [
        r.name, r.email, r.rollNo, r.department,
        r.checkIn  ? new Date(r.checkIn).toLocaleTimeString()  : '',
        r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '',
        r.checkOut ? 'Complete' : 'Pending',
      ]),
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `attendance_${sessionId}.csv`;
    a.click();
  }

  useEffect(() => () => {
    clearInterval(checkinTimer.current);
    clearInterval(checkoutTimer.current);
    clearInterval(reportTimer.current);
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  if (!loggedIn) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">🔐 Admin Login</h1>
        <p className="text-slate-500 text-sm mb-6">Enter your admin password to continue.</p>
        <input type="password" placeholder="Admin Password"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setLoggedIn(true)}
          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button onClick={() => setLoggedIn(true)}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors">
          Login →
        </button>
      </div>
    </div>
  );

  // ── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-slate-800">🎓 Attendance Dashboard</h1>

        {/* Create Session */}
        {!sessionActive ? (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-lg font-semibold text-slate-700 mb-4">Create New Session</h2>
            <input placeholder="Session Name (e.g. Web Dev Workshop — Morning)"
              value={sessionName} onChange={e => setSessionName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <button onClick={createSession} disabled={creating}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">
              {creating ? 'Creating...' : '🚀 Create Session'}
            </button>
          </div>
        ) : (
          <>
            {/* Session Header */}
            <div className="bg-white rounded-2xl shadow p-5 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">{sessionName || 'Club Session'}</h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {sessionId}</p>
              </div>
              <button onClick={endSession}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
                🛑 End Session
              </button>
            </div>

            {/* Check-In and Check-Out Windows — side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Check-In Window */}
              <div className="bg-white rounded-2xl shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-800">🟢 Check-In Window</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Open when session starts</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold
                    ${checkinActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {checkinActive ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>

                {checkinActive && checkinQR && (
                  <div className="text-center mb-4">
                    <img src={checkinQR} alt="Check-In QR" className="w-48 h-48 mx-auto rounded-lg border border-green-200" />
                    <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all duration-1000"
                        style={{ width: `${(checkinCountdown / REFRESH_INTERVAL) * 100}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Refreshes in {checkinCountdown}s</p>
                  </div>
                )}

                {!checkinActive && (
                  <button onClick={() => toggleWindow('checkin', 'open')}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
                    ▶ Open Check-In
                  </button>
                )}
                {checkinActive && (
                  <button onClick={() => toggleWindow('checkin', 'close')}
                    className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2.5 rounded-lg text-sm transition-colors">
                    ⏹ Close Check-In
                  </button>
                )}
              </div>

              {/* Check-Out Window */}
              <div className="bg-white rounded-2xl shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-800">🟡 Check-Out Window</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Open when session ends</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold
                    ${checkoutActive ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    {checkoutActive ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>

                {checkoutActive && checkoutQR && (
                  <div className="text-center mb-4">
                    <img src={checkoutQR} alt="Check-Out QR" className="w-48 h-48 mx-auto rounded-lg border border-amber-200" />
                    <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                        style={{ width: `${(checkoutCountdown / REFRESH_INTERVAL) * 100}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Refreshes in {checkoutCountdown}s</p>
                  </div>
                )}

                {!checkoutActive && (
                  <button onClick={() => toggleWindow('checkout', 'open')}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
                    ▶ Open Check-Out
                  </button>
                )}
                {checkoutActive && (
                  <button onClick={() => toggleWindow('checkout', 'close')}
                    className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2.5 rounded-lg text-sm transition-colors">
                    ⏹ Close Check-Out
                  </button>
                )}
              </div>
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

            {/* Table */}
            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">📊 Live Attendance</h2>
                <button onClick={exportCSV}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                  ⬇️ Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-left">
                      {['Name','Email','Roll No','Department','Check-In','Check-Out','Status'].map(h => (
                        <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...(report.complete || []), ...(report.incomplete || [])].length === 0 ? (
                      <tr><td colSpan={7} className="text-center text-slate-400 py-8">No check-ins yet</td></tr>
                    ) : (
                      [...(report.complete || []), ...(report.incomplete || [])].map((r, i) => (
                        <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-medium">{r.name}</td>
                          <td className="px-3 py-2.5 text-slate-500">{r.email}</td>
                          <td className="px-3 py-2.5">{r.rollNo}</td>
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
          </>
        )}
      </div>
    </div>
  );
}
