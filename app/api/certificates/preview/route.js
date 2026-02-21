import { NextResponse }    from 'next/server';
import { readFile }        from 'fs/promises';
import { existsSync }      from 'fs';
import path                from 'path';
import os                  from 'os';
import { isAuthenticated } from '@/lib/withAuth';

export const runtime = 'nodejs';

export async function GET(req) {
  try {
    // ── Auth check ─────────────────────────────────────────────────────────
    const authed = await isAuthenticated();
    if (!authed)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const token            = searchParams.get('token');
    const download         = searchParams.get('download') === '1';

    if (!token || !/^[a-f0-9]{32}_[a-zA-Z0-9_-]+$/.test(token))
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

    const filePath = path.join(os.tmpdir(), 'cert-individual', `${token}.png`);

    if (!existsSync(filePath))
      return NextResponse.json(
        { error: 'Certificate not found. Please regenerate certificates first.' },
        { status: 404 }
      );

    const buffer = await readFile(filePath);

    return new Response(buffer, {
      headers: {
        'Content-Type':  'image/png',
        'Cache-Control': 'no-store',
        ...(download && {
          'Content-Disposition': `attachment; filename="${token.split('_').slice(1).join('_')}_certificate.png"`,
        }),
      },
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
