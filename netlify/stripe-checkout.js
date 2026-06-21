// stripe-checkout.js — creates a Stripe Checkout session and returns the redirect URL
// No external packages — uses Node built-in fetch

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
  const APP_URL = process.env.APP_URL || 'https://smashtheinterview.com';

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
    console.error('stripe-checkout: missing env vars STRIPE_SECRET_KEY or STRIPE_PRICE_ID');
    return json(500, { error: 'payment-not-configured' });
  }

  let email;
  try {
    ({ email } = JSON.parse(event.body || '{}'));
  } catch {
    return json(400, { error: 'invalid-json' });
  }

  // Build form-encoded body for Stripe API
  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': STRIPE_PRICE_ID,
    'line_items[0][quantity]': '1',
    success_url: `${APP_URL}/app.html?upgrade=success`,
    cancel_url: `${APP_URL}/app.html`,
    'subscription_data[metadata][app]': 'smash-the-interview',
  });

  if (email) {
    params.append('customer_email', email);
    params.append('metadata[email]', email);
  }

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Stripe API error:', data);
      return json(500, { error: data.error?.message || 'stripe-error' });
    }

    return json(200, { url: data.url });
  } catch (err) {
    console.error('stripe-checkout fetch error:', err.message);
    return json(500, { error: 'network-error' });
  }
};

function json(code, body) {
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
