// lib/mailer.js
import nodemailer from 'nodemailer';

// ONE transporter created once at module level — reused for all emails
// pool:true keeps the TCP/TLS connection open between sends [web:132]
let _transporter = null;

export function getTransporter() {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host:    'smtp.gmail.com',
    port:    465,
    secure:  true,          // TLS from the start — fastest for Gmail
    pool:    true,          // ← key: reuse connection, no re-handshake per email
    maxConnections: 3,      // Gmail allows up to 15 concurrent SMTP connections
    maxMessages:    100,    // messages per connection before cycling
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,   // Gmail App Password
    },
    tls: {
      rejectUnauthorized: true,
    },
  });

  return _transporter;
}
