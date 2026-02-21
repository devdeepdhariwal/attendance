import { NextResponse }    from 'next/server';
import { getTransporter }  from '@/lib/mailer';
import { connectDB }       from '@/lib/mongodb';
import Attendance          from '@/lib/models/Attendance';
import { readFile }        from 'fs/promises';
import { existsSync }      from 'fs';
import path                from 'path';
import os                  from 'os';
import { isAuthenticated } from '@/lib/withAuth';

export const runtime     = 'nodejs';
export const maxDuration = 120;

function buildEmailHTML(name) {
  return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🏆 CyberPhoenix Club</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 13px;">
          Dept. of CSE, GJUS&T Hisar
        </p>
      </div>
      <div style="background: #fff; padding: 32px; border: 1px solid #e8e8e8; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 16px; color: #333; margin: 0 0 16px;">Dear <strong>${name}</strong>,</p>
        <p style="font-size: 14px; color: #555; line-height: 1.7; margin: 0 0 20px;">
          Congratulations! Please find attached your
          <strong>Certificate of Participation</strong>
          from CyberPhoenix Club, GJUS&T Hisar.
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
  `;
}

export async function POST(req) {
  try {
    // ── Auth check ─────────────────────────────────────────────────────────
    const authed = await isAuthenticated();
    if (!authed)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId, students } = await req.json();
    // students: [{ name, rollNo, email, token }]

    await connectDB();
    const transporter = getTransporter(); // pooled — TLS connection reused for all

    // ── Send all in parallel ───────────────────────────────────────────────
    const settled = await Promise.allSettled(
      students.map(async ({ name, rollNo, email, token }) => {

        // Resolve email from DB if not provided
        let recipientEmail = email;
        if (!recipientEmail) {
          const record   = await Attendance.findOne({ sessionId, rollNo }).lean();
          recipientEmail = record?.email;
        }
        if (!recipientEmail) throw new Error(`No email found for ${name}`);

        // Validate token
        if (!token || !/^[a-f0-9]{32}_[a-zA-Z0-9_-]+$/.test(token))
          throw new Error(`Invalid token for ${name}`);

        const certPath = path.join(os.tmpdir(), 'cert-individual', `${token}.png`);
        if (!existsSync(certPath))
          throw new Error(`Certificate not found for ${name} — regenerate first`);

        const certBuffer = await readFile(certPath);

        // Send — pooled transporter reuses the open TLS connection
        await transporter.sendMail({
          from:    process.env.EMAIL_FROM,
          to:      recipientEmail,
          subject: `Your Certificate of Participation — CyberPhoenix Club`,
          html:    buildEmailHTML(name),
          attachments: [{
            filename:    `certificate_${name.replace(/\s+/g, '_')}.png`,
            content:     certBuffer,
            contentType: 'image/png',
          }],
        });

        // Mark sent in DB
        await Attendance.updateOne(
          { sessionId, rollNo },
          { $set: { certSent: true, certSentAt: new Date() } }
        );

        console.log(`[Email] ✅ ${recipientEmail} (${name})`);
        return { name, rollNo };
      })
    );

    // ── Build results from settled promises ────────────────────────────────
    const results = settled.map((r, i) => {
      if (r.status === 'rejected')
        console.error(`[Email] ❌ Failed for ${students[i].name}:`, r.reason?.message);
      return {
        name:    students[i].name,
        rollNo:  students[i].rollNo,
        success: r.status === 'fulfilled',
        error:   r.status === 'rejected' ? r.reason?.message : null,
      };
    });

    const successCount = results.filter(r =>  r.success).length;
    const failCount    = results.filter(r => !r.success).length;

    return NextResponse.json({ success: true, successCount, failCount, results });

  } catch (err) {
    console.error('[SendAll] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
