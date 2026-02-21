'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const REFRESH_INTERVAL = 15;

export default function AdminPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('live');

  // Live session state
  const [sessionName,      setSessionName]      = useState('');
  const [sessionId,        setSessionId]        = useState(null);
  const [sessionActive,    setSessionActive]    = useState(false);
  const [creating,         setCreating]         = useState(false);
  const [error,            setError]            = useState('');
  const [checkinActive,    setCheckinActive]    = useState(false);
  const [checkoutActive,   setCheckoutActive]   = useState(false);
  const [checkinQR,        setCheckinQR]        = useState('');
  const [checkoutQR,       setCheckoutQR]       = useState('');
  const [checkinCountdown, setCheckinCountdown] = useState(REFRESH_INTERVAL);
  const [checkoutCountdown,setCheckoutCountdown]= useState(REFRESH_INTERVAL);
  const [report, setReport] = useState({ complete: [], incomplete: [], checkedIn: 0, total: 0 });

  // Records tab state
  const [allSessions,        setAllSessions]        = useState([]);
  const [selectedSessionId,  setSelectedSessionId]  = useState('');
  const [selectedSessionName,setSelectedSessionName]= useState('');
  const [recordsData,        setRecordsData]        = useState(null);
  const [loadingSessions,    setLoadingSessions]    = useState(false);
  const [loadingRecords,     setLoadingRecords]     = useState(false);

  const checkinTimer  = useRef(null);
  const checkoutTimer = useRef(null);
  const reportTimer   = useRef(null);

  // ── Auth error handler ─────────────────────────────────────────────────────
  function handleUnauth(res) {
    if (res.status === 401) { router.push('/login'); return true; }
    return false;
  }

  // ── QR ─────────────────────────────────────────────────────────────────────
  async function fetchQR(type) {
    const res  = await fetch(`/api/session/qr?sessionId=${sessionId}&type=${type}`);
    if (handleUnauth(res)) return;
    const data = await res.json();
    if (type === 'checkin')  setCheckinQR(data.qr  || '');
    if (type === 'checkout') setCheckoutQR(data.qr || '');
  }

  function startQRLoop(type) {
    const setCountdown = type === 'checkin' ? setCheckinCountdown : setCheckoutCountdown;
    const timerRef     = type === 'checkin' ? checkinTimer        : checkoutTimer;
    clearInterval(timerRef.current);
    setCountdown(REFRESH_INTERVAL);
    let secs = REFRESH_INTERVAL;
    timerRef.current = setInterval(() => {
      secs--;
      setCountdown(secs);
      if (secs <= 0) { secs = REFRESH_INTERVAL; setCountdown(REFRESH_INTERVAL); fetchQR(type); }
    }, 1000);
  }

  async function toggleWindow(type, action) {
    const res = await fetch('/api/session/window', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sessionId, type, action }),
    });
    if (handleUnauth(res)) return;
    if (type === 'checkin') {
      if (action === 'open') { setCheckinActive(true);  await fetchQR('checkin');  startQRLoop('checkin');  }
      else                   { setCheckinActive(false); setCheckinQR('');  clearInterval(checkinTimer.current);  }
    } else {
      if (action === 'open') { setCheckoutActive(true);  await fetchQR('checkout'); startQRLoop('checkout'); }
      else                   { setCheckoutActive(false); setCheckoutQR(''); clearInterval(checkoutTimer.current); }
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  async function fetchReport(sid) {
    const res  = await fetch(`/api/session/report?sessionId=${sid}`);
    if (handleUnauth(res)) return;
    const data = await res.json();
    if (res.ok) setReport(data);
  }

  // ── Create / End session ───────────────────────────────────────────────────
  async function createSession() {
    setCreating(true); setError('');
    const res  = await fetch('/api/session/create', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: sessionName || 'Club Session' }),
    });
    if (handleUnauth(res)) { setCreating(false); return; }
    const data = await res.json();
    if (!res.ok) { setError(data.error); setCreating(false); return; }
    setSessionId(data.sessionId);
    setSessionActive(true);
    setCreating(false);
    reportTimer.current = setInterval(() => fetchReport(data.sessionId), 5000);
    fetchReport(data.sessionId);
  }

  async function endSession() {
    if (!confirm('End the entire session?')) return;
    const res = await fetch('/api/session/end', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sessionId }),
    });
    if (handleUnauth(res)) return;
    clearInterval(checkinTimer.current);
    clearInterval(checkoutTimer.current);
    clearInterval(reportTimer.current);
    setSessionActive(false); setSessionId(null);
    setCheckinActive(false); setCheckoutActive(false);
    setCheckinQR(''); setCheckoutQR('');
    setReport({ complete: [], incomplete: [], checkedIn: 0, total: 0 });
    setSessionName('');
  }

  // ── Records tab ────────────────────────────────────────────────────────────
  async function loadAllSessions() {
    setLoadingSessions(true);
    const res  = await fetch('/api/session/list');
    if (handleUnauth(res)) { setLoadingSessions(false); return; }
    const data = await res.json();
    if (res.ok) setAllSessions(data.sessions);
    setLoadingSessions(false);
  }

  async function loadRecords(sid, sname) {
    setLoadingRecords(true);
    setSelectedSessionId(sid);
    setSelectedSessionName(sname);
    setRecordsData(null);
    const res  = await fetch(`/api/session/report?sessionId=${sid}`);
    if (handleUnauth(res)) { setLoadingRecords(false); return; }
    const data = await res.json();
    if (res.ok) setRecordsData(data);
    setLoadingRecords(false);
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function getRows(data) {
    return [...(data.complete || []), ...(data.incomplete || [])].map(r => [
      r.name, r.email, r.rollNo || '—', r.department,
      r.checkIn  ? new Date(r.checkIn).toLocaleTimeString()  : '—',
      r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '—',
      r.checkOut ? 'Complete' : 'Pending',
    ]);
  }

  function exportCSV(data, filename) {
    const rows = [['Name','Email','Roll No','Department','Check-In','Check-Out','Status'], ...getRows(data)];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${filename}.csv`;
    a.click();
  }

  function exportExcel(data, filename) {
    const rows = [['Name','Email','Roll No','Department','Check-In','Check-Out','Status'], ...getRows(data)];
    const ws   = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [20,28,12,14,12,12,10].map(w => ({ wch: w }));
    const wb   = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  function exportPDF(data, filename, sname) {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Attendance Report', 14, 15);
    doc.setFontSize(11); doc.setTextColor(100);
    doc.text(`Session: ${sname}`, 14, 23);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 29);
    doc.text(`Total: ${data.checkedIn} checked in | ${data.total} complete`, 14, 35);
    autoTable(doc, {
      startY: 42,
      head:   [['Name','Email','Roll No','Dept','Check-In','Check-Out','Status']],
      body:   getRows(data),
      styles:     { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229] },
      alternateRowStyles: { fillColor: [248, 249, 250] },
    });
    doc.save(`${filename}.pdf`);
  }

  function goToRecords() {
    setActiveTab('records');
    loadAllSessions();
  }

  useEffect(() => () => {
    clearInterval(checkinTimer.current);
    clearInterval(checkoutTimer.current);
    clearInterval(reportTimer.current);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        <h1 className="text-3xl font-bold text-slate-800">🎓 Attendance Dashboard</h1>

        {/* Tab switcher */}
        <div className="flex gap-2">
          {[
            { key: 'live',    label: '🟢 Live Session' },
            { key: 'records', label: '📁 Past Records'  },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => tab.key === 'records' ? goToRecords() : setActiveTab('live')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors
                ${activeTab === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50 shadow'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════ LIVE SESSION TAB ══════════ */}
        {activeTab === 'live' && (
          <>
            {!sessionActive ? (
              <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="text-lg font-semibold text-slate-700 mb-4">Create New Session</h2>
                <input placeholder="Session Name (e.g. Web Dev Workshop)"
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
                {/* Session header */}
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

                {/* QR Windows */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    {
                      type: 'checkin',  label: '🟢 Check-In Window',  sub: 'Open when session starts',
                      active: checkinActive,  qr: checkinQR,  countdown: checkinCountdown,
                      openColor: 'bg-green-500 hover:bg-green-600',
                      borderColor: 'border-green-200', barColor: 'bg-green-500',
                      badgeColor: checkinActive  ? 'bg-green-100 text-green-700'  : 'bg-slate-100 text-slate-500',
                    },
                    {
                      type: 'checkout', label: '🟡 Check-Out Window', sub: 'Open when session ends',
                      active: checkoutActive, qr: checkoutQR, countdown: checkoutCountdown,
                      openColor: 'bg-amber-500 hover:bg-amber-600',
                      borderColor: 'border-amber-200', barColor: 'bg-amber-500',
                      badgeColor: checkoutActive ? 'bg-amber-100 text-amber-700'  : 'bg-slate-100 text-slate-500',
                    },
                  ].map(w => (
                    <div key={w.type} className="bg-white rounded-2xl shadow p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-slate-800">{w.label}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{w.sub}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${w.badgeColor}`}>
                          {w.active ? 'OPEN' : 'CLOSED'}
                        </span>
                      </div>
                      {w.active && w.qr && (
                        <div className="text-center mb-4">
                          <img src={w.qr} alt={w.label}
                            className={`w-48 h-48 mx-auto rounded-lg border ${w.borderColor}`} />
                          <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full ${w.barColor} rounded-full transition-all duration-1000`}
                              style={{ width: `${(w.countdown / REFRESH_INTERVAL) * 100}%` }} />
                          </div>
                          <p className="text-xs text-slate-400 mt-1">Refreshes in {w.countdown}s</p>
                        </div>
                      )}
                      {!w.active
                        ? <button onClick={() => toggleWindow(w.type, 'open')}
                            className={`w-full ${w.openColor} text-white font-semibold py-2.5 rounded-lg text-sm transition-colors`}>
                            ▶ Open {w.type === 'checkin' ? 'Check-In' : 'Check-Out'}
                          </button>
                        : <button onClick={() => toggleWindow(w.type, 'close')}
                            className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2.5 rounded-lg text-sm transition-colors">
                            ⏹ Close {w.type === 'checkin' ? 'Check-In' : 'Check-Out'}
                          </button>
                      }
                    </div>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { num: report.checkedIn,              label: 'Checked In',     color: 'text-indigo-600' },
                    { num: report.total,                  label: 'Complete ✅',    color: 'text-green-600'  },
                    { num: report.incomplete?.length || 0, label: 'Not Out Yet ⏳', color: 'text-amber-600'  },
                  ].map(({ num, label, color }) => (
                    <div key={label} className="bg-white rounded-xl shadow p-4 text-center">
                      <p className={`text-3xl font-black ${color}`}>{num}</p>
                      <p className="text-xs text-slate-500 mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Live table */}
                <div className="bg-white rounded-2xl shadow p-6">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <h2 className="text-lg font-semibold text-slate-800">📊 Live Attendance</h2>
                    <div className="flex gap-2">
                      <button onClick={() => exportCSV(report, `attendance_${sessionId}`)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
                        CSV
                      </button>
                      <button onClick={() => exportExcel(report, `attendance_${sessionId}`)}
                        className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
                        Excel
                      </button>
                      <button onClick={() => exportPDF(report, `attendance_${sessionId}`, sessionName)}
                        className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
                        PDF
                      </button>
                    </div>
                  </div>
                  <AttendanceTable rows={[...(report.complete || []), ...(report.incomplete || [])]} />
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════ PAST RECORDS TAB ══════════ */}
        {activeTab === 'records' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-lg font-semibold text-slate-700 mb-4">📁 Select a Session</h2>
              {loadingSessions ? (
                <p className="text-slate-400 text-sm">Loading sessions...</p>
              ) : allSessions.length === 0 ? (
                <p className="text-slate-400 text-sm">No sessions found.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {allSessions.map(s => (
                    <button key={s._id} onClick={() => loadRecords(s._id, s.name)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors
                        ${selectedSessionId === s._id
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800 text-sm">{s.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            {new Date(s.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                            ${s.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {s.active ? 'Active' : 'Ended'}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSessionId && (
              <div className="bg-white rounded-2xl shadow p-6">
                {loadingRecords ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Loading records...</p>
                  </div>
                ) : recordsData ? (
                  <>
                    <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-800">{selectedSessionName}</h2>
                        <div className="flex gap-4 mt-2">
                          {[
                            { num: recordsData.checkedIn,               label: 'Checked In', color: 'text-indigo-600' },
                            { num: recordsData.total,                   label: 'Complete',   color: 'text-green-600'  },
                            { num: recordsData.incomplete?.length || 0, label: 'Pending',    color: 'text-amber-600'  },
                          ].map(({ num, label, color }) => (
                            <div key={label} className="text-center">
                              <p className={`text-2xl font-black ${color}`}>{num}</p>
                              <p className="text-xs text-slate-400">{label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-slate-400 font-medium">Export as:</p>
                        <div className="flex gap-2">
                          <button onClick={() => exportCSV(recordsData, `attendance_${selectedSessionName.replace(/\s+/g,'_')}`)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                            📄 CSV
                          </button>
                          <button onClick={() => exportExcel(recordsData, `attendance_${selectedSessionName.replace(/\s+/g,'_')}`)}
                            className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                            📊 Excel
                          </button>
                          <button onClick={() => exportPDF(recordsData, `attendance_${selectedSessionName.replace(/\s+/g,'_')}`, selectedSessionName)}
                            className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                            📑 PDF
                          </button>
                        </div>
                      </div>
                    </div>
                    <AttendanceTable rows={[...(recordsData.complete || []), ...(recordsData.incomplete || [])]} />
                  </>
                ) : null}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Shared table ───────────────────────────────────────────────────────────
function AttendanceTable({ rows }) {
  if (rows.length === 0)
    return <p className="text-center text-slate-400 py-8 text-sm">No records found.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-600 text-left">
            {['#','Name','Email','Roll No','Department','Check-In','Check-Out','Status'].map(h => (
              <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
              <td className="px-3 py-2.5 font-medium">{r.name}</td>
              <td className="px-3 py-2.5 text-slate-500">{r.email}</td>
              <td className="px-3 py-2.5">{r.rollNo || '—'}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
