/**
 * DrTroy CE Platform — Netlify Function: stripe-webhook
 * POST /.netlify/functions/stripe-webhook
 *
 * Handles Stripe webhook events.
 * checkout.session.completed → creates enrollment(s) in Supabase.
 *
 * Stripe Dashboard webhook config:
 *   URL: https://drtroy.com/.netlify/functions/stripe-webhook
 *   Events: checkout.session.completed
 *
 * Env vars required:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET   (whsec_... from Stripe webhook settings)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const https  = require('https');
const crypto = require('crypto');

// ─── Stripe signature verification ───────────────────────────

function verifyStripeSignature(payload, signature, secret) {
  const parts = {};
  signature.split(',').forEach((part) => {
    const [key, val] = part.split('=');
    parts[key] = val;
  });
  const timestamp    = parts['t'];
  const expectedSig  = parts['v1'];
  if (!timestamp || !expectedSig) return false;

  const tolerance = 5 * 60;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > tolerance) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(expectedSig, 'hex'));
  } catch {
    return false;
  }
}

// ─── Supabase helpers ─────────────────────────────────────────

function supabaseRequest(method, path, body, supabaseUrl, serviceRoleKey) {
  return new Promise((resolve, reject) => {
    const url     = new URL(`${supabaseUrl}${path}`);
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method,
      headers: {
        apikey:          serviceRoleKey,
        Authorization:   `Bearer ${serviceRoleKey}`,
        'Content-Type':  'application/json',
        Prefer:          'return=representation',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getPackageCourseIds(packageId, supabaseUrl, serviceRoleKey) {
  const res = await supabaseRequest(
    'GET',
    `/rest/v1/packages?id=eq.${encodeURIComponent(packageId)}&select=id,course_ids`,
    null, supabaseUrl, serviceRoleKey
  );
  if (res.status === 200 && res.data && res.data[0]) {
    return res.data[0].course_ids || [];
  }
  return [];
}

async function createEnrollment(enrollment, supabaseUrl, serviceRoleKey) {
  return supabaseRequest('POST', '/rest/v1/enrollments', enrollment, supabaseUrl, serviceRoleKey);
}

async function createProgressRow(progress, supabaseUrl, serviceRoleKey) {
  return supabaseRequest('POST', '/rest/v1/course_progress', progress, supabaseUrl, serviceRoleKey);
}

async function incrementDiscountUsage(code, supabaseUrl, serviceRoleKey) {
  if (!code) return;
  // Use RPC if available; otherwise silently skip
  try {
    await supabaseRequest('POST', '/rest/v1/rpc/increment_discount_usage', { code_input: code }, supabaseUrl, serviceRoleKey);
  } catch { /* best effort */ }
}

// ─── handler ─────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const SUPABASE_URL          = process.env.SUPABASE_URL;
  const SERVICE_ROLE          = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SERVICE_ROLE) {
    console.error('[stripe-webhook] Missing environment variables');
    return { statusCode: 500, body: 'Server configuration error' };
  }

  const signature = event.headers['stripe-signature'];
  if (!signature) return { statusCode: 400, body: 'Missing stripe-signature header' };

  const payload = event.body;
  if (!verifyStripeSignature(payload, signature, STRIPE_WEBHOOK_SECRET)) {
    console.error('[stripe-webhook] Invalid signature');
    return { statusCode: 400, body: 'Invalid signature' };
  }

  let stripeEvent;
  try { stripeEvent = JSON.parse(payload); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  console.log(`[stripe-webhook] Event: ${stripeEvent.type}`);

  if (stripeEvent.type === 'checkout.session.completed') {
    const session      = stripeEvent.data.object;
    const meta         = session.metadata || {};
    const itemId       = meta.item_id   || meta.course_id;  // support legacy field
    const itemType     = meta.item_type || 'course';
    const userId       = meta.user_id;
    const discountCode = meta.discount_code || null;
    const paymentIntent = session.payment_intent;
    const amountPaid   = session.amount_total;

    if (!itemId || !userId || userId.startsWith('guest_')) {
      console.warn('[stripe-webhook] Missing/guest metadata — no enrollment created:', meta);
      return { statusCode: 200, body: 'No enrollment (guest or missing metadata)' };
    }

    console.log(`[stripe-webhook] Processing: user=${userId} item=${itemId} type=${itemType} paid=${amountPaid}`);

    try {
      // Resolve course IDs to enroll
      let courseIds = [];
      let packageId = null;

      if (itemType === 'package') {
        packageId = itemId;
        courseIds = await getPackageCourseIds(itemId, SUPABASE_URL, SERVICE_ROLE);
        if (courseIds.length === 0) {
          console.error('[stripe-webhook] Package has no courses:', itemId);
          return { statusCode: 200, body: 'Package has no courses — logged' };
        }
        console.log(`[stripe-webhook] Package ${itemId} → ${courseIds.length} courses`);
      } else {
        courseIds = [itemId];
      }

      // Create enrollment + progress row for each course
      const errors = [];
      for (const courseId of courseIds) {
        const enrollResult = await createEnrollment({
          user_id:                  userId,
          course_id:                courseId,
          package_id:               packageId,
          stripe_payment_intent_id: paymentIntent,
          amount_paid_cents:        itemType === 'package' ? 0 : amountPaid, // 0 for package sub-courses
          purchased_at:             new Date().toISOString(),
        }, SUPABASE_URL, SERVICE_ROLE);

        if (enrollResult.status >= 400) {
          if (enrollResult.status === 409 || enrollResult.data?.code === '23505') {
            console.log(`[stripe-webhook] Already enrolled: user=${userId} course=${courseId}`);
            continue;
          }
          errors.push(`Enroll ${courseId}: ${enrollResult.status} ${JSON.stringify(enrollResult.data)}`);
          continue;
        }

        // Create course_progress row
        const enrollId = enrollResult.data?.[0]?.id;
        if (enrollId) {
          await createProgressRow({
            user_id:       userId,
            course_id:     courseId,
            enrollment_id: enrollId,
            status:        'not_started',
            progress_pct:  0,
          }, SUPABASE_URL, SERVICE_ROLE);
        }
      }

      if (errors.length > 0) {
        console.error('[stripe-webhook] Enrollment errors:', errors);
        return { statusCode: 500, body: `Some enrollments failed: ${errors.join('; ')}` };
      }

      // Increment discount code usage (best effort)
      if (discountCode) {
        await incrementDiscountUsage(discountCode, SUPABASE_URL, SERVICE_ROLE);
      }

      console.log(`[stripe-webhook] ✅ Enrolled user=${userId} in ${courseIds.length} course(s)`);
      return { statusCode: 200, body: JSON.stringify({ received: true, enrolled: courseIds.length }) };

    } catch (err) {
      console.error('[stripe-webhook] Error:', err.message);
      return { statusCode: 500, body: `Enrollment failed: ${err.message}` };
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true, handled: false }) };
};
