import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Session from '@/lib/models/Session';
import Attendance from '@/lib/models/Attendance';

export async function POST(req) {
  const { sessionId, submitToken, email, fingerprint } = await req.json();

  if (!sessionId || !submitToken || !email || !fingerprint)
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });

  await connectDB();

  const session = await Session.findById(sessionId);
  if (!session)      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  if (!session.active) return NextResponse.json({ error: 'This session has ended.' }, { status: 403 });

  // Validate submit token (checkout type)
  const tokenEntry = session.submitTokens.find(
    t => t.token === submitToken && t.type === 'checkout' && !t.used && Date.now() < t.expiresAt
  );
  if (!tokenEntry)
    return NextResponse.json({ error: 'Your session expired. Please scan the QR code again.' }, { status: 403 });

  await Session.findOneAndUpdate(
    { _id: sessionId, 'submitTokens.token': submitToken },
    { $set: { 'submitTokens.$.used': true } }
  );

  const record = await Attendance.findOne({ sessionId, email: email.trim().toLowerCase() });
  if (!record || !record.checkIn)
    return NextResponse.json({ error: 'No check-in found for this email. Did you check in?' }, { status: 404 });
  if (record.checkOut)
    return NextResponse.json({ error: 'You have already checked out.' }, { status: 409 });
  if (record.fingerprint !== fingerprint)
    return NextResponse.json({ error: 'Check-out must be done from the same device you checked in with.' }, { status: 403 });

  await Attendance.findByIdAndUpdate(record._id, { checkOut: Date.now() });
  return NextResponse.json({ message: `Check-out successful! See you next time, ${record.name.split(' ')[0]} 🙌` });
}
