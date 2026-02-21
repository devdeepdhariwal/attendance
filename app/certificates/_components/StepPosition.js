import { useRef, useEffect, useCallback } from 'react';

const FONTS = [
  'Georgia, serif', 'Times New Roman, serif', 'Arial, sans-serif',
  'Verdana, sans-serif', 'Courier New, monospace', 'Palatino, serif',
  'Garamond, serif', 'Trebuchet MS, sans-serif',
];
const FONT_LABELS = [
  'Georgia', 'Times New Roman', 'Arial', 'Verdana',
  'Courier New', 'Palatino', 'Garamond', 'Trebuchet MS',
];

export default function StepPosition({
  templateURL,
  namePos, setNamePos, nameFontSize, setNameFontSize,
  nameFont, setNameFont, nameBold, setNameBold,
  nameItalic, setNameItalic, nameColor, setNameColor,
  serialPos, setSerialPos, serialFontSize, setSerialFontSize,
  serialFont, setSerialFont, serialBold, setSerialBold,
  serialItalic, setSerialItalic, serialColor, setSerialColor,
  selected, setSelected,
  dragging, setDragging, dragOffset, setDragOffset,
  canvasRef, canvasWrap,
  onSave, onBack,
}) {
  // ── Draw ──────────────────────────────────────────────────────────────────
  function drawHandle(ctx, W, H, pos, isSelected, label) {
    const x = (pos.x / 100) * W;
    const y = (pos.y / 100) * H;
    const r = 8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = isSelected ? 'rgba(99,102,241,0.85)' : 'rgba(245,158,11,0.75)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.font         = 'bold 13px Arial, sans-serif';
    ctx.fillStyle    = isSelected ? '#4338ca' : '#92400e';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(` ${label}`, x + r + 4, y);
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !templateURL) return;
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
      ctx.fillText('Sr. No.:01', (serialPos.x / 100) * W, (serialPos.y / 100) * H);

      drawHandle(ctx, W, H, namePos,   selected === 'name',   '✦ NAME');
      drawHandle(ctx, W, H, serialPos, selected === 'serial', '# SR NO');
    };
    img.src = templateURL;
  }, [templateURL, namePos, serialPos, nameFontSize, serialFontSize,
      nameFont, serialFont, nameBold, nameItalic, nameColor,
      serialBold, serialItalic, serialColor, selected]);

  useEffect(() => { draw(); }, [draw]);

  // ── Drag ──────────────────────────────────────────────────────────────────
  function getPos(e) {
    const wrap = canvasWrap.current;
    if (!wrap) return { x: 0, y: 0 };
    const rect    = wrap.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width)  * 100,
      y: ((clientY - rect.top)  / rect.height) * 100,
    };
  }

  function onMouseDown(e) {
    const pos        = getPos(e);
    const nd         = Math.hypot(pos.x - namePos.x,   pos.y - namePos.y);
    const sd         = Math.hypot(pos.x - serialPos.x, pos.y - serialPos.y);
    if (nd < 6 && nd <= sd) {
      setDragging('name');   setSelected('name');
      setDragOffset({ x: pos.x - namePos.x,   y: pos.y - namePos.y });
    } else if (sd < 6) {
      setDragging('serial'); setSelected('serial');
      setDragOffset({ x: pos.x - serialPos.x, y: pos.y - serialPos.y });
    }
  }

  function onMouseMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const pos  = getPos(e);
    const newX = Math.max(0, Math.min(100, pos.x - dragOffset.x));
    const newY = Math.max(0, Math.min(100, pos.y - dragOffset.y));
    if (dragging === 'name')   setNamePos({   x: newX, y: newY });
    if (dragging === 'serial') setSerialPos({ x: newX, y: newY });
  }

  function onMouseUp() { setDragging(null); }

  // ── Field configs ──────────────────────────────────────────────────────────
  const fields = [
    { key: 'name',   label: '✦ Name Field',
      pos: namePos, setPos: setNamePos,
      fontSize: nameFontSize, setFontSize: setNameFontSize,
      font: nameFont, setFont: setNameFont,
      bold: nameBold, setBold: setNameBold,
      italic: nameItalic, setItalic: setNameItalic,
      color: nameColor, setColor: setNameColor },
    { key: 'serial', label: '# Serial No Field',
      pos: serialPos, setPos: setSerialPos,
      fontSize: serialFontSize, setFontSize: setSerialFontSize,
      font: serialFont, setFont: setSerialFont,
      bold: serialBold, setBold: setSerialBold,
      italic: serialItalic, setItalic: setSerialItalic,
      color: serialColor, setColor: setSerialColor },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
      {/* Controls */}
      <div className="space-y-4">

        {/* Field selector */}
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Editing Field</p>
          <div className="grid grid-cols-2 gap-2">
            {[{ key: 'name', label: '✦ Name', color: 'bg-indigo-600' },
              { key: 'serial', label: '# Serial No', color: 'bg-amber-500' }].map(f => (
              <button key={f.key} onClick={() => setSelected(f.key)}
                className={`py-2 rounded-lg text-sm font-semibold transition-colors
                  ${selected === f.key ? `${f.color} text-white` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active field settings */}
        {fields.map(f => selected === f.key && (
          <div key={f.key} className="bg-white rounded-2xl shadow p-4 space-y-4">
            <p className="text-sm font-semibold text-slate-700">{f.label}</p>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Font</label>
              <select value={f.font} onChange={e => f.setFont(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {FONTS.map((font, i) => <option key={font} value={font}>{FONT_LABELS[i]}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Font Size: <span className="text-indigo-600 font-bold">{f.fontSize}px</span>
              </label>
              <div className="flex items-center gap-2">
                <button onClick={() => f.setFontSize(s => Math.max(8, s - 1))}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center text-lg">−</button>
                <input type="range" min="8" max="150" value={f.fontSize}
                  onChange={e => f.setFontSize(parseInt(e.target.value))}
                  className="flex-1 accent-indigo-600" />
                <button onClick={() => f.setFontSize(s => Math.min(150, s + 1))}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center text-lg">+</button>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => f.setBold(b => !b)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors
                  ${f.bold ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                B Bold
              </button>
              <button onClick={() => f.setItalic(iv => !iv)}
                className={`flex-1 py-2 rounded-lg text-sm italic border transition-colors
                  ${f.italic ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                I Italic
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={f.color} onChange={e => f.setColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                <input type="text" value={f.color} onChange={e => f.setColor(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            </div>

            {/* Nudge pad */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-2">Nudge <span className="text-slate-400">(or arrow keys)</span></label>
              <div className="grid grid-cols-3 gap-1.5 w-32 mx-auto">
                <div /><button onClick={() => f.setPos(p => ({ ...p, y: Math.max(0, p.y - 0.5) }))} className="bg-slate-100 hover:bg-slate-200 rounded-lg py-1.5 text-lg font-bold">↑</button><div />
                <button onClick={() => f.setPos(p => ({ ...p, x: Math.max(0, p.x - 0.5) }))} className="bg-slate-100 hover:bg-slate-200 rounded-lg py-1.5 text-lg font-bold">←</button>
                <div className="bg-slate-50 rounded-lg flex items-center justify-center text-xs text-slate-300">✦</div>
                <button onClick={() => f.setPos(p => ({ ...p, x: Math.min(100, p.x + 0.5) }))} className="bg-slate-100 hover:bg-slate-200 rounded-lg py-1.5 text-lg font-bold">→</button>
                <div /><button onClick={() => f.setPos(p => ({ ...p, y: Math.min(100, p.y + 0.5) }))} className="bg-slate-100 hover:bg-slate-200 rounded-lg py-1.5 text-lg font-bold">↓</button><div />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400">X %</label>
                <input type="number" min="0" max="100" step="0.5" value={f.pos.x.toFixed(1)}
                  onChange={e => f.setPos(p => ({ ...p, x: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Y %</label>
                <input type="number" min="0" max="100" step="0.5" value={f.pos.y.toFixed(1)}
                  onChange={e => f.setPos(p => ({ ...p, y: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            </div>
          </div>
        ))}

        <button onClick={onSave}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl text-sm transition-colors">
          💾 Save Settings & Continue →
        </button>
        <button onClick={onBack}
          className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 rounded-xl text-sm transition-colors">
          ← Back
        </button>
      </div>

      {/* Canvas */}
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm font-semibold text-slate-700">
            Live Preview — <span className="text-indigo-500">drag dots</span> or use arrow keys
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" /> Name</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Serial</span>
          </div>
        </div>
        <div
          ref={canvasWrap}
          className="relative rounded-xl overflow-hidden border border-slate-200"
          style={{ cursor: dragging ? 'grabbing' : 'crosshair' }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onTouchStart={e => { e.preventDefault(); onMouseDown(e); }}
          onTouchMove={e => { e.preventDefault(); onMouseMove(e); }}
          onTouchEnd={onMouseUp}
        >
          <canvas ref={canvasRef} className="w-full block" />
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Select a field, drag its dot, or use ← → ↑ ↓ (hold Shift for bigger steps).
        </p>
      </div>
    </div>
  );
}
