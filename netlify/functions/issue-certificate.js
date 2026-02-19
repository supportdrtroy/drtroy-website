/**
 * DrTroy CE Platform — Netlify Function: issue-certificate
 * POST /.netlify/functions/issue-certificate
 * Issues or re-issues a certificate and optionally emails it via Resend.
 */
const https = require('https');

const SUPABASE_HOST = 'pnqoxulxdmlmbywcpbyx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucW94dWx4ZG1sbWJ5d2NwYnl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2NTc1MiwiZXhwIjoyMDg2OTQxNzUyfQ.P3qGeWVSvEbp3hjBXcJHfbHKxlhNUbQdn5IIi3WEjkE';
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_Z8BZLjWw_F7a29VSYgY8eJdhTXaCsn657';
const FROM_EMAIL = '"DrTroy Continuing Education" <no-reply@drtroy.com>';

const ALLOWED_ORIGINS = ['https://drtroy.com', 'https://www.drtroy.com'];

function getCorsHeaders(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function sbRest(method, path, bodyObj, extraHeaders = {}) {
  const body = bodyObj ? JSON.stringify(bodyObj) : null;
  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extraHeaders,
  };
  if (body) headers['Content-Length'] = Buffer.byteLength(body);
  return httpRequest({ hostname: SUPABASE_HOST, path, method, headers }, body);
}

async function verifyAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { valid: false };
  const token = authHeader.replace('Bearer ', '');
  const userRes = await httpRequest({
    hostname: SUPABASE_HOST, path: '/auth/v1/user', method: 'GET',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` }
  }, null);
  if (userRes.status !== 200 || !userRes.body?.id) return { valid: false };
  const profileRes = await sbRest('GET', `/rest/v1/profiles?id=eq.${userRes.body.id}&select=is_admin`);
  if (!Array.isArray(profileRes.body) || !profileRes.body[0]?.is_admin) return { valid: false };
  return { valid: true };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: getCorsHeaders(event), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Method not allowed' }) };

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const admin = await verifyAdmin(authHeader);
  if (!admin.valid) return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { userId, courseId, userEmail, userName, courseTitle, ceuHours, completionId, reissue } = body;
  if (!userId || !courseId) return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'userId and courseId are required' }) };

  const certNumber = `DRTROY-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`;
  const now = new Date().toISOString();

  let certRecord;
  if (reissue) {
    // Find existing certificate and update it
    const existingRes = await sbRest('GET', `/rest/v1/certificates?user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}&select=id&limit=1`);
    if (Array.isArray(existingRes.body) && existingRes.body.length > 0) {
      const certId = existingRes.body[0].id;
      const updateRes = await sbRest('PATCH', `/rest/v1/certificates?id=eq.${encodeURIComponent(certId)}`, {
        certificate_number: certNumber,
        issued_at: now,
        emailed_at: null
      });
      certRecord = Array.isArray(updateRes.body) ? updateRes.body[0] : updateRes.body;
    }
  }

  if (!certRecord) {
    // Create new certificate
    const insertRes = await sbRest('POST', '/rest/v1/certificates', {
      user_id: userId,
      course_id: courseId,
      completion_id: completionId || null,
      certificate_number: certNumber,
      email_address: userEmail || null,
      issued_at: now
    });
    if (insertRes.status >= 400) {
      return { statusCode: 500, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Failed to create certificate record' }) };
    }
    certRecord = Array.isArray(insertRes.body) ? insertRes.body[0] : insertRes.body;
  }

  // Send email notification via Resend
  let emailSent = false;
  if (userEmail) {
    const htmlBody = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:2rem;">
        <h1 style="color:#1e3a8a;">🎓 Certificate of Completion</h1>
        <p>Dear ${userName || 'Student'},</p>
        <p>Congratulations! Your certificate for <strong>${courseTitle || courseId}</strong> has been ${reissue ? 're-issued' : 'issued'}.</p>
        <div style="background:#f0f9ff;border:2px solid #1e3a8a;border-radius:12px;padding:1.5rem;margin:1.5rem 0;text-align:center;">
          <p style="color:#6b7280;margin:0;">Certificate Number</p>
          <p style="font-size:1.5rem;font-weight:700;color:#1e3a8a;margin:0.5rem 0;">${certNumber}</p>
          <p style="color:#6b7280;margin:0;">${ceuHours || ''} CEU Hours</p>
        </div>
        <p>You can view your certificates anytime from your <a href="https://drtroy.com/my-account.html">account dashboard</a>.</p>
        <p style="color:#6b7280;font-size:0.9rem;">— DrTroy Continuing Education</p>
      </div>
    `;
    const emailBody = JSON.stringify({ from: FROM_EMAIL, to: [userEmail], subject: `Your Certificate: ${courseTitle || courseId}`, html: htmlBody });
    try {
      const emailRes = await httpRequest({
        hostname: 'api.resend.com', path: '/emails', method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(emailBody) }
      }, emailBody);
      emailSent = emailRes.status < 300;
      if (emailSent) {
        await sbRest('PATCH', `/rest/v1/certificates?id=eq.${encodeURIComponent(certRecord.id)}`, { emailed_at: now });
      }
    } catch { /* email failed but cert still issued */ }
  }

  return {
    statusCode: 200,
    headers: getCorsHeaders(event),
    body: JSON.stringify({ success: true, certificate: certRecord, certNumber, emailSent })
  };
};
