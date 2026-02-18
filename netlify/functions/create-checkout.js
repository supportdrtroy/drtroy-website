/**
 * DrTroy CE Platform — Netlify Function: create-checkout
 * POST /.netlify/functions/create-checkout
 *
 * Creates a Stripe Checkout session for a course purchase.
 * Called from supabase-client.js → DrTroy.stripe.checkout()
 *
 * Request body:
 *   { courseId, userId, userEmail, discountCode?, successUrl, cancelUrl }
 *
 * Response:
 *   { url } — Stripe hosted checkout URL
 *   { error } — on failure
 *
 * Env vars required (set in Netlify dashboard):
 *   STRIPE_SECRET_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const https = require('https');

// ─── helpers ────────────────────────────────────────────────

/**
 * Simple HTTPS POST with form-encoded body (for Stripe API)
 */
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

/**
 * Fetch course details from Supabase (price, title)
 */
function getCourse(courseId, supabaseUrl, serviceRoleKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${supabaseUrl}/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}&select=id,title,price_cents,ceu_hours`);
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
          if (!rows.length) reject(new Error('Course not found'));
          else resolve(rows[0]);
        } catch { reject(new Error('Invalid Supabase response')); }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Validate discount code from Supabase
 */
function validateDiscount(code, supabaseUrl, serviceRoleKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(
      `${supabaseUrl}/rest/v1/discount_codes?code=eq.${encodeURIComponent(code.toUpperCase().trim())}&is_active=eq.true&select=*`
    );
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
          resolve(rows[0] || null);
        } catch { resolve(null); }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
}

// ─── apply discount to price ─────────────────────────────────

function applyDiscount(priceCents, discountRow) {
  if (!discountRow) return priceCents;
  if (discountRow.discount_type === 'free') return 0;
  if (discountRow.discount_type === 'fixed') return Math.max(0, priceCents - discountRow.discount_value);
  if (discountRow.discount_type === 'percentage') return Math.round(priceCents * (1 - discountRow.discount_value / 100));
  return priceCents;
}

// ─── handler ─────────────────────────────────────────────────

exports.handler = async (event) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SERVICE_ROLE) {
    console.error('[create-checkout] Missing environment variables');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error. Contact support.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { courseId, userId, userEmail, discountCode, successUrl, cancelUrl } = body;

  if (!courseId || !userId || !userEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields: courseId, userId, userEmail' }) };
  }

  try {
    // 1. Get course details
    const course = await getCourse(courseId, SUPABASE_URL, SERVICE_ROLE);

    // 2. Apply discount if provided
    let finalPrice = course.price_cents;
    let discountRow = null;
    if (discountCode) {
      discountRow = await validateDiscount(discountCode, SUPABASE_URL, SERVICE_ROLE);
      if (discountRow) {
        finalPrice = applyDiscount(finalPrice, discountRow);
      }
    }

    // 3. Create Stripe Checkout session
    const sessionParams = {
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': course.title,
      'line_items[0][price_data][product_data][description]': `${course.ceu_hours} CEU | DrTroy CE Platform`,
      'line_items[0][price_data][unit_amount]': finalPrice,
      'line_items[0][quantity]': '1',
      mode: 'payment',
      customer_email: userEmail,
      'metadata[course_id]': courseId,
      'metadata[user_id]': userId,
      'metadata[discount_code]': discountCode || '',
      success_url: successUrl,
      cancel_url: cancelUrl,
    };

    // Free courses: skip Stripe, grant access directly (edge case)
    if (finalPrice === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          free: true,
          message: 'Course is free with discount. Enrollment will be granted automatically.',
        }),
      };
    }

    const session = await stripePost('/v1/checkout/sessions', sessionParams, STRIPE_SECRET_KEY);

    if (session.error) {
      console.error('[create-checkout] Stripe error:', session.error);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: session.error.message }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error('[create-checkout] Error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Something went wrong. Please try again.' }),
    };
  }
};
