import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import Session from '@/lib/models/Session';

export async function POST(req) {
  const { name, adminPassword } = await req.json();

  if (adminPassword !== process.env.ADMIN_PASSWORD)
    return NextResponse.json({ error: 'Invalid admin password.' }, { status: 403 });

  await connectDB();

  const session = await Session.create({
    name:           name || 'Club Session',
    active:         true,
    checkinActive:  false,
    checkoutActive: false,
  });

  return NextResponse.json({ sessionId: session._id.toString() });
}
