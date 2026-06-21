// stripe-verify.js — checks whether an email address has an active Stripe subscription
// No external packages — uses Node built-in fetch

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

  if (!STRIPE_SECRET_KEY) {
    // Payments not configured — default everyone to free
    return json(200, { isPro: false });
  }

  let email;
  try {
    ({ email } = JSON.parse(event.body || '{}'));
  } catch {
    return json(400, { error: 'invalid-json' });
  }

  if (!email) return json(400, { error: 'missing-email' });

  try {
    // 1. Look up customer by email
    const cusRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
    );
    const cusData = await cusRes.json();

    if (!cusRes.ok) {
      console.error('stripe-verify customer lookup error:', cusData);
      return json(500, { error: 'stripe-error' });
    }

    if (!cusData.data || cusData.data.length === 0) {
      return json(200, { isPro: false });
    }

    const customerId = cusData.data[0].id;

    // 2. Check for active subscription
    const subRes = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active&limit=1`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
    );
    const subData = await subRes.json();

    if (!subRes.ok) {
      console.error('stripe-verify subscription lookup error:', subData);
      return json(500, { error: 'stripe-error' });
    }

    const isPro = Array.isArray(subData.data) && subData.data.length > 0;
    return json(200, { isPro });
  } catch (err) {
    console.error('stripe-verify fetch error:', err.message);
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
