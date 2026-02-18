/**
 * DrTroy CE Platform — Netlify Function: create-checkout
 * POST /.netlify/functions/create-checkout
 *
 * Creates a Stripe Checkout Session for a course OR package purchase.
 *
 * Request body:
 *   { itemId, itemType, userId, userEmail, discountCode?, successUrl, cancelUrl }
 *   itemType: 'course' | 'package'
 *
 * Response:
 *   { url } — Stripe hosted checkout URL
 *   { error } — on failure
 */

const https = require('https');

// ─── helpers ────────────────────────────────────────────────

function stripePost(path, params, secretKey) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const options = {
      hostname: 'api.stripe.com',
      path,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid Stripe response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function supabaseGet(path, supabaseUrl, serviceRoleKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${supabaseUrl}${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const rows = JSON.parse(data);
          if (!rows.length) reject(new Error('Item not found'));
          else resolve(rows[0]);
        } catch { reject(new Error('Invalid Supabase response')); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function applyDiscount(priceCents, discountRow) {
  if (!discountRow) return priceCents;
  if (discountRow.discount_type === 'free') return 0;
  if (discountRow.discount_type === 'fixed') return Math.max(0, priceCents - discountRow.discount_value);
  if (discountRow.discount_type === 'percentage') return Math.round(priceCents * (1 - discountRow.discount_value / 100));
  return priceCents;
}

async function validateDiscount(code, supabaseUrl, serviceRoleKey) {
  return new Promise((resolve) => {
    const path = `/rest/v1/discount_codes?code=eq.${encodeURIComponent(code.toUpperCase().trim())}&is_active=eq.true&select=*`;
    const url = new URL(`${supabaseUrl}${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)[0] || null); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

// ─── handler ─────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const SUPABASE_URL      = process.env.SUPABASE_URL;
  const SERVICE_ROLE      = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SERVICE_ROLE) {
    console.error('[create-checkout] Missing environment variables');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error. Contact support.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) }; }

  const { itemId, itemType = 'course', userId, userEmail, discountCode, successUrl, cancelUrl } = body;

  // Support legacy courseId field
  const resolvedItemId = itemId || body.courseId;

  if (!resolvedItemId || !userId || !userEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields: itemId, userId, userEmail' }) };
  }

  try {
    // 1. Look up item (course or package)
    let item, itemLabel, ceuInfo;

    if (itemType === 'package') {
      item = await supabaseGet(
        `/rest/v1/packages?id=eq.${encodeURIComponent(resolvedItemId)}&select=id,title,price_cents,total_ceu_hours`,
        SUPABASE_URL, SERVICE_ROLE
      );
      ceuInfo = `${item.total_ceu_hours} CEU Hours`;
      itemLabel = item.title;
    } else {
      item = await supabaseGet(
        `/rest/v1/courses?id=eq.${encodeURIComponent(resolvedItemId)}&select=id,title,price_cents,ceu_hours`,
        SUPABASE_URL, SERVICE_ROLE
      );
      ceuInfo = `${item.ceu_hours} CEU Hours`;
      itemLabel = item.title;
    }

    // 2. Apply discount if provided
    let finalPrice = item.price_cents;
    let discountRow = null;
    if (discountCode && discountCode.trim()) {
      discountRow = await validateDiscount(discountCode, SUPABASE_URL, SERVICE_ROLE);
      if (discountRow) finalPrice = applyDiscount(finalPrice, discountRow);
    }

    // 3. Build Stripe Checkout session
    const sessionParams = {
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': itemLabel,
      'line_items[0][price_data][product_data][description]': `${ceuInfo} | DrTroy.com CE Platform`,
      'line_items[0][price_data][unit_amount]': String(finalPrice),
      'line_items[0][quantity]': '1',
      mode: 'payment',
      customer_email: userEmail,
      'metadata[item_id]':      resolvedItemId,
      'metadata[item_type]':    itemType,
      'metadata[user_id]':      userId,
      'metadata[discount_code]': discountCode || '',
      success_url: successUrl,
      cancel_url:  cancelUrl,
    };

    // Free items: skip Stripe
    if (finalPrice === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ free: true, message: 'Item is free with discount.' }),
      };
    }

    const session = await stripePost('/v1/checkout/sessions', sessionParams, STRIPE_SECRET_KEY);

    if (session.error) {
      console.error('[create-checkout] Stripe error:', session.error);
      return { statusCode: 400, body: JSON.stringify({ error: session.error.message }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error('[create-checkout] Error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong. Please try again.' }) };
  }
};
