import { NextResponse }    from 'next/server';
import { getTransporter }  from '@/lib/mailer';
import { connectDB }       from '@/lib/mongodb';
import Attendance          from '@/lib/models/Attendance';
import { readFile }        from 'fs/promises';
import { existsSync }      from 'fs';
import path                from 'path';
import os                  from 'os';
import { isAuthenticated } from '@/lib/withAuth';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    // ── Auth check ─────────────────────────────────────────────────────────
    const authed = await isAuthenticated();
    if (!authed)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId, rollNo, name, email, token } = await req.json();

    if (!token)
      return NextResponse.json({ error: 'Certificate token required' }, { status: 400 });

    // Validate token format
    if (!/^[a-f0-9]{32}_[a-zA-Z0-9_-]+$/.test(token))
      return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });

    // ── Resolve email ──────────────────────────────────────────────────────
    let recipientEmail = email;
    if (!recipientEmail) {
      await connectDB();
      const record = await Attendance.findOne({ sessionId, rollNo }).lean();
      if (!record?.email)
        return NextResponse.json({ error: 'No email found for this student' }, { status: 404 });
      recipientEmail = record.email;
    }

    // ── Get certificate file ───────────────────────────────────────────────
    const certPath = path.join(os.tmpdir(), 'cert-individual', `${token}.png`);

    if (!existsSync(certPath))
      return NextResponse.json(
        { error: 'Certificate file not found. Please regenerate certificates first.' },
        { status: 404 }
      );

    const certBuffer = await readFile(certPath);

    // ── Send email ─────────────────────────────────────────────────────────
    const transporter = getTransporter();

    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      recipientEmail,
      subject: `Your Certificate of Participation — CyberPhoenix Club`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: 1px;">
              🏆 CyberPhoenix Club
            </h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 13px;">
              Department of Computer Science & Engineering, GJUS&T Hisar
            </p>
          </div>

          <div style="background: #ffffff; padding: 32px; border: 1px solid #e8e8e8; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; color: #333; margin: 0 0 16px;">Dear <strong>${name}</strong>,</p>

            <p style="font-size: 14px; color: #555; line-height: 1.7; margin: 0 0 20px;">
              Congratulations! Please find attached your <strong>Certificate of Participation</strong>
              for your active participation in the event organized by
              <strong>CyberPhoenix Club</strong>, Department of Computer Science and Engineering,
              Guru Jambheshwar University of Science & Technology, Hisar.
            </p>

            <div style="background: #f8f9ff; border-left: 4px solid #667eea; padding: 16px; border-radius: 0 8px 8px 0; margin: 0 0 24px;">
              <p style="margin: 0; font-size: 13px; color: #667eea; font-weight: bold;">
                Your certificate is attached to this email as a PNG image.
              </p>
            </div>

            <p style="font-size: 13px; color: #888; margin: 0 0 8px;">
              We hope you enjoyed the event and look forward to seeing you in future sessions.
            </p>

            <p style="font-size: 13px; color: #888; margin: 0;">
              Warm regards,<br />
              <strong style="color: #333;">CyberPhoenix Club</strong><br />
              Dept. of CSE, GJUS&T Hisar
            </p>
          </div>

          <p style="text-align: center; font-size: 11px; color: #bbb; margin: 16px 0 0;">
            This is an automated email. Please do not reply.
          </p>
        </div>
      `,
      attachments: [
        {
          filename:    `certificate_${name.replace(/\s+/g, '_')}.png`,
          content:     certBuffer,
          contentType: 'image/png',
        },
      ],
    });

    console.log(`[Email] ✅ Sent to ${recipientEmail} for ${name}`);

    // ── Mark as sent in DB ─────────────────────────────────────────────────
    await connectDB();
    await Attendance.updateOne(
      { sessionId, rollNo },
      { $set: { certSent: true, certSentAt: new Date() } }
    );

    return NextResponse.json({ success: true, sentTo: recipientEmail });

  } catch (err) {
    console.error('[Email] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
