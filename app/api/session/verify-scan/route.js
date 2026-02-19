import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import Session from '@/lib/models/Session';

const SUBMIT_TOKEN_TTL = 2 * 60 * 1000; // 2 minutes

export async function POST(req) {
  const { sessionId, token } = await req.json();

  if (!sessionId || !token)
    return NextResponse.json({ error: 'Invalid QR code.' }, { status: 400 });

  await connectDB();

  const session = await Session.findById(sessionId);
  if (!session)
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  if (!session.active)
    return NextResponse.json({ error: 'This session has ended.' }, { status: 403 });

  // Validate the scan token (15s window)
  if (session.currentToken !== token || Date.now() > session.tokenExpiresAt)
    return NextResponse.json({ error: 'QR code expired. Please scan the latest code on screen.' }, { status: 403 });

  // Issue a submit token valid for 2 minutes
  const submitToken = crypto.randomUUID();
  await Session.findByIdAndUpdate(sessionId, {
    $push: {
      submitTokens: {
        token:     submitToken,
        expiresAt: Date.now() + SUBMIT_TOKEN_TTL,
        used:      false,
      }
    }
  });

  return NextResponse.json({ submitToken, expiresIn: 120 });
}
