import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Session from '@/lib/models/Session';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const adminPassword = searchParams.get('adminPassword');

  if (adminPassword !== process.env.ADMIN_PASSWORD)
    return NextResponse.json({ error: 'Invalid admin password.' }, { status: 403 });

  await connectDB();

  const sessions = await Session.find({}, { name: 1, active: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ sessions });
}
