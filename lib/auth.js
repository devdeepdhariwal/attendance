import crypto from 'crypto';

function sign(value) {
  return crypto
    .createHmac('sha256', process.env.AUTH_SECRET)
    .update(value)
    .digest('hex');
}

export function verifyToken(token) {
  if (!token) return false;
  try {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature)  return false;

    const payload       = Buffer.from(encodedPayload, 'base64').toString('utf8');
    const expectedSig   = sign(payload);

    // Constant-time comparison to prevent timing attacks
    const sigBuffer     = Buffer.from(signature,    'hex');
    const expectedBuf   = Buffer.from(expectedSig,  'hex');
    if (sigBuffer.length !== expectedBuf.length) return false;

    return crypto.timingSafeEqual(sigBuffer, expectedBuf);
  } catch {
    return false;
  }
}
