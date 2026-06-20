// send-email.js — handles email verification and password reset
//
// Uses HMAC-based time-windowed OTPs instead of server-side storage.
// No external npm packages — only Node's built-in crypto module.
//
// How it works:
//   OTP = 6 digits derived from HMAC(ANTHROPIC_API_KEY, email + purpose + timeSlot)
//   timeSlot changes every 15 minutes, so codes expire naturally.
//   Verification checks the current slot and the previous one (grace period).
//
// Requires these environment variables in Netlify:
//   RESEND_API_KEY   — from resend.com
//   FROM_EMAIL       — verified sender address
//   ANTHROPIC_API_KEY — already present; used as HMAC secret

const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@yourehiredapp.com';
  const HMAC_SECRET = process.env.ANTHROPIC_API_KEY;

  try {
    const { type, email, code } = JSON.parse(event.body || '{}');
    if (!email) return json(400, { error: 'missing-email' });

    const emailKey = email.trim().toLowerCase();

    // ── SEND VERIFICATION EMAIL ─────────────────────────────────────────
    if (type === 'send-verify') {
      if (!RESEND_KEY) return json(200, { error: 'email-not-configured' });

      const otp = generateOTP(emailKey, HMAC_SECRET, 'verify');

      await sendViaResend(RESEND_KEY, {
        from: FROM_EMAIL,
        to: email,
        subject: `${otp} — your You're Hired. verification code`,
        html: verifyEmailHtml(otp),
      });

      return json(200, { ok: true });
    }

    // ── CONFIRM VERIFICATION CODE ───────────────────────────────────────
    if (type === 'check-verify') {
      const valid = verifyOTP(emailKey, code, HMAC_SECRET, 'verify');
      if (!valid) return json(200, { error: 'wrong-code' });
      return json(200, { ok: true });
    }

    // ── SEND PASSWORD RESET EMAIL ───────────────────────────────────────
    if (type === 'send-reset') {
      if (!RESEND_KEY) return json(200, { error: 'email-not-configured' });

      const otp = generateOTP(emailKey, HMAC_SECRET, 'reset');

      await sendViaResend(RESEND_KEY, {
        from: FROM_EMAIL,
        to: email,
        subject: `${otp} — your You're Hired. password reset code`,
        html: resetEmailHtml(otp),
      });

      // Always return ok — don't reveal whether the email has an account
      return json(200, { ok: true });
    }

    // ── CONFIRM RESET CODE ──────────────────────────────────────────────
    if (type === 'check-reset') {
      const valid = verifyOTP(emailKey, code, HMAC_SECRET, 'reset');
      if (!valid) return json(200, { error: 'wrong-code' });
      return json(200, { ok: true });
    }

    return json(400, { error: 'unknown-type' });

  } catch (err) {
    console.error('send-email error:', err.message);
    return json(500, { error: 'server-error' });
  }
};

// ── OTP HELPERS ────────────────────────────────────────────────────────────────

// Generate a 6-digit OTP tied to a 15-minute time window
function generateOTP(email, secret, purpose) {
  const timeSlot = Math.floor(Date.now() / (15 * 60 * 1000));
  return computeOTP(email, secret, purpose, timeSlot);
}

// Verify OTP — accepts current window and the previous one (handles edge cases)
function verifyOTP(email, code, secret, purpose) {
  const currentSlot = Math.floor(Date.now() / (15 * 60 * 1000));
  const trimmed = (code || '').trim();
  for (const slot of [currentSlot, currentSlot - 1]) {
    if (computeOTP(email, secret, purpose, slot) === trimmed) return true;
  }
  return false;
}

function computeOTP(email, secret, purpose, timeSlot) {
  const hmac = crypto.createHmac('sha256', secret || 'fallback-secret');
  hmac.update(`${email}:${purpose}:${timeSlot}`);
  const hash = hmac.digest('hex');
  const num = parseInt(hash.slice(0, 8), 16);
  return String(num % 1000000).padStart(6, '0');
}

// ── EMAIL HELPERS ──────────────────────────────────────────────────────────────

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

async function sendViaResend(apiKey, { from, to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend error ${res.status}: ${errText}`);
  }
  return res.json();
}

function verifyEmailHtml(otp) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
      <div style="font-size:24px;font-weight:800;color:#6366f1;margin-bottom:8px;">You're Hired.</div>
      <p style="font-size:16px;color:#1a1d27;margin-bottom:24px;">Here's your verification code:</p>
      <div style="font-size:40px;font-weight:800;letter-spacing:12px;font-family:monospace;color:#6366f1;margin:24px 0;">${otp}</div>
      <p style="font-size:14px;color:#666;margin-bottom:8px;">This code expires in 15 minutes.</p>
      <p style="font-size:12px;color:#999;">If you didn't create a You're Hired. account, you can ignore this email.</p>
    </div>`;
}

function resetEmailHtml(otp) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
      <div style="font-size:24px;font-weight:800;color:#6366f1;margin-bottom:8px;">You're Hired.</div>
      <p style="font-size:16px;color:#1a1d27;margin-bottom:24px;">Here's your password reset code:</p>
      <div style="font-size:40px;font-weight:800;letter-spacing:12px;font-family:monospace;color:#6366f1;margin:24px 0;">${otp}</div>
      <p style="font-size:14px;color:#666;margin-bottom:8px;">This code expires in 15 minutes.</p>
      <p style="font-size:12px;color:#999;">If you didn't request a password reset, you can ignore this email.</p>
    </div>`;
}
