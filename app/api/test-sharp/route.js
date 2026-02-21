import { NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Create a simple 200x100 red rectangle PNG entirely in memory
    const png = await sharp({
      create: {
        width:      400,
        height:     200,
        channels:   4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
    .composite([{
      input: Buffer.from(
        `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
          <text x="200" y="100" font-size="40" fill="red"
            text-anchor="middle" dominant-baseline="middle">
            Sharp Works!
          </text>
        </svg>`
      ),
      top: 0, left: 0,
    }])
    .png()
    .toBuffer();

    return new Response(png, {
      headers: {
        'Content-Type':   'image/png',
        'X-Sharp-Version': sharp.versions?.sharp || 'unknown',
      },
    });
  } catch (err) {
    return NextResponse.json({
      error:   err.message,
      code:    err.code,
      version: sharp.versions,
    }, { status: 500 });
  }
}
