import { NextResponse } from 'next/server';
import sharp from 'sharp';
import JSZip from 'jszip';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const fd           = await req.formData();
    const templateFile = fd.get('template');

    if (!templateFile)
      return NextResponse.json({ error: 'No template' }, { status: 400 });

    const templateBuffer = Buffer.from(await templateFile.arrayBuffer());
    const meta = await sharp(templateBuffer).metadata();
    const W = meta.width;
    const H = meta.height;

    console.log('[TestZip] Template loaded:', W, 'x', H, meta.format);

    // Build SVG
    const svgBuffer = Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>
      <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <text x="${W / 2}" y="${H * 0.5}"
          font-size="60" fill="#1a1a1a"
          text-anchor="middle" dominant-baseline="middle"
          font-weight="bold">Test Student Name</text>
        <text x="${W * 0.92}" y="${H * 0.22}"
          font-size="24" fill="#1a1a1a"
          text-anchor="end" dominant-baseline="middle">Sr. No.:01</text>
      </svg>`
    , 'utf8');

    console.log('[TestZip] SVG created, compositing...');

    const png = await sharp(templateBuffer)
      .composite([{ input: svgBuffer, top: 0, left: 0 }])
      .png()
      .toBuffer();

    console.log('[TestZip] PNG created, size:', png.length, 'bytes');

    // Build ZIP
    const zip = new JSZip();
    zip.file('test_certificate_01.png', png);

    const fileCount = Object.keys(zip.files).length;
    console.log('[TestZip] Files in ZIP before generate:', fileCount);

    const zipBuffer = await zip.generateAsync({
      type:        'nodebuffer',
      compression: 'DEFLATE',
    });

    console.log('[TestZip] ZIP buffer size:', zipBuffer.length, 'bytes');

    return new Response(zipBuffer, {
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': 'attachment; filename="test_certificate.zip"',
        'X-File-Count':        String(fileCount),
        'X-ZIP-Size':          String(zipBuffer.length),
        'X-PNG-Size':          String(png.length),
      },
    });

  } catch (err) {
    console.error('[TestZip] ERROR:', err);
    return NextResponse.json({
      error: err.message,
      stack: err.stack,
    }, { status: 500 });
  }
}
