import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import Session from '@/lib/models/Session';

const SUBMIT_TOKEN_TTL = 2 * 60 * 1000;

export async function POST(req) {
  const { sessionId, token, type } = await req.json();

  if (!sessionId || !token || !type)
    return NextResponse.json({ error: 'Invalid QR code.' }, { status: 400 });

  await connectDB();

  const session = await Session.findById(sessionId);
  if (!session)
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  if (!session.active)
    return NextResponse.json({ error: 'This session has ended.' }, { status: 403 });

  // Check type-specific window is open
  if (type === 'checkin' && !session.checkinActive)
    return NextResponse.json({ error: 'Check-in is not open right now.' }, { status: 403 });
  if (type === 'checkout' && !session.checkoutActive)
    return NextResponse.json({ error: 'Check-out is not open right now.' }, { status: 403 });

  // Validate the rotating scan token
  const currentToken   = type === 'checkin' ? session.checkinToken   : session.checkoutToken;
  const tokenExpiresAt = type === 'checkin' ? session.checkinTokenExpiresAt : session.checkoutTokenExpiresAt;

  if (currentToken !== token || Date.now() > tokenExpiresAt)
    return NextResponse.json({ error: 'QR code expired. Please scan the latest code on screen.' }, { status: 403 });

  // Issue submit token
  const submitToken = crypto.randomUUID();
  await Session.findByIdAndUpdate(sessionId, {
    $push: {
      submitTokens: {
        token:     submitToken,
        type,
        expiresAt: Date.now() + SUBMIT_TOKEN_TTL,
        used:      false,
      }
    }
  });

  return NextResponse.json({ submitToken, expiresIn: 120 });
}
