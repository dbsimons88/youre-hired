// send-email.js — handles email verification and password reset
//
// Requires two environment variables in Netlify:
//   RESEND_API_KEY   — from resend.com (free tier covers this easily)
//   FROM_EMAIL       — the "from" address, e.g. noreply@yourehiredapp.com
//                      (must be a domain you've verified in Resend)
//
// Uses Netlify Blobs for server-side token storage (no external DB needed).

const { getStore } = require('@netlify/blobs');

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@yourehiredapp.com';

  try {
    const { type, email, code } = JSON.parse(event.body || '{}');
    if (!email) return json(400, { error: 'missing-email' });

    const store = getStore('auth');
    const emailKey = email.trim().toLowerCase();

    // ── SEND VERIFICATION EMAIL ─────────────────────────────────────────
    if (type === 'send-verify') {
      if (!RESEND_KEY) return json(200, { error: 'email-not-configured' });

      // Server-side guard: reject if this email already has a confirmed account
      const confirmed = await store.get(`confirmed:${emailKey}`);
      if (confirmed) return json(200, { error: 'already-exists' });

      const otp = randomCode();
      await store.set(`verify:${emailKey}`, JSON.stringify({ otp, ts: Date.now() }));

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
      const raw = await store.get(`verify:${emailKey}`);
      if (!raw) return json(200, { error: 'no-pending' });

      const { otp, ts } = JSON.parse(raw);
      if (Date.now() - ts > CODE_TTL_MS) return json(200, { error: 'expired' });
      if (otp !== (code || '').trim()) return json(200, { error: 'wrong-code' });

      // Mark email as confirmed (prevents re-registration with same email)
      await store.set(`confirmed:${emailKey}`, '1');
      await store.delete(`verify:${emailKey}`);

      return json(200, { ok: true });
    }

    // ── SEND PASSWORD RESET EMAIL ───────────────────────────────────────
    if (type === 'send-reset') {
      if (!RESEND_KEY) return json(200, { error: 'email-not-configured' });

      const otp = randomCode();
      await store.set(`reset:${emailKey}`, JSON.stringify({ otp, ts: Date.now() }));

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
      const raw = await store.get(`reset:${emailKey}`);
      if (!raw) return json(200, { error: 'no-pending' });

      const { otp, ts } = JSON.parse(raw);
      if (Date.now() - ts > CODE_TTL_MS) return json(200, { error: 'expired' });
      if (otp !== (code || '').trim()) return json(200, { error: 'wrong-code' });

      await store.delete(`reset:${emailKey}`);
      return json(200, { ok: true });
    }

    return json(400, { error: 'unknown-type' });

  } catch (err) {
    console.error('send-email error:', err.message);
    return json(500, { error: 'server-error' });
  }
};

// ── HELPERS ────────────────────────────────────────────────────────────────

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
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
