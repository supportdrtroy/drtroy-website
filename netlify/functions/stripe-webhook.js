/**
 * DrTroy CE Platform — Netlify Function: stripe-webhook
 * POST /.netlify/functions/stripe-webhook
 *
 * Handles Stripe webhook events.
 * Listens for checkout.session.completed → creates enrollment in Supabase.
 *
 * Stripe Dashboard webhook config:
 *   URL: https://drtroy.com/.netlify/functions/stripe-webhook
 *   Events: checkout.session.completed
 *
 * Env vars required (set in Netlify dashboard):
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET      (whsec_... from Stripe webhook settings)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const https = require('https');
const crypto = require('crypto');

// ─── Stripe signature verification ───────────────────────────

function verifyStripeSignature(payload, signature, secret) {
  // Stripe sends: t=timestamp,v1=hash
  const parts = {};
  signature.split(',').forEach((part) => {
    const [key, val] = part.split('=');
    parts[key] = val;
  });

  const timestamp = parts['t'];
  const expectedSig = parts['v1'];

  if (!timestamp || !expectedSig) return false;

  // Reject webhooks older than 5 minutes
  const tolerance = 5 * 60; // seconds
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > tolerance) {
    console.warn('[stripe-webhook] Timestamp too old:', timestamp);
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(expectedSig, 'hex'));
}

// ─── Supabase helpers ─────────────────────────────────────────

function supabaseRequest(method, path, body, supabaseUrl, serviceRoleKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${supabaseUrl}${path}`);
    const bodyStr = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Get course by ID (for price_cents and validation)
 */
function getCourse(courseId, supabaseUrl, serviceRoleKey) {
  return supabaseRequest(
    'GET',
    `/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}&select=id,title,price_cents`,
    null,
    supabaseUrl,
    serviceRoleKey
  );
}

/**
 * Create enrollment in Supabase
 */
function createEnrollment(enrollment, supabaseUrl, serviceRoleKey) {
  return supabaseRequest(
    'POST',
    '/rest/v1/enrollments',
    enrollment,
    supabaseUrl,
    serviceRoleKey
  );
}

/**
 * Increment discount code usage
 */
function incrementDiscountUsage(code, supabaseUrl, serviceRoleKey) {
  if (!code) return Promise.resolve();
  return supabaseRequest(
    'POST',
    '/rest/v1/rpc/increment_discount_usage',
    { code_input: code },
    supabaseUrl,
    serviceRoleKey
  );
}

// ─── handler ─────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SERVICE_ROLE) {
    console.error('[stripe-webhook] Missing environment variables');
    return { statusCode: 500, body: 'Server configuration error' };
  }

  // Verify Stripe signature
  const signature = event.headers['stripe-signature'];
  if (!signature) {
    return { statusCode: 400, body: 'Missing stripe-signature header' };
  }

  const payload = event.body;
  const isValid = verifyStripeSignature(payload, signature, STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    console.error('[stripe-webhook] Invalid signature');
    return { statusCode: 400, body: 'Invalid signature' };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(payload);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  console.log(`[stripe-webhook] Event received: ${stripeEvent.type}`);

  // ─── Handle checkout.session.completed ───────────────────
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    const courseId = session.metadata?.course_id;
    const userId = session.metadata?.user_id;
    const discountCode = session.metadata?.discount_code || null;
    const stripeSessionId = session.id;
    const paymentIntentId = session.payment_intent;
    const amountPaid = session.amount_total; // in cents

    if (!courseId || !userId) {
      console.error('[stripe-webhook] Missing metadata:', session.metadata);
      // Return 200 so Stripe doesn't retry — log the issue
      return { statusCode: 200, body: 'Missing metadata — logged' };
    }

    console.log(`[stripe-webhook] Processing enrollment: user=${userId} course=${courseId} paid=${amountPaid}`);

    try {
      // Create enrollment — upsert to prevent duplicates
      const enrollResult = await createEnrollment(
        {
          user_id: userId,
          course_id: courseId,
          stripe_payment_intent_id: paymentIntentId,
          stripe_session_id: stripeSessionId,
          amount_paid_cents: amountPaid,
          is_active: true,
          purchased_at: new Date().toISOString(),
        },
        SUPABASE_URL,
        SERVICE_ROLE
      );

      if (enrollResult.status >= 400) {
        // Check if it's a duplicate (409 Conflict = already enrolled)
        const errData = enrollResult.data;
        if (enrollResult.status === 409 || (errData && errData.code === '23505')) {
          console.log(`[stripe-webhook] Already enrolled — skipping: user=${userId} course=${courseId}`);
          return { statusCode: 200, body: 'Already enrolled' };
        }
        throw new Error(`Supabase error ${enrollResult.status}: ${JSON.stringify(enrollResult.data)}`);
      }

      console.log(`[stripe-webhook] Enrollment created: user=${userId} course=${courseId}`);

      // Increment discount code usage (best effort — don't fail if this errors)
      if (discountCode) {
        try {
          await incrementDiscountUsage(discountCode, SUPABASE_URL, SERVICE_ROLE);
        } catch (discountErr) {
          console.warn('[stripe-webhook] Failed to increment discount usage:', discountErr.message);
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ received: true, enrolled: true }),
      };

    } catch (err) {
      console.error('[stripe-webhook] Enrollment error:', err.message);
      // Return 500 so Stripe retries
      return { statusCode: 500, body: `Enrollment failed: ${err.message}` };
    }
  }

  // All other events — acknowledge receipt
  console.log(`[stripe-webhook] Unhandled event type: ${stripeEvent.type}`);
  return { statusCode: 200, body: JSON.stringify({ received: true, handled: false }) };
};
