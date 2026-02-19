/**
 * DrTroy CE Platform — Netlify Function: send-campaign
 * POST /.netlify/functions/send-campaign
 * Sends email campaigns via Resend API to filtered user segments.
 * Requires admin JWT.
 */
const https = require('https');

const SUPABASE_HOST = 'pnqoxulxdmlmbywcpbyx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!SERVICE_ROLE_KEY || !RESEND_API_KEY) { console.error('[send-campaign] Missing required env vars'); }
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
  return { valid: true, userId: userRes.body.id };
}

async function getRecipients(filters) {
  // Build filter query for profiles
  let path = '/rest/v1/profiles?select=id,email,first_name,last_name&is_suspended=is.false';
  if (filters.profession) path += `&profession=eq.${encodeURIComponent(filters.profession)}`;
  if (filters.state) path += `&license_state=eq.${encodeURIComponent(filters.state)}`; // column is license_state in profiles
  
  const res = await sbRest('GET', path);
  let users = Array.isArray(res.body) ? res.body : [];
  
  // If filtering by course, get enrolled user IDs
  if (filters.courseId) {
    const enrollRes = await sbRest('GET', `/rest/v1/enrollments?select=user_id&course_id=eq.${encodeURIComponent(filters.courseId)}&is_active=is.true`);
    const enrolledIds = new Set((Array.isArray(enrollRes.body) ? enrollRes.body : []).map(e => e.user_id));
    users = users.filter(u => enrolledIds.has(u.id));
  }
  
  return users.filter(u => u.email);
}

async function sendViaResend(to, subject, htmlBody) {
  const body = JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html: htmlBody });
  return httpRequest({
    hostname: 'api.resend.com', path: '/emails', method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, body);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: getCorsHeaders(event), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Method not allowed' }) };

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const admin = await verifyAdmin(authHeader);
  if (!admin.valid) return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { action, subject, htmlBody, filters = {} } = body;

  // Count-only mode for preview
  if (action === 'count') {
    const recipients = await getRecipients(filters);
    return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify({ count: recipients.length }) };
  }

  // Send mode
  if (!subject || !htmlBody) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'subject and htmlBody are required' }) };
  }

  // Validate subject length
  if (subject.length > 200) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Subject line too long (max 200 characters)' }) };
  }

  // Validate body length
  if (htmlBody.length > 100000) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Email body too large (max 100KB)' }) };
  }

  const recipients = await getRecipients(filters);
  if (!recipients.length) {
    return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify({ success: true, sent: 0, message: 'No matching recipients' }) };
  }

  // Safety limit: max 500 emails per campaign send
  const MAX_RECIPIENTS = 500;
  if (recipients.length > MAX_RECIPIENTS) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: `Too many recipients (${recipients.length}). Maximum is ${MAX_RECIPIENTS} per campaign. Use filters to narrow your audience.` }) };
  }

  // Log campaign send
  try {
    await sbRest('POST', '/rest/v1/admin_log', {
      admin_user_id: admin.userId,
      action_type: 'send_campaign',
      details: { subject, recipientCount: recipients.length, filters },
      ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown',
      created_at: new Date().toISOString(),
    });
  } catch (e) { /* non-critical */ }

  let sent = 0, failed = 0;
  // Send in batches (Resend allows batch, but we'll send individually for reliability)
  for (const user of recipients) {
    try {
      const res = await sendViaResend(user.email, subject, htmlBody);
      if (res.status < 300) sent++; else failed++;
    } catch { failed++; }
  }

  return {
    statusCode: 200,
    headers: getCorsHeaders(event),
    body: JSON.stringify({ success: true, sent, failed, total: recipients.length })
  };
};
