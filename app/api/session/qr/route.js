import { NextResponse }    from 'next/server';
import crypto              from 'crypto';
import QRCode              from 'qrcode';
import { connectDB }       from '@/lib/mongodb';
import Session             from '@/lib/models/Session';
import { isAuthenticated } from '@/lib/withAuth';

const TOKEN_TTL = 17000;

export async function GET(req) {
  const authed = await isAuthenticated();
  if (!authed)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const type      = searchParams.get('type');

  await connectDB();

  const newToken = crypto.randomUUID();
  const update   = type === 'checkin'
    ? { checkinToken: newToken,  checkinTokenExpiresAt:  Date.now() + TOKEN_TTL }
    : { checkoutToken: newToken, checkoutTokenExpiresAt: Date.now() + TOKEN_TTL };

  const session = await Session.findByIdAndUpdate(sessionId, update, { new: true });
  if (!session)
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const url  = `${base}/attend?sessionId=${sessionId}&token=${newToken}&type=${type}`;
  const qr   = await QRCode.toDataURL(url, { width: 280, margin: 2 });

  return NextResponse.json({ qr });
}
