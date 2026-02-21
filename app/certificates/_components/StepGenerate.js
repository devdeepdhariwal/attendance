'use client';
import { useState, useEffect, useRef } from 'react';

export default function StepGenerate({
  sessions, sessionId, setSessionId, sessionName, setSessionName,
  startSerial, setStartSerial, certMode, setCertMode,
  generating, genStatus, onGenerate, onBack,
  templateURL,
  namePos, nameFontSize, nameFont, nameBold, nameItalic, nameColor,
  serialPos, serialFontSize, serialFont, serialBold, serialItalic, serialColor,
  savedSettings,
  certStatus, setCertStatus,
}) {
  const finalCanvasRef = useRef(null);

  const [students,        setStudents]        = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentError,    setStudentError]    = useState('');
  const [totalInSession,  setTotalInSession]  = useState(0);
  const [filterText,      setFilterText]      = useState('');
  const [sendingEmail,    setSendingEmail]    = useState(null);
  const [sendingAll,      setSendingAll]      = useState(false);
  const [emailStatuses,   setEmailStatuses]   = useState({});
  const [previewStudent,  setPreviewStudent]  = useState(null);
  const [previewImgSrc,   setPreviewImgSrc]   = useState(null);
  const [previewLoading,  setPreviewLoading]  = useState(false);

  // ── Canvas preview ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = finalCanvasRef.current;
    if (!canvas || !templateURL) return;
    const timer = setTimeout(() => {
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const W = canvas.width, H = canvas.height;
        ctx.font         = `${nameItalic ? 'italic ' : ''}${nameBold ? 'bold ' : ''}${nameFontSize}px ${nameFont}`;
        ctx.fillStyle    = nameColor;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Sample Name', (namePos.x / 100) * W, (namePos.y / 100) * H);
        ctx.font         = `${serialItalic ? 'italic ' : ''}${serialBold ? 'bold ' : ''}${serialFontSize}px ${serialFont}`;
        ctx.fillStyle    = serialColor;
        ctx.textAlign    = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Sr. No.:${String(startSerial).padStart(2, '0')}`, (serialPos.x / 100) * W, (serialPos.y / 100) * H);
      };
      img.src = templateURL;
    }, 50);
    return () => clearTimeout(timer);
  }, [templateURL, namePos, serialPos, nameFontSize, serialFontSize,
      nameFont, serialFont, nameBold, nameItalic, nameColor,
      serialBold, serialItalic, serialColor, startSerial]);

  // ── Fetch students — NO adminPassword, cookie sent automatically ──────────
  useEffect(() => {
    if (!sessionId) { setStudents([]); setTotalInSession(0); return; }
    setLoadingStudents(true);
    setStudentError('');
    setFilterText('');
    fetch(`/api/certificates/attendees?sessionId=${encodeURIComponent(sessionId)}&mode=${certMode}`)
      .then(r => {
        if (r.status === 401) throw new Error('Session expired — please log in again');
        return r.json();
      })
      .then(data => {
        if (data.error) { setStudentError(data.error); setStudents([]); }
        else {
          setStudents(data.eligible || []);
          setTotalInSession(data.totalInSession || 0);
        }
      })
      .catch(err => setStudentError(err.message))
      .finally(() => setLoadingStudents(false));
  }, [sessionId, certMode]);

  // ── Open preview ──────────────────────────────────────────────────────────
  async function openPreview(student) {
    const key    = student.rollNo || student.name;
    const status = certStatus[key] || {};
    setPreviewStudent(student);
    setPreviewImgSrc(null);
    if (!status.token) return;
    setPreviewLoading(true);
    try {
      // Cookie is sent automatically with same-origin fetch
      const res = await fetch(`/api/certificates/preview?token=${encodeURIComponent(status.token)}`);
      if (res.ok) {
        const blob = await res.blob();
        setPreviewImgSrc(URL.createObjectURL(blob));
      }
    } catch (_) {}
    finally { setPreviewLoading(false); }
  }

  // ── Send email ────────────────────────────────────────────────────────────
  async function sendEmail(student) {
    const key    = student.rollNo || student.name;
    const status = certStatus[key] || {};
    setSendingEmail(key);
    setEmailStatuses(prev => ({ ...prev, [key]: 'sending' }));
    try {
      const res = await fetch('/api/certificates/send-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        // NO adminPassword — cookie handles auth
        body: JSON.stringify({
          sessionId,
          rollNo: student.rollNo,
          name:   student.name,
          email:  student.email,
          token:  status.token,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailStatuses(prev => ({ ...prev, [key]: 'sent' }));
        setCertStatus(prev => ({ ...prev, [key]: { ...prev[key], sent: true } }));
      } else {
        setEmailStatuses(prev => ({ ...prev, [key]: 'error' }));
        alert(`Failed to send to ${student.name}: ${data.error}`);
      }
    } catch (err) {
      setEmailStatuses(prev => ({ ...prev, [key]: 'error' }));
    } finally {
      setSendingEmail(null);
    }
  }

  // ── Send all ──────────────────────────────────────────────────────────────
  async function sendAllEmails() {
    setSendingAll(true);
    const eligible = students.filter(s => {
      const key = s.rollNo || s.name;
      return certStatus[key]?.generated && !certStatus[key]?.sent;
    });
    for (const student of eligible) await sendEmail(student);
    setSendingAll(false);
  }

  function closePreview() {
    if (previewImgSrc) URL.revokeObjectURL(previewImgSrc);
    setPreviewStudent(null);
    setPreviewImgSrc(null);
  }

  const filteredStudents = students.filter(s =>
    s.name?.toLowerCase().includes(filterText.toLowerCase()) ||
    s.rollNo?.toLowerCase().includes(filterText.toLowerCase()) ||
    s.email?.toLowerCase().includes(filterText.toLowerCase())
  );

  const generatedCount = students.filter(s =>  certStatus[s.rollNo || s.name]?.generated).length;
  const sentCount      = students.filter(s =>  certStatus[s.rollNo || s.name]?.sent).length;
  const pendingSend    = students.filter(s => {
    const key = s.rollNo || s.name;
    return certStatus[key]?.generated && !certStatus[key]?.sent;
  }).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* ── Preview modal ──────────────────────────────────────────────────── */}
      {previewStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closePreview} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="font-semibold text-slate-800">{previewStudent.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {previewStudent.rollNo && (
                    <span className="text-xs text-slate-400 font-mono">{previewStudent.rollNo}</span>
                  )}
                  {previewStudent.email && (
                    <span className="text-xs text-slate-400">{previewStudent.email}</span>
                  )}
                </div>
              </div>
              <button onClick={closePreview}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors text-sm">
                ✕
              </button>
            </div>

            <div className="p-4 min-h-32">
              {previewLoading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                  <span className="w-5 h-5 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                  <span className="text-sm">Loading certificate...</span>
                </div>
              ) : previewImgSrc ? (
                <img src={previewImgSrc} alt="Certificate"
                  className="w-full rounded-xl border border-slate-200 shadow-sm" />
              ) : (
                <div className="py-16 text-center text-slate-400">
                  <p className="text-3xl mb-2">📄</p>
                  <p className="text-sm font-medium">Certificate not generated yet</p>
                  <p className="text-xs mt-1">Click Generate Certificates first</p>
                </div>
              )}
            </div>

            {previewImgSrc && (
              <div className="px-5 pb-5 flex gap-2">
                <a
                  href={`/api/certificates/preview?token=${encodeURIComponent(certStatus[previewStudent.rollNo || previewStudent.name]?.token)}&download=1`}
                  download={`${previewStudent.name.replace(/\s+/g, '_')}_certificate.png`}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-xl text-center transition-colors">
                  ⬇ Download
                </a>
                <button
                  onClick={() => { sendEmail(previewStudent); closePreview(); }}
                  disabled={certStatus[previewStudent.rollNo || previewStudent.name]?.sent || !previewStudent.email}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                  {certStatus[previewStudent.rollNo || previewStudent.name]?.sent
                    ? '✅ Already Sent'
                    : !previewStudent.email ? '📧 No Email on Record' : '📧 Send Email'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ LEFT COLUMN ════════════════════════════════════════════════════ */}
      <div className="space-y-5">
        <div className="bg-white rounded-2xl shadow p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Generate Certificates</h2>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Select Session</label>
            <select value={sessionId}
              onChange={e => {
                setSessionId(e.target.value);
                const s = sessions.find(s => s._id === e.target.value);
                setSessionName(s?.name || '');
              }}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="">-- Select a session --</option>
              {sessions.map(s => (
                <option key={s._id} value={s._id}>
                  {s.name} — {new Date(s.createdAt).toLocaleDateString('en-IN')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-2">Who receives certificates?</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'complete', label: '✅ Fully Attended', sub: 'Check-in + Check-out' },
                { val: 'all',      label: '📋 Checked In',     sub: 'Anyone who came'      },
              ].map(opt => (
                <button key={opt.val} onClick={() => setCertMode(opt.val)}
                  className={`p-3 rounded-xl border text-left transition-colors
                    ${certMode === opt.val ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <p className="text-sm font-semibold text-slate-700">{opt.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Starting Serial Number</label>
            <input type="number" min="1" value={startSerial}
              onChange={e => setStartSerial(parseInt(e.target.value) || 1)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {sessionId && !loadingStudents && (
            <div className={`rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2
              ${students.length > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {students.length > 0
                ? `✅ ${students.length} student${students.length > 1 ? 's' : ''} eligible`
                : `⚠️ 0 eligible (${totalInSession} total in session)`}
            </div>
          )}
          {loadingStudents && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-400 animate-pulse">
              Loading students...
            </div>
          )}

          <button onClick={onGenerate}
            disabled={!sessionId || generating || students.length === 0}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-colors">
            {generating
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Generating ZIP...
                </span>
              : `🚀 Generate ${students.length > 0 ? `${students.length} ` : ''}Certificates`
            }
          </button>

          {genStatus && (
            <p className={`text-sm font-semibold ${genStatus.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
              {genStatus}
            </p>
          )}

          <button onClick={onBack}
            className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 rounded-xl text-sm transition-colors">
            ← Edit Text Settings
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">📝 Saved Settings</p>
          <div className="space-y-2 text-xs">
            {savedSettings.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="font-medium text-slate-400">{label}</span>
                <span className="text-slate-600 font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════ RIGHT COLUMN ═══════════════════════════════════════════════════ */}
      <div className="space-y-5">
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">
            Final Preview
            <span className="text-xs text-slate-400 font-normal ml-2">(real certificates will have student names)</span>
          </p>
          <canvas ref={finalCanvasRef} className="w-full rounded-xl border border-slate-200 block" />
          <p className="text-xs text-slate-400 mt-2 text-center">This is exactly how each certificate will look.</p>
        </div>

        {sessionId && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    👥 Students
                    {!loadingStudents && (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {students.length} eligible / {totalInSession} total
                      </span>
                    )}
                  </p>
                  {students.length > 0 && !loadingStudents && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">
                        📄 {generatedCount} generated
                      </span>
                      <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">
                        📧 {sentCount} sent
                      </span>
                      {pendingSend > 0 && (
                        <span className="text-xs bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full">
                          ⏳ {pendingSend} pending
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {pendingSend > 0 && (
                  <button onClick={sendAllEmails} disabled={sendingAll}
                    className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
                    {sendingAll
                      ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Sending...</>
                      : `📧 Send All (${pendingSend})`}
                  </button>
                )}
              </div>

              {students.length > 0 && (
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input type="text" placeholder="Filter by name, roll no or email..."
                    value={filterText} onChange={e => setFilterText(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
                  />
                  {filterText && (
                    <button onClick={() => setFilterText('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>

            {loadingStudents ? (
              <div className="p-4 space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
              </div>
            ) : studentError ? (
              <p className="p-5 text-sm text-red-500">{studentError}</p>
            ) : students.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <p className="text-2xl mb-2">😕</p>
                <p className="text-sm">No eligible students found.</p>
                <p className="text-xs mt-1">
                  {certMode === 'complete'
                    ? 'Try "Checked In" mode — students may not have checked out.'
                    : 'This session has no attendance records.'}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[2rem_1fr_5rem_5rem_5rem] gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  <span>#</span>
                  <span>Student</span>
                  <span className="text-center">Generated</span>
                  <span className="text-center">Sent</span>
                  <span className="text-center">Actions</span>
                </div>

                <div className="overflow-y-auto max-h-96 divide-y divide-slate-50">
                  {filteredStudents.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      No students match &quot;{filterText}&quot;
                    </div>
                  ) : (
                    filteredStudents.map((s) => {
                      const key         = s.rollNo || s.name;
                      const status      = certStatus[key] || {};
                      const emailStatus = emailStatuses[key];
                      const realIndex   = students.indexOf(s);
                      return (
                        <div key={key}
                          className="grid grid-cols-[2rem_1fr_5rem_5rem_5rem] gap-2 items-center px-4 py-2.5 hover:bg-slate-50/80 transition-colors">
                          <span className="text-xs font-mono text-slate-400">
                            {String(startSerial + realIndex).padStart(2, '0')}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{s.name}</p>
                            <div className="flex items-center gap-2">
                              {s.rollNo && <span className="text-xs text-slate-400 font-mono truncate">{s.rollNo}</span>}
                              {!s.email  && <span className="text-xs text-amber-500">no email</span>}
                            </div>
                          </div>
                          <div className="flex justify-center">
                            {status.generated
                              ? <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">✓</span>
                              : <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 text-xs">–</span>}
                          </div>
                          <div className="flex justify-center">
                            {emailStatus === 'sending'
                              ? <span className="w-4 h-4 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
                              : status.sent
                                ? <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-bold">✓</span>
                                : emailStatus === 'error'
                                  ? <span title="Failed — click to retry" onClick={() => sendEmail(s)}
                                      className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-xs cursor-pointer">✕</span>
                                  : <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 text-xs">–</span>}
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openPreview(s)} title="View certificate"
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-600 text-slate-500 flex items-center justify-center transition-colors text-xs">
                              👁
                            </button>
                            <button onClick={() => sendEmail(s)}
                              disabled={!status.generated || status.sent || sendingEmail === key || !s.email}
                              title={!s.email ? 'No email on record' : !status.generated ? 'Generate first' : status.sent ? 'Already sent' : 'Send email'}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 flex items-center justify-center transition-colors text-xs">
                              📧
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {filterText
                      ? `Showing ${filteredStudents.length} of ${students.length} students`
                      : `${students.length} student${students.length !== 1 ? 's' : ''} total`}
                  </span>
                  {filterText && (
                    <button onClick={() => setFilterText('')}
                      className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                      Clear filter
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
