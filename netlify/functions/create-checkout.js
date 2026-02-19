/**
 * DrTroy CE Platform — Netlify Function: create-checkout
 * POST /.netlify/functions/create-checkout
 *
 * Creates a Stripe Checkout Session for one or more courses/packages.
 *
 * Request body (multi-item):
 *   { items: [{ itemId, itemType }], userId, userEmail, discountCode?, successUrl, cancelUrl }
 *
 * Legacy single-item body (still supported):
 *   { itemId, itemType, userId, userEmail, discountCode?, successUrl, cancelUrl }
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

  const { userId, userEmail, discountCode, successUrl, cancelUrl } = body;

  // Support both multi-item { items: [...] } and legacy single-item { itemId, itemType }
  let items = body.items;
  if (!items || !Array.isArray(items) || items.length === 0) {
    const resolvedItemId = body.itemId || body.courseId;
    if (resolvedItemId) {
      items = [{ itemId: resolvedItemId, itemType: body.itemType || 'course' }];
    }
  }

  if (!items || items.length === 0 || !userId || !userEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields: items, userId, userEmail' }) };
  }

  try {
    // Validate discount if provided
    let discountRow = null;
    if (discountCode && discountCode.trim()) {
      discountRow = await validateDiscount(discountCode, SUPABASE_URL, SERVICE_ROLE);
    }

    // Look up each item and build Stripe line items
    const sessionParams = {
      'payment_method_types[]': 'card',
      mode: 'payment',
      customer_email: userEmail,
      'metadata[user_id]':      userId,
      'metadata[discount_code]': discountCode || '',
      success_url: successUrl,
      cancel_url:  cancelUrl,
    };

    const allItemIds = [];
    const allItemTypes = [];
    let totalFinalPrice = 0;

    for (let i = 0; i < items.length; i++) {
      const { itemId, itemType = 'course' } = items[i];
      let item, ceuInfo;

      if (itemType === 'package') {
        item = await supabaseGet(
          `/rest/v1/packages?id=eq.${encodeURIComponent(itemId)}&select=id,title,price_cents,total_ceu_hours`,
          SUPABASE_URL, SERVICE_ROLE
        );
        ceuInfo = `${item.total_ceu_hours} CEU Hours`;
      } else {
        item = await supabaseGet(
          `/rest/v1/courses?id=eq.${encodeURIComponent(itemId)}&select=id,title,price_cents,ceu_hours`,
          SUPABASE_URL, SERVICE_ROLE
        );
        ceuInfo = `${item.ceu_hours} CEU Hours`;
      }

      let finalPrice = item.price_cents;
      if (discountRow) finalPrice = applyDiscount(finalPrice, discountRow);
      totalFinalPrice += finalPrice;

      sessionParams[`line_items[${i}][price_data][currency]`] = 'usd';
      sessionParams[`line_items[${i}][price_data][product_data][name]`] = item.title;
      sessionParams[`line_items[${i}][price_data][product_data][description]`] = `${ceuInfo} | DrTroy.com CE Platform`;
      sessionParams[`line_items[${i}][price_data][unit_amount]`] = String(finalPrice);
      sessionParams[`line_items[${i}][quantity]`] = '1';

      allItemIds.push(itemId);
      allItemTypes.push(itemType);
    }

    // Store all item IDs in metadata (Stripe metadata values max 500 chars)
    sessionParams['metadata[item_ids]'] = allItemIds.join(',');
    sessionParams['metadata[item_types]'] = allItemTypes.join(',');
    // Keep legacy single-item fields for backward compat
    sessionParams['metadata[item_id]'] = allItemIds[0];
    sessionParams['metadata[item_type]'] = allItemTypes[0];

    // Free items: create enrollments server-side directly (don't rely on client)
    if (totalFinalPrice === 0) {
      // Resolve all course IDs (expand packages)
      let allCourseIds = [];
      for (let i = 0; i < items.length; i++) {
        const { itemId, itemType = 'course' } = items[i];
        if (itemType === 'package') {
          try {
            const pkg = await supabaseGet(
              `/rest/v1/packages?id=eq.${encodeURIComponent(itemId)}&select=id,course_ids`,
              SUPABASE_URL, SERVICE_ROLE
            );
            if (pkg.course_ids && Array.isArray(pkg.course_ids)) {
              allCourseIds.push(...pkg.course_ids);
            }
          } catch { /* skip if package not found */ }
        } else {
          allCourseIds.push(itemId);
        }
      }
      allCourseIds = [...new Set(allCourseIds)];

      // Create enrollment for each course
      const now = new Date().toISOString();
      for (const cId of allCourseIds) {
        const enrollBody = JSON.stringify({
          user_id: userId,
          course_id: cId,
          stripe_payment_intent_id: `free_${discountCode || 'promo'}_${Date.now()}`,
          amount_paid_cents: 0,
          is_active: true,
          purchased_at: now,
        });
        const enrollUrl = new URL(`${SUPABASE_URL}/rest/v1/enrollments`);
        try {
          await new Promise((resolve, reject) => {
            const opts = {
              hostname: enrollUrl.hostname,
              path: enrollUrl.pathname,
              method: 'POST',
              headers: {
                apikey: SERVICE_ROLE,
                Authorization: `Bearer ${SERVICE_ROLE}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
                'Content-Length': Buffer.byteLength(enrollBody),
              },
            };
            const req = https.request(opts, (res) => {
              let data = '';
              res.on('data', (c) => (data += c));
              res.on('end', () => resolve({ status: res.statusCode, data }));
            });
            req.on('error', reject);
            req.write(enrollBody);
            req.end();
          });
        } catch { /* best effort - may already be enrolled */ }

        // Create progress row
        const progressBody = JSON.stringify({
          user_id: userId,
          course_id: cId,
          module_id: '0',
          status: 'not_started',
          progress_percent: 0,
        });
        try {
          await new Promise((resolve, reject) => {
            const opts = {
              hostname: enrollUrl.hostname,
              path: new URL(`${SUPABASE_URL}/rest/v1/course_progress`).pathname,
              method: 'POST',
              headers: {
                apikey: SERVICE_ROLE,
                Authorization: `Bearer ${SERVICE_ROLE}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
                'Content-Length': Buffer.byteLength(progressBody),
              },
            };
            const req = https.request(opts, (res) => {
              let data = '';
              res.on('data', (c) => (data += c));
              res.on('end', () => resolve({ status: res.statusCode, data }));
            });
            req.on('error', reject);
            req.write(progressBody);
            req.end();
          });
        } catch { /* best effort */ }
      }

      // Increment discount usage
      if (discountCode) {
        try {
          const rpcBody = JSON.stringify({ code_input: discountCode });
          const rpcUrl = new URL(`${SUPABASE_URL}/rest/v1/rpc/increment_discount_usage`);
          await new Promise((resolve) => {
            const req = https.request({
              hostname: rpcUrl.hostname, path: rpcUrl.pathname, method: 'POST',
              headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(rpcBody) },
            }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve()); });
            req.on('error', () => resolve());
            req.write(rpcBody);
            req.end();
          });
        } catch { /* best effort */ }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ free: true, enrolled: true, message: 'Free enrollment created successfully.' }),
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
