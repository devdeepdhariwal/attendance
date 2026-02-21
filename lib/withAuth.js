import { cookies } from 'next/headers';
import crypto      from 'crypto';

function sign(value) {
  return crypto
    .createHmac('sha256', process.env.AUTH_SECRET)
    .update(value)
    .digest('hex');
}

function verifyToken(token) {
  if (!token) return false;
  try {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return false;
    const payload     = Buffer.from(encodedPayload, 'base64').toString('utf8');
    const expectedSig = sign(payload);
    const sigBuf      = Buffer.from(signature,    'hex');
    const expBuf      = Buffer.from(expectedSig,  'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch { return false; }
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  const token       = cookieStore.get('auth_token')?.value;
  return verifyToken(token);
}
