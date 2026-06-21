// stripe-webhook.js — receives and verifies Stripe webhook events
// No external packages — uses Node built-in crypto

const crypto = require('crypto');

exports.handler = async (event) => {
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.warn('stripe-webhook: STRIPE_WEBHOOK_SECRET not set — accepting all events (configure in Netlify env vars)');
    return { statusCode: 200, body: 'ok' };
  }

  const sig = event.headers['stripe-signature'];
  if (!sig) {
    return { statusCode: 400, body: 'Missing stripe-signature header' };
  }

  // Verify HMAC-SHA256 signature
  try {
    verifyStripeSignature(event.body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('stripe-webhook: signature verification failed —', err.message);
    return { statusCode: 400, body: `Bad signature: ${err.message}` };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const eventType = payload.type;
  const obj = payload.data?.object || {};

  console.log(`stripe-webhook: ${eventType}`, obj.id || '');

  // Pro status is always verified live via stripe-verify.js — no local DB needed.
  // Log key lifecycle events here for debugging / future use.
  switch (eventType) {
    case 'checkout.session.completed':
      console.log(`New subscription checkout completed for customer ${obj.customer}, email ${obj.customer_email}`);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      console.log(`Subscription ${obj.id} status: ${obj.status}`);
      break;
    case 'customer.subscription.deleted':
      console.log(`Subscription ${obj.id} cancelled/ended`);
      break;
    case 'invoice.payment_failed':
      console.log(`Payment failed for customer ${obj.customer}`);
      break;
    default:
      // Other events — no action needed
      break;
  }

  return { statusCode: 200, body: 'ok' };
};

/**
 * Verifies a Stripe webhook signature.
 * @param {string} rawBody - Raw request body (string, not parsed)
 * @param {string} sigHeader - Value of the stripe-signature header
 * @param {string} secret - Webhook signing secret (whsec_...)
 */
function verifyStripeSignature(rawBody, sigHeader, secret) {
  // Parse the signature header: t=timestamp,v1=sig1,v1=sig2,...
  const parts = {};
  const v1Signatures = [];

  sigHeader.split(',').forEach(part => {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) return;
    const key = part.slice(0, eqIdx);
    const val = part.slice(eqIdx + 1);
    if (key === 't') parts.t = val;
    if (key === 'v1') v1Signatures.push(val);
  });

  if (!parts.t || v1Signatures.length === 0) {
    throw new Error('Malformed stripe-signature header');
  }

  const signedPayload = `${parts.t}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  const matched = v1Signatures.some(sig => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  });

  if (!matched) throw new Error('Signature mismatch');

  // Reject events older than 5 minutes
  const tolerance = 300;
  if (Math.abs(Date.now() / 1000 - parseInt(parts.t, 10)) > tolerance) {
    throw new Error('Timestamp too old — possible replay attack');
  }
}
