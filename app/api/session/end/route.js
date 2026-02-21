import { NextResponse }    from 'next/server';
import { connectDB }       from '@/lib/mongodb';
import Session             from '@/lib/models/Session';
import { isAuthenticated } from '@/lib/withAuth';

export async function POST(req) {
  const authed = await isAuthenticated();
  if (!authed)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await req.json();

  await connectDB();
  await Session.findByIdAndUpdate(sessionId, { active: false });

  return NextResponse.json({ message: 'Session ended.' });
}
