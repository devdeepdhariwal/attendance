import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Attendance from '@/lib/models/Attendance';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const sessionId     = searchParams.get('sessionId');
  const adminPassword = searchParams.get('adminPassword');

  if (adminPassword !== process.env.ADMIN_PASSWORD)
    return NextResponse.json({ error: 'Invalid admin password.' }, { status: 403 });

  await connectDB();

  const records    = await Attendance.find({ sessionId }).lean();
  const complete   = records.filter(r => r.checkIn && r.checkOut);
  const incomplete = records.filter(r => r.checkIn && !r.checkOut);

  return NextResponse.json({
    complete,
    incomplete,
    total:     complete.length,
    checkedIn: records.length,
  });
}
