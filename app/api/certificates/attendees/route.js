import { NextResponse }    from 'next/server';
import { connectDB }       from '@/lib/mongodb';
import Attendance          from '@/lib/models/Attendance';
import { isAuthenticated } from '@/lib/withAuth';

export async function GET(req) {
  try {
    // ── Auth check ─────────────────────────────────────────────────────────
    const authed = await isAuthenticated();
    if (!authed)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const sessionId        = searchParams.get('sessionId');
    const mode             = searchParams.get('mode') || 'complete';

    if (!sessionId)
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

    await connectDB();

    const all = await Attendance.find({ sessionId }).lean();

    const filtered = mode === 'all'
      ? all.filter(r => r.checkIn)
      : all.filter(r => r.checkIn && r.checkOut);

    return NextResponse.json({
      sessionId,
      mode,
      totalInSession: all.length,
      eligibleCount:  filtered.length,
      allRecords: all.map(r => ({
        name:     r.name,
        rollNo:   r.rollNo,
        checkIn:  r.checkIn  ? '✅' : '❌',
        checkOut: r.checkOut ? '✅' : '❌',
      })),
      eligible: filtered.map(r => ({
        name:   r.name,
        rollNo: r.rollNo,
        email:  r.email || '',
      })),
    });

  } catch (err) {
    console.error('[Attendees]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
