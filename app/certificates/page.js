'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StepUpload   from './_components/StepUpload';
import StepPosition from './_components/StepPosition';
import StepGenerate from './_components/StepGenerate';

const FONTS       = ['Georgia, serif','Times New Roman, serif','Arial, sans-serif','Verdana, sans-serif','Courier New, monospace','Palatino, serif','Garamond, serif','Trebuchet MS, sans-serif'];
const FONT_LABELS = ['Georgia','Times New Roman','Arial','Verdana','Courier New','Palatino','Garamond','Trebuchet MS'];
const STEPS       = ['Upload Template', 'Position Text', 'Generate'];

export default function CertificatesPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Template
  const [template,      setTemplate]      = useState(null);
  const [templateURL,   setTemplateURL]   = useState('');
  const [templateSize,  setTemplateSize]  = useState({ w: 0, h: 0 });
  const [saved,         setSaved]         = useState(false);

  // Name text settings
  const [namePos,      setNamePos]      = useState({ x: 50, y: 52 });
  const [nameFontSize, setNameFontSize] = useState(52);
  const [nameFont,     setNameFont]     = useState(FONTS[0]);
  const [nameBold,     setNameBold]     = useState(true);
  const [nameItalic,   setNameItalic]   = useState(false);
  const [nameColor,    setNameColor]    = useState('#1a1a1a');

  // Serial text settings
  const [serialPos,      setSerialPos]      = useState({ x: 89, y: 22 });
  const [serialFontSize, setSerialFontSize] = useState(20);
  const [serialFont,     setSerialFont]     = useState(FONTS[0]);
  const [serialBold,     setSerialBold]     = useState(false);
  const [serialItalic,   setSerialItalic]   = useState(false);
  const [serialColor,    setSerialColor]    = useState('#1a1a1a');

  const [selected,   setSelected]   = useState('name');
  const [dragging,   setDragging]   = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const canvasRef  = useRef(null);
  const canvasWrap = useRef(null);

  // Sessions
  const [sessions,    setSessions]    = useState([]);
  const [sessionId,   setSessionId]   = useState('');
  const [sessionName, setSessionName] = useState('');
  const [startSerial, setStartSerial] = useState(1);
  const [certMode,    setCertMode]    = useState('complete');
  const [generating,  setGenerating]  = useState(false);
  const [genStatus,   setGenStatus]   = useState('');

  // Per-student cert status — shared with StepGenerate
  // { [rollNo|name]: { generated: bool, sent: bool, token: string } }
  const [certStatus, setCertStatus] = useState({});

  // ── Arrow keys (step 1 only) ──────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (step !== 1) return;
      const STEP   = e.shiftKey ? 1 : 0.2;
      const setter = selected === 'name' ? setNamePos : setSerialPos;
      if (e.key === 'ArrowLeft')  { e.preventDefault(); setter(p => ({ ...p, x: Math.max(0,   p.x - STEP) })); }
      if (e.key === 'ArrowRight') { e.preventDefault(); setter(p => ({ ...p, x: Math.min(100, p.x + STEP) })); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setter(p => ({ ...p, y: Math.max(0,   p.y - STEP) })); }
      if (e.key === 'ArrowDown')  { e.preventDefault(); setter(p => ({ ...p, y: Math.min(100, p.y + STEP) })); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, selected]);

  // ── Sessions fetch — cookie sent automatically ─────────────────────────────
  useEffect(() => {
    fetch('/api/session/list')
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null; }
        return r.json();
      })
      .then(d => { if (d) setSessions(d.sessions || []); })
      .catch(console.error);
  }, []);

  // ── Template upload ────────────────────────────────────────────────────────
  function handleTemplateUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setTemplate(file);
    setSaved(false);
    const url = URL.createObjectURL(file);
    setTemplateURL(url);
    const img = new Image();
    img.onload = () => setTemplateSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }

  // ── Mark students as generated after successful generate call ─────────────
  function markAllGenerated(certTokens) {
    setCertStatus(prev => {
      const updated = { ...prev };
      certTokens.forEach(({ name, rollNo, token }) => {
        const key = rollNo || name;
        updated[key] = {
          generated: true,
          sent:      prev[key]?.sent || false,
          token,
        };
      });
      return updated;
    });
  }

  // ── Generate ───────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!template || !sessionId) return;
    setGenerating(true);
    setGenStatus('');

    const W  = templateSize.w;
    const H  = templateSize.h;
    const fd = new FormData();
    // NO adminPassword — cookie handles auth
    fd.append('template',         template);
    fd.append('sessionId',        sessionId);
    fd.append('startSerial',      startSerial);
    fd.append('mode',             certMode);
    fd.append('nameX',            (namePos.x   / 100) * W);
    fd.append('nameY',            (namePos.y   / 100) * H);
    fd.append('serialX',          (serialPos.x / 100) * W);
    fd.append('serialY',          (serialPos.y / 100) * H);
    fd.append('fontSize',         nameFontSize);
    fd.append('serialFontSize',   serialFontSize);
    fd.append('fontColor',        nameColor);
    fd.append('serialColor',      serialColor);
    fd.append('fontFamily',       nameFont);
    fd.append('serialFontFamily', serialFont);
    fd.append('nameBold',         nameBold);
    fd.append('nameItalic',       nameItalic);
    fd.append('serialBold',       serialBold);
    fd.append('serialItalic',     serialItalic);

    try {
      const res  = await fetch('/api/certificates/generate', { method: 'POST', body: fd });

      if (res.status === 401) { router.push('/login'); return; }

      const data = await res.json();

      if (!res.ok) { setGenStatus(`❌ ${data.error}`); return; }

      setGenStatus(`⏳ Generated ${data.count} certificates, preparing download...`);

      // Mark all students as generated + store their individual tokens
      if (data.certTokens?.length > 0) {
        markAllGenerated(data.certTokens);
      }

      // Trigger ZIP download
      const safeFilename = `certificates_${sessionName.replace(/\s+/g, '_')}.zip`;
      window.location.href = `/api/certificates/download?token=${data.token}&filename=${encodeURIComponent(safeFilename)}`;

      setGenStatus(`✅ ${data.count} certificates generated & downloaded!`);

    } catch (err) {
      setGenStatus(`❌ ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }

  // ── Saved settings summary ─────────────────────────────────────────────────
  const savedSettings = [
    { label: 'Name font',     value: `${nameBold ? 'Bold ' : ''}${nameItalic ? 'Italic ' : ''}${nameFontSize}px ${FONT_LABELS[FONTS.indexOf(nameFont)] || nameFont}` },
    { label: 'Name color',    value: nameColor },
    { label: 'Name position', value: `X: ${namePos.x.toFixed(1)}%  Y: ${namePos.y.toFixed(1)}%` },
    { label: 'Serial font',   value: `${serialBold ? 'Bold ' : ''}${serialItalic ? 'Italic ' : ''}${serialFontSize}px ${FONT_LABELS[FONTS.indexOf(serialFont)] || serialFont}` },
    { label: 'Serial color',  value: serialColor },
    { label: 'Serial pos',    value: `X: ${serialPos.x.toFixed(1)}%  Y: ${serialPos.y.toFixed(1)}%` },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-4 flex-wrap">
          <a href="/admin" className="text-indigo-600 hover:underline text-sm">← Dashboard</a>
          <h1 className="text-2xl font-bold text-slate-800">🏆 Certificate Generator</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (i === 0 || (i === 1 && template) || (i === 2 && saved)) setStep(i);
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors
                  ${step === i ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 shadow'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                  ${step === i ? 'bg-white text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                  {i + 1}
                </span>
                {s}
              </button>
              {i < STEPS.length - 1 && <span className="text-slate-300 font-bold">›</span>}
            </div>
          ))}
        </div>

        {/* Step 0 — Upload */}
        {step === 0 && (
          <StepUpload
            template={template} templateURL={templateURL} templateSize={templateSize}
            onUpload={handleTemplateUpload}
            onNext={() => setStep(1)}
          />
        )}

        {/* Step 1 — Position */}
        {step === 1 && (
          <StepPosition
            templateURL={templateURL}
            namePos={namePos}       setNamePos={setNamePos}
            nameFontSize={nameFontSize} setNameFontSize={setNameFontSize}
            nameFont={nameFont}     setNameFont={setNameFont}
            nameBold={nameBold}     setNameBold={setNameBold}
            nameItalic={nameItalic} setNameItalic={setNameItalic}
            nameColor={nameColor}   setNameColor={setNameColor}
            serialPos={serialPos}       setSerialPos={setSerialPos}
            serialFontSize={serialFontSize} setSerialFontSize={setSerialFontSize}
            serialFont={serialFont}     setSerialFont={setSerialFont}
            serialBold={serialBold}     setSerialBold={setSerialBold}
            serialItalic={serialItalic} setSerialItalic={setSerialItalic}
            serialColor={serialColor}   setSerialColor={setSerialColor}
            selected={selected}     setSelected={setSelected}
            dragging={dragging}     setDragging={setDragging}
            dragOffset={dragOffset} setDragOffset={setDragOffset}
            canvasRef={canvasRef}   canvasWrap={canvasWrap}
            onSave={() => { setSaved(true); setStep(2); }}
            onBack={() => setStep(0)}
          />
        )}

        {/* Step 2 — Generate */}
        {step === 2 && (
          <StepGenerate
            sessions={sessions}
            sessionId={sessionId}     setSessionId={setSessionId}
            sessionName={sessionName} setSessionName={setSessionName}
            startSerial={startSerial} setStartSerial={setStartSerial}
            certMode={certMode}       setCertMode={setCertMode}
            generating={generating}   genStatus={genStatus}
            onGenerate={handleGenerate}
            onBack={() => setStep(1)}
            templateURL={templateURL}
            namePos={namePos}       nameFontSize={nameFontSize} nameFont={nameFont}
            nameBold={nameBold}     nameItalic={nameItalic}     nameColor={nameColor}
            serialPos={serialPos}   serialFontSize={serialFontSize} serialFont={serialFont}
            serialBold={serialBold} serialItalic={serialItalic}     serialColor={serialColor}
            savedSettings={savedSettings}
            certStatus={certStatus}
            setCertStatus={setCertStatus}
          />
        )}

      </div>
    </div>
  );
}
