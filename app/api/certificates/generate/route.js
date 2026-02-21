import { NextResponse }    from 'next/server';
import sharp               from 'sharp';
import JSZip               from 'jszip';
import { connectDB }       from '@/lib/mongodb';
import Attendance          from '@/lib/models/Attendance';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync }      from 'fs';
import path                from 'path';
import os                  from 'os';
import crypto              from 'crypto';
import { isAuthenticated } from '@/lib/withAuth';

export const runtime     = 'nodejs';
export const maxDuration = 60;

function escapeXML(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function makeSVGBuffer(W, H, items) {
  const textNodes = items.map(({ text, x, y, fontSize, anchor = 'middle', bold, italic, color }) => {
    const weight = (bold   === 'true' || bold   === true) ? 'bold'   : 'normal';
    const style  = (italic === 'true' || italic === true) ? 'italic' : 'normal';
    return `<text x="${Math.round(x)}" y="${Math.round(y)}"
      font-size="${Math.round(fontSize)}"
      font-weight="${weight}" font-style="${style}"
      fill="${escapeXML(color)}"
      text-anchor="${anchor}" dominant-baseline="middle"
    >${escapeXML(text)}</text>`;
  }).join('\n');

  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      ${textNodes}
    </svg>`, 'utf8'
  );
}

export async function POST(req) {
  try {
    // ── Auth check ─────────────────────────────────────────────────────────
    const authed = await isAuthenticated();
    if (!authed)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const fd             = await req.formData();
    const sessionId      = fd.get('sessionId');
    const startSerial    = parseInt(fd.get('startSerial') || '1');
    const nameX          = parseFloat(fd.get('nameX'));
    const nameY          = parseFloat(fd.get('nameY'));
    const serialX        = parseFloat(fd.get('serialX'));
    const serialY        = parseFloat(fd.get('serialY'));
    const fontSize       = parseFloat(fd.get('fontSize')       || '52');
    const serialFontSize = parseFloat(fd.get('serialFontSize') || '20');
    const fontColor      = fd.get('fontColor')   || '#1a1a1a';
    const serialColor    = fd.get('serialColor') || '#1a1a1a';
    const nameBold       = fd.get('nameBold');
    const nameItalic     = fd.get('nameItalic');
    const serialBold     = fd.get('serialBold');
    const serialItalic   = fd.get('serialItalic');
    const mode           = fd.get('mode') || 'complete';
    const templateFile   = fd.get('template');

    if (!templateFile || !sessionId)
      return NextResponse.json({ error: 'Template and session are required.' }, { status: 400 });

    await connectDB();

    const all     = await Attendance.find({ sessionId }).lean();
    const records = mode === 'all'
      ? all.filter(r => r.checkIn)
      : all.filter(r => r.checkIn && r.checkOut);

    console.log(`[Certs] all=${all.length} eligible=${records.length}`);

    if (records.length === 0)
      return NextResponse.json(
        { error: `0 eligible students. Total: ${all.length}. Try "Checked In" mode.` },
        { status: 404 }
      );

    const templateBuffer = Buffer.from(await templateFile.arrayBuffer());
    const meta           = await sharp(templateBuffer).metadata();
    const W = meta.width, H = meta.height;

    // ── Prepare temp directories ───────────────────────────────────────────
    const zipToken    = crypto.randomBytes(16).toString('hex');
    const tmpZipDir   = path.join(os.tmpdir(), 'cert-zips');
    const tmpIndivDir = path.join(os.tmpdir(), 'cert-individual');

    if (!existsSync(tmpZipDir))   await mkdir(tmpZipDir,   { recursive: true });
    if (!existsSync(tmpIndivDir)) await mkdir(tmpIndivDir, { recursive: true });

    const zip        = new JSZip();
    const certTokens = [];

    for (let i = 0; i < records.length; i++) {
      const record   = records[i];
      const serialNo = String(startSerial + i).padStart(2, '0');
      const safeName = (record.name || `student_${i}`)
        .replace(/[^a-zA-Z0-9 _-]/g, '')
        .replace(/\s+/g, '_')
        .trim() || `student_${i}`;

      const svgBuffer = makeSVGBuffer(W, H, [
        {
          text:     record.name || 'Unknown',
          x:        nameX, y: nameY,
          fontSize, anchor: 'middle',
          bold:     nameBold, italic: nameItalic, color: fontColor,
        },
        {
          text:     `Sr. No.:${serialNo}`,
          x:        serialX, y: serialY,
          fontSize: serialFontSize, anchor: 'end',
          bold:     serialBold, italic: serialItalic, color: serialColor,
        },
      ]);

      const png = await sharp(templateBuffer)
        .composite([{ input: svgBuffer, top: 0, left: 0 }])
        .png()
        .toBuffer();

      // ── Add to ZIP ────────────────────────────────────────────────────────
      zip.file(`certificate_${serialNo}_${safeName}.png`, png);

      // ── Save individual PNG for email ──────────────────────────────────────
      const individualToken = `${zipToken}_${safeName}`;
      const individualPath  = path.join(tmpIndivDir, `${individualToken}.png`);
      await writeFile(individualPath, png);

      certTokens.push({
        name:   record.name   || '',
        rollNo: record.rollNo || '',
        email:  record.email  || '',
        token:  individualToken,
      });

      console.log(`[Certs] Generated: ${record.name} → ${individualToken}`);
    }

    // ── Build and save ZIP ─────────────────────────────────────────────────
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const zipPath   = path.join(tmpZipDir, `${zipToken}.zip`);
    await writeFile(zipPath, zipBuffer);

    console.log(`[Certs] ZIP: ${zipBuffer.length} bytes | Files: ${Object.keys(zip.files).length} | Individual PNGs: ${certTokens.length}`);

    return NextResponse.json({
      success:   true,
      token:     zipToken,
      count:     records.length,
      zipSize:   zipBuffer.length,
      filename:  `certificates_${sessionId}.zip`,
      certTokens,
    });

  } catch (err) {
    console.error('[Certs] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
