import { NextResponse }    from 'next/server';
import { connectDB }       from '@/lib/mongodb';
import Session             from '@/lib/models/Session';
import { isAuthenticated } from '@/lib/withAuth';

export async function POST(req) {
  const authed = await isAuthenticated();
  if (!authed)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();

  await connectDB();

  const session = await Session.create({
    name:           name || 'Club Session',
    active:         true,
    checkinActive:  false,
    checkoutActive: false,
  });

  return NextResponse.json({ sessionId: session._id.toString() });
}
