import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import Session from '@/lib/models/Session';

const TOKEN_TTL = 17000;

// POST — open or close a window
// Body: { sessionId, type: 'checkin'|'checkout', action: 'open'|'close', adminPassword }
export async function POST(req) {
  const { sessionId, type, action, adminPassword } = await req.json();

  if (adminPassword !== process.env.ADMIN_PASSWORD)
    return NextResponse.json({ error: 'Invalid admin password.' }, { status: 403 });

  if (!['checkin', 'checkout'].includes(type))
    return NextResponse.json({ error: 'Invalid type.' }, { status: 400 });

  await connectDB();

  const session = await Session.findById(sessionId);
  if (!session)
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  if (!session.active)
    return NextResponse.json({ error: 'This session has ended.' }, { status: 403 });

  if (action === 'open') {
    const newToken = crypto.randomUUID();
    const update   = type === 'checkin'
      ? { checkinActive: true,  checkinToken: newToken,  checkinTokenExpiresAt:  Date.now() + TOKEN_TTL }
      : { checkoutActive: true, checkoutToken: newToken, checkoutTokenExpiresAt: Date.now() + TOKEN_TTL };
    await Session.findByIdAndUpdate(sessionId, update);
    return NextResponse.json({ message: `${type} window opened.` });
  }

  if (action === 'close') {
    const update = type === 'checkin'
      ? { checkinActive: false,  checkinToken: null }
      : { checkoutActive: false, checkoutToken: null };
    await Session.findByIdAndUpdate(sessionId, update);
    return NextResponse.json({ message: `${type} window closed.` });
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
}
