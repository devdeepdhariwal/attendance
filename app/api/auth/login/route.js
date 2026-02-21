import { NextResponse } from 'next/server';
import { cookies }      from 'next/headers';
import crypto           from 'crypto';

function sign(value) {
  return crypto
    .createHmac('sha256', process.env.AUTH_SECRET)
    .update(value)
    .digest('hex');
}

export async function POST(req) {
  try {
    const { username, password } = await req.json();

    if (
      username !== process.env.ADMIN_USERNAME ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      await new Promise(r => setTimeout(r, 800));
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const payload   = `${username}:${Date.now()}`;
    const signature = sign(payload);
    const token     = `${Buffer.from(payload).toString('base64')}.${signature}`;

    // Next.js 15 — cookies() must be awaited
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/',
      maxAge:   60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[Login]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
