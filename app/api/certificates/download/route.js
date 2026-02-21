import { NextResponse } from 'next/server';
import { readFile, unlink } from 'fs/promises';
import { existsSync }       from 'fs';
import path from 'path';
import os   from 'os';

export const runtime = 'nodejs';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token    = searchParams.get('token');
    const filename = searchParams.get('filename') || 'certificates.zip';

    if (!token || !/^[a-f0-9]{32}$/.test(token))
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

    const zipPath = path.join(os.tmpdir(), 'cert-zips', `${token}.zip`);

    if (!existsSync(zipPath))
      return NextResponse.json({ error: 'File not found or expired' }, { status: 404 });

    const zipBuffer = await readFile(zipPath);

    // Delete after reading (one-time download)
    await unlink(zipPath).catch(() => {});

    console.log(`[Download] Serving ${zipBuffer.length} bytes for token ${token}`);

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/zip',
        'Content-Length':      String(zipBuffer.length),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    });

  } catch (err) {
    console.error('[Download] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
