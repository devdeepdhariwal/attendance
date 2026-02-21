import { NextResponse }    from 'next/server';
import { connectDB }       from '@/lib/mongodb';
import Session             from '@/lib/models/Session';
import { isAuthenticated } from '@/lib/withAuth';

export async function GET() {
  const authed = await isAuthenticated();
  if (!authed)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  const sessions = await Session.find({}, { name: 1, active: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ sessions });
}
