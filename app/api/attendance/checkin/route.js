import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Session from '@/lib/models/Session';
import Attendance from '@/lib/models/Attendance';

export async function POST(req) {
  const { sessionId, token, name, email, department, fingerprint } = await req.json();

  if (!sessionId || !token || !name || !email || !department || !fingerprint)
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });

  await connectDB();

  // 1. Validate session
  const session = await Session.findById(sessionId);
  if (!session)
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  if (!session.active)
    return NextResponse.json({ error: 'This session has ended.' }, { status: 403 });

  // 2. Validate rotating token
  if (session.currentToken !== token || Date.now() > session.tokenExpiresAt)
    return NextResponse.json({ error: 'QR code expired. Please scan the latest code on screen.' }, { status: 403 });

  // 3. Block same device for multiple emails
  const sameDevice = await Attendance.findOne({ sessionId, fingerprint });
  if (sameDevice)
    return NextResponse.json({ error: 'This device has already been used to check in for this session.' }, { status: 409 });

  // 4. Create record
  try {
    await Attendance.create({
      sessionId,
      name:       name.trim(),
      email:      email.trim().toLowerCase(),
      department: department.trim(),
      fingerprint,
      checkIn:    Date.now(),
    });

    return NextResponse.json({ message: `Check-in successful! Welcome, ${name.trim().split(' ')[0]} 👋` });

  } catch (err) {
    if (err.code === 11000)
      return NextResponse.json({ error: 'You have already checked in for this session.' }, { status: 409 });
    throw err;
  }
}
