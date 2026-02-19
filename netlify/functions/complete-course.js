/**
 * DrTroy CE Platform — Netlify Function: complete-course
 * POST /.netlify/functions/complete-course
 * Marks a course as completed, updates progress to 100%, and auto-issues a certificate.
 * SECURITY: Validates actual course completion before issuing certificates.
 */
const https = require('https');
const crypto = require('crypto');

const SUPABASE_HOST = 'pnqoxulxdmlmbywcpbyx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!SERVICE_ROLE_KEY || !RESEND_API_KEY) { console.error('[complete-course] Missing required env vars'); }
const FROM_EMAIL = '"DrTroy Continuing Education" <no-reply@drtroy.com>';
const ALLOWED_ORIGINS = ['https://drtroy.com', 'https://www.drtroy.com'];

function getCorsHeaders(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Vary': 'Origin' };
}

function httpReq(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, body: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function sbRest(method, path, bodyObj, extra = {}) {
  const body = bodyObj ? JSON.stringify(bodyObj) : null;
  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...extra };
  if (body) headers['Content-Length'] = Buffer.byteLength(body);
  return httpReq({ hostname: SUPABASE_HOST, path, method, headers }, body);
}

async function verifyUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const res = await httpReq({ hostname: SUPABASE_HOST, path: '/auth/v1/user', method: 'GET', headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` } }, null);
  return (res.status === 200 && res.body?.id) ? res.body : null;
}

/** Generate cryptographically secure certificate number */
function generateCertNumber() {
  const year = new Date().getFullYear();
  const randomHex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `DRTROY-${year}-${randomHex}`;
}

exports.handler = async (event) => {
  const cors = getCorsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };

  // CSRF protection: require custom header that browsers won't send in cross-origin form submissions
  const xRequested = event.headers['x-requested-with'] || '';
  if (xRequested !== 'XMLHttpRequest' && xRequested !== 'fetch') {
    return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const user = await verifyUser(authHeader);
  if (!user) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { courseId } = body;
  if (!courseId) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'courseId required' }) };

  const now = new Date().toISOString();

  // Get enrollment
  const enrollRes = await sbRest('GET', `/rest/v1/enrollments?user_id=eq.${user.id}&course_id=eq.${encodeURIComponent(courseId)}&limit=1`);
  if (!Array.isArray(enrollRes.body) || enrollRes.body.length === 0) {
    return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'Enrollment not found' }) };
  }
  const enrollment = enrollRes.body[0];

  // Get course info
  const courseRes = await sbRest('GET', `/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}&limit=1`);
  const course = Array.isArray(courseRes.body) ? courseRes.body[0] : null;
  if (!course) {
    return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'Course not found' }) };
  }

  // ── SECURITY: Verify actual course completion ──────────────────────

  // 1. Check existing progress record
  const existingRes = await sbRest('GET', `/rest/v1/course_progress?user_id=eq.${user.id}&course_id=eq.${encodeURIComponent(courseId)}&limit=1`);
  const existingProgress = (Array.isArray(existingRes.body) && existingRes.body.length > 0) ? existingRes.body[0] : null;

  // 2. Verify minimum progress threshold (must have reached at least 90% via update-progress)
  if (!existingProgress || (existingProgress.progress_percent || 0) < 90) {
    return { statusCode: 403, headers: cors, body: JSON.stringify({ 
      error: 'Course not sufficiently completed. You must complete at least 90% of course modules before requesting a certificate.',
      currentProgress: existingProgress?.progress_percent || 0
    }) };
  }

  // 3. Verify minimum time spent (at least 50% of expected course duration)
  // CEU hours * 60 minutes * 60 seconds = expected duration in seconds
  // Require at least 50% of that time
  const ceuHours = parseFloat(course.ceu_hours) || 1;
  const expectedSeconds = ceuHours * 3600;
  const minimumSeconds = Math.floor(expectedSeconds * 0.5);
  const actualTimeSpent = existingProgress.time_spent_seconds || 0;

  if (actualTimeSpent < minimumSeconds) {
    return { statusCode: 403, headers: cors, body: JSON.stringify({ 
      error: 'Insufficient time spent on course. Please review all course materials before requesting a certificate.',
      minimumMinutes: Math.ceil(minimumSeconds / 60),
      actualMinutes: Math.ceil(actualTimeSpent / 60)
    }) };
  }

  // 4. Verify course was started at a reasonable time (not just now)
  if (existingProgress.started_at) {
    const startedAt = new Date(existingProgress.started_at).getTime();
    const nowMs = Date.now();
    const elapsedMs = nowMs - startedAt;
    // Must have been at least 10 minutes since starting
    if (elapsedMs < 10 * 60 * 1000) {
      return { statusCode: 403, headers: cors, body: JSON.stringify({ 
        error: 'Course completion too rapid. Please take time to review all materials.' 
      }) };
    }
  }

  // ── All checks passed - mark complete and issue certificate ────────

  const progressData = {
    user_id: user.id, course_id: courseId, enrollment_id: enrollment.id,
    status: 'completed', progress_percent: 100,
    modules_completed: existingProgress.modules_completed,
    time_spent_seconds: actualTimeSpent,
    completed_at: now, updated_at: now,
  };

  let progressRecord;
  const id = existingProgress.id;
  const upd = await sbRest('PATCH', `/rest/v1/course_progress?id=eq.${id}`, progressData);
  progressRecord = Array.isArray(upd.body) ? upd.body[0] : upd.body;

  // Check if certificate already exists
  const certExist = await sbRest('GET', `/rest/v1/certificates?user_id=eq.${user.id}&course_id=eq.${encodeURIComponent(courseId)}&limit=1`);
  let certificate;

  if (Array.isArray(certExist.body) && certExist.body.length > 0) {
    certificate = certExist.body[0];
  } else {
    // Issue new certificate with cryptographic number
    const certNumber = generateCertNumber();
    const certIns = await sbRest('POST', '/rest/v1/certificates', {
      user_id: user.id,
      course_id: courseId,
      completion_id: progressRecord?.id || null,
      certificate_number: certNumber,
      email_address: user.email || null,
      issued_at: now,
    });
    certificate = Array.isArray(certIns.body) ? certIns.body[0] : certIns.body;

    // Send certificate email
    if (user.email) {
      const courseTitle = course?.title || courseId;
      const ceuDisplay = course?.ceu_hours || '';
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:2rem;">
          <h1 style="color:#1e3a8a;">🎓 Certificate of Completion</h1>
          <p>Congratulations!</p>
          <p>You have completed <strong>${courseTitle}</strong>.</p>
          <div style="background:#f0f9ff;border:2px solid #1e3a8a;border-radius:12px;padding:1.5rem;margin:1.5rem 0;text-align:center;">
            <p style="color:#6b7280;margin:0;">Certificate Number</p>
            <p style="font-size:1.5rem;font-weight:700;color:#1e3a8a;margin:0.5rem 0;">${certNumber}</p>
            ${ceuDisplay ? `<p style="color:#6b7280;margin:0;">${ceuDisplay} CEU Hours</p>` : ''}
          </div>
          <p>View your certificates at <a href="https://drtroy.com/my-account.html">your account dashboard</a>.</p>
          <p style="color:#6b7280;font-size:0.9rem;">— DrTroy Continuing Education</p>
        </div>`;
      const emailBody = JSON.stringify({ from: FROM_EMAIL, to: [user.email], subject: `Your Certificate: ${courseTitle}`, html });
      try {
        const emailRes = await httpReq({ hostname: 'api.resend.com', path: '/emails', method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(emailBody) } }, emailBody);
        if (emailRes.status < 300) {
          await sbRest('PATCH', `/rest/v1/certificates?id=eq.${certificate.id}`, { emailed_at: now });
        }
      } catch { /* email failed but cert still issued */ }
    }
  }

  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({ success: true, progress: progressRecord, certificate })
  };
};
