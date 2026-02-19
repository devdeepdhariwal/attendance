import { NextResponse } from 'next/server';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { connectDB } from '@/lib/mongodb';
import Session from '@/lib/models/Session';

const TOKEN_TTL = 17000;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const sessionId     = searchParams.get('sessionId');
  const type          = searchParams.get('type') || 'checkin';
  const adminPassword = searchParams.get('adminPassword');

  if (adminPassword !== process.env.ADMIN_PASSWORD)
    return NextResponse.json({ error: 'Invalid admin password.' }, { status: 403 });

  await connectDB();

  // Rotate token on every QR fetch (called every 15s from admin page)
  const newToken = crypto.randomUUID();
  const session  = await Session.findByIdAndUpdate(
    sessionId,
    { currentToken: newToken, tokenExpiresAt: Date.now() + TOKEN_TTL },
    { new: true }
  );

  if (!session)
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const url  = `${base}/attend?sessionId=${sessionId}&token=${newToken}&type=${type}`;
  const qr   = await QRCode.toDataURL(url, { width: 280, margin: 2 });

  return NextResponse.json({ qr, token: newToken });
}
