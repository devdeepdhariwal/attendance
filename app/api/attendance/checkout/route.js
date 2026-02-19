import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Session from '@/lib/models/Session';
import Attendance from '@/lib/models/Attendance';

export async function POST(req) {
  const { sessionId, token, email, fingerprint } = await req.json();

  if (!sessionId || !token || !email || !fingerprint)
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });

  await connectDB();

  // 1. Validate session & token
  const session = await Session.findById(sessionId);
  if (!session)
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  if (!session.active)
    return NextResponse.json({ error: 'This session has ended.' }, { status: 403 });

  if (session.currentToken !== token || Date.now() > session.tokenExpiresAt)
    return NextResponse.json({ error: 'QR code expired. Please scan the latest code on screen.' }, { status: 403 });

  // 2. Find check-in record
  const record = await Attendance.findOne({ sessionId, email: email.trim().toLowerCase() });
  if (!record || !record.checkIn)
    return NextResponse.json({ error: 'No check-in found for this email. Did you check in?' }, { status: 404 });

  if (record.checkOut)
    return NextResponse.json({ error: 'You have already checked out.' }, { status: 409 });

  // 3. Must be same device that checked in
  if (record.fingerprint !== fingerprint)
    return NextResponse.json({ error: 'Check-out must be done from the same device you used to check in.' }, { status: 403 });

  await Attendance.findByIdAndUpdate(record._id, { checkOut: Date.now() });

  return NextResponse.json({ message: `Check-out successful! See you next time, ${record.name.split(' ')[0]} 🙌` });
}
