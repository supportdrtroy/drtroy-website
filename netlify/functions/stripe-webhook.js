/**
 * DrTroy CE Platform — Netlify Function: stripe-webhook
 * POST /.netlify/functions/stripe-webhook
 *
 * Handles Stripe webhook events.
 * checkout.session.completed → creates enrollment(s) in Supabase + sends confirmation email.
 *
 * Env vars required:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY (for confirmation emails)
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

async function getCourseTitle(courseId, supabaseUrl, serviceRoleKey) {
  const res = await supabaseRequest(
    'GET',
    `/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}&select=id,title,ceu_hours`,
    null, supabaseUrl, serviceRoleKey
  );
  if (res.status === 200 && res.data && res.data[0]) {
    return res.data[0];
  }
  return { id: courseId, title: courseId, ceu_hours: '?' };
}

async function createEnrollment(enrollment, supabaseUrl, serviceRoleKey) {
  return supabaseRequest('POST', '/rest/v1/enrollments', enrollment, supabaseUrl, serviceRoleKey);
}

async function createProgressRow(progress, supabaseUrl, serviceRoleKey) {
  return supabaseRequest('POST', '/rest/v1/course_progress', progress, supabaseUrl, serviceRoleKey);
}

async function incrementDiscountUsage(code, supabaseUrl, serviceRoleKey) {
  if (!code) return;
  try {
    await supabaseRequest('POST', '/rest/v1/rpc/increment_discount_usage', { code_input: code }, supabaseUrl, serviceRoleKey);
  } catch { /* best effort */ }
}

// ─── Email helper (Resend API) ────────────────────────────────

function sendConfirmationEmail(toEmail, courseDetails, amountPaid) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn('[stripe-webhook] RESEND_API_KEY not set — skipping confirmation email');
    return Promise.resolve();
  }

  const courseListHtml = courseDetails.map(c =>
    `<li><strong>${c.title}</strong> — ${c.ceu_hours} CEU Hours</li>`
  ).join('\n');

  const totalCeus = courseDetails.reduce((sum, c) => sum + parseFloat(c.ceu_hours || 0), 0);
  const amountFormatted = (amountPaid / 100).toFixed(2);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a365d; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">🎓 Purchase Confirmed!</h1>
        <p style="margin: 8px 0 0; opacity: 0.9;">DrTroy Continuing Education</p>
      </div>
      <div style="padding: 24px; background: #f7fafc; border: 1px solid #e2e8f0;">
        <p>Thank you for your purchase! Your courses are ready to access right now.</p>
        
        <h3 style="color: #1a365d;">Your Courses:</h3>
        <ul style="line-height: 1.8;">${courseListHtml}</ul>
        
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Total Paid:</strong> $${amountFormatted}</p>
          <p style="margin: 4px 0 0;"><strong>Total CEU Hours:</strong> ${totalCeus}</p>
        </div>

        <h3 style="color: #1a365d;">How to Access Your Courses:</h3>
        <ol style="line-height: 1.8;">
          <li>Go to <a href="https://drtroy.com/my-account.html" style="color: #2b6cb0;">drtroy.com/my-account.html</a></li>
          <li>Log in with the email you used to purchase</li>
          <li>Click on any course to begin learning</li>
          <li>Complete all modules and pass the final exam to earn your certificate</li>
        </ol>

        <div style="text-align: center; margin: 24px 0;">
          <a href="https://drtroy.com/my-account.html" style="display: inline-block; background: #2b6cb0; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold;">Start Learning Now →</a>
        </div>

        <p style="color: #718096; font-size: 14px;">Questions? Reply to this email or contact us at support@drtroy.com</p>
      </div>
      <div style="text-align: center; padding: 16px; color: #a0aec0; font-size: 12px;">
        © ${new Date().getFullYear()} DrTroy Continuing Education · drtroy.com
      </div>
    </div>
  `;

  const emailBody = JSON.stringify({
    from: 'DrTroy Continuing Education <no-reply@drtroy.com>',
    to: [toEmail],
    subject: `Your ${courseDetails.length === 1 ? 'Course is' : courseDetails.length + ' Courses are'} Ready! — DrTroy CE`,
    html,
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(emailBody),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('[stripe-webhook] ✅ Confirmation email sent to', toEmail);
        } else {
          console.error('[stripe-webhook] Email send failed:', res.statusCode, data);
        }
        resolve();
      });
    });
    req.on('error', (err) => {
      console.error('[stripe-webhook] Email error:', err.message);
      resolve(); // Don't fail the webhook over email
    });
    req.write(emailBody);
    req.end();
  });
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

  const payload = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

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
    const userId       = meta.user_id;
    const discountCode = meta.discount_code || null;
    const paymentIntent = session.payment_intent;
    const amountPaid   = session.amount_total;
    const customerEmail = session.customer_email || session.customer_details?.email;

    // Support multi-item (item_ids comma-separated) and legacy single-item (item_id)
    let itemIds = [];
    let itemTypes = [];
    if (meta.item_ids) {
      itemIds = meta.item_ids.split(',').filter(Boolean);
      itemTypes = (meta.item_types || '').split(',').filter(Boolean);
    } else {
      const singleId = meta.item_id || meta.course_id;
      if (singleId) {
        itemIds = [singleId];
        itemTypes = [meta.item_type || 'course'];
      }
    }

    if (itemIds.length === 0 || !userId || userId.startsWith('guest_')) {
      console.warn('[stripe-webhook] Missing/guest metadata — no enrollment created:', meta);
      return { statusCode: 200, body: 'No enrollment (guest or missing metadata)' };
    }

    console.log(`[stripe-webhook] Processing: user=${userId} items=${itemIds.join(',')} paid=${amountPaid}`);

    try {
      // Resolve all course IDs to enroll
      let allCourseIds = [];

      for (let i = 0; i < itemIds.length; i++) {
        const itemId = itemIds[i];
        const itemType = itemTypes[i] || 'course';

        if (itemType === 'package') {
          const pkgCourses = await getPackageCourseIds(itemId, SUPABASE_URL, SERVICE_ROLE);
          if (pkgCourses.length === 0) {
            console.error('[stripe-webhook] Package has no courses:', itemId);
          } else {
            console.log(`[stripe-webhook] Package ${itemId} → ${pkgCourses.length} courses`);
            allCourseIds.push(...pkgCourses);
          }
        } else {
          allCourseIds.push(itemId);
        }
      }

      // Deduplicate
      allCourseIds = [...new Set(allCourseIds)];

      if (allCourseIds.length === 0) {
        console.error('[stripe-webhook] No courses to enroll');
        return { statusCode: 200, body: 'No courses resolved — logged' };
      }

      // Create enrollment + progress row for each course
      const errors = [];
      const enrolledCourseDetails = [];

      for (const courseId of allCourseIds) {
        const enrollResult = await createEnrollment({
          user_id:                  userId,
          course_id:                courseId,
          stripe_payment_intent_id: paymentIntent,
          amount_paid_cents:        amountPaid,
          is_active:                true,
          purchased_at:             new Date().toISOString(),
        }, SUPABASE_URL, SERVICE_ROLE);

        if (enrollResult.status >= 400) {
          if (enrollResult.status === 409 || enrollResult.data?.code === '23505') {
            console.log(`[stripe-webhook] Already enrolled: user=${userId} course=${courseId}`);
            // Still include in email
            const courseInfo = await getCourseTitle(courseId, SUPABASE_URL, SERVICE_ROLE);
            enrolledCourseDetails.push(courseInfo);
            continue;
          }
          errors.push(`Enroll ${courseId}: ${enrollResult.status} ${JSON.stringify(enrollResult.data)}`);
          continue;
        }

        // Create course_progress row
        const enrollId = enrollResult.data?.[0]?.id;
        if (enrollId) {
          await createProgressRow({
            user_id:          userId,
            course_id:        courseId,
            enrollment_id:    enrollId,
            module_id:        '0',
            status:           'not_started',
            progress_percent: 0,
          }, SUPABASE_URL, SERVICE_ROLE);
        }

        // Get course details for email
        const courseInfo = await getCourseTitle(courseId, SUPABASE_URL, SERVICE_ROLE);
        enrolledCourseDetails.push(courseInfo);
      }

      if (errors.length > 0) {
        console.error('[stripe-webhook] Enrollment errors:', errors);
        return { statusCode: 500, body: `Some enrollments failed: ${errors.join('; ')}` };
      }

      // Increment discount code usage (best effort)
      if (discountCode) {
        await incrementDiscountUsage(discountCode, SUPABASE_URL, SERVICE_ROLE);
      }

      // Send confirmation email (best effort — don't fail webhook)
      if (customerEmail && enrolledCourseDetails.length > 0) {
        await sendConfirmationEmail(customerEmail, enrolledCourseDetails, amountPaid || 0);
      }

      console.log(`[stripe-webhook] ✅ Enrolled user=${userId} in ${allCourseIds.length} course(s)`);
      return { statusCode: 200, body: JSON.stringify({ received: true, enrolled: allCourseIds.length }) };

    } catch (err) {
      console.error('[stripe-webhook] Error:', err.message);
      return { statusCode: 500, body: `Enrollment failed: ${err.message}` };
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true, handled: false }) };
};
