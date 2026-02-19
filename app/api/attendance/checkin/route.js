import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Session from '@/lib/models/Session';
import Attendance from '@/lib/models/Attendance';

export async function POST(req) {
  const { sessionId, submitToken, name, email, rollNo, department, fingerprint } = await req.json();

  if (!sessionId || !submitToken || !name || !email || !rollNo || !department || !fingerprint)
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });

  await connectDB();

  const session = await Session.findById(sessionId);
  if (!session)
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  if (!session.active)
    return NextResponse.json({ error: 'This session has ended.' }, { status: 403 });

  // Validate submit token — checkin type, one-time use, within 2 min window
  const tokenEntry = session.submitTokens.find(
    t => t.token === submitToken && t.type === 'checkin' && !t.used && Date.now() < t.expiresAt
  );
  if (!tokenEntry)
    return NextResponse.json({ error: 'Your session expired. Please scan the QR code again.' }, { status: 403 });

  // Mark token used immediately
  await Session.findOneAndUpdate(
    { _id: sessionId, 'submitTokens.token': submitToken },
    { $set: { 'submitTokens.$.used': true } }
  );

  // Block same device for multiple emails
  const sameDevice = await Attendance.findOne({ sessionId, fingerprint });
  if (sameDevice)
    return NextResponse.json({ error: 'This device has already been used to check in.' }, { status: 409 });

  try {
    await Attendance.create({
      sessionId,
      name:       name.trim(),
      email:      email.trim().toLowerCase(),
      rollNo:     rollNo.trim().toUpperCase(),
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
