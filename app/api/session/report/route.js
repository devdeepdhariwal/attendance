import { NextResponse }    from 'next/server';
import { connectDB }       from '@/lib/mongodb';
import Attendance          from '@/lib/models/Attendance';
import { isAuthenticated } from '@/lib/withAuth';

export async function GET(req) {
  const authed = await isAuthenticated();
  if (!authed)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

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
