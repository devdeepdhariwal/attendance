import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Session from '@/lib/models/Session';

export async function POST(req) {
  const { sessionId, adminPassword } = await req.json();

  if (adminPassword !== process.env.ADMIN_PASSWORD)
    return NextResponse.json({ error: 'Invalid admin password.' }, { status: 403 });

  await connectDB();
  await Session.findByIdAndUpdate(sessionId, { active: false });

  return NextResponse.json({ message: 'Session ended.' });
}
