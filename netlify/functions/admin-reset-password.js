/**
 * DrTroy CE Platform — Netlify Function: admin-reset-password
 * POST /.netlify/functions/admin-reset-password
 * Sends password reset email via Supabase Auth (using service role).
 */
const https = require('https');

const SUPABASE_HOST = 'pnqoxulxdmlmbywcpbyx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error('[admin-reset-password] Missing SUPABASE_SERVICE_ROLE_KEY'); }

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

async function verifyAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { valid: false };
  const token = authHeader.replace('Bearer ', '');
  const userRes = await httpRequest({
    hostname: SUPABASE_HOST, path: '/auth/v1/user', method: 'GET',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` }
  }, null);
  if (userRes.status !== 200 || !userRes.body?.id) return { valid: false };
  const profileBody = JSON.stringify({ query: '' }); // unused
  const profileRes = await httpRequest({
    hostname: SUPABASE_HOST,
    path: `/rest/v1/profiles?id=eq.${userRes.body.id}&select=is_admin`,
    method: 'GET',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
  }, null);
  if (profileRes.status !== 200) return { valid: false };
  const profiles = typeof profileRes.body === 'string' ? JSON.parse(profileRes.body) : profileRes.body;
  if (!Array.isArray(profiles) || !profiles[0]?.is_admin) return { valid: false };
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

  const { email } = body;
  if (!email) return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'email is required' }) };

  // Use Supabase GoTrue recover endpoint with service role key
  const recoverBody = JSON.stringify({ email });
  const res = await httpRequest({
    hostname: SUPABASE_HOST,
    path: '/auth/v1/recover',
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(recoverBody)
    }
  }, recoverBody);

  if (res.status < 300) {
    // Audit log password reset
    try {
      const token = authHeader.replace('Bearer ', '');
      const adminUserRes = await httpRequest({
        hostname: SUPABASE_HOST, path: '/auth/v1/user', method: 'GET',
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` }
      }, null);
      const logBody = JSON.stringify({
        admin_user_id: adminUserRes.body?.id || null,
        action_type: 'admin_reset_password',
        details: { target_email: email },
        ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown',
        created_at: new Date().toISOString(),
      });
      await httpRequest({
        hostname: SUPABASE_HOST, path: '/rest/v1/admin_log', method: 'POST',
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', 'Content-Length': Buffer.byteLength(logBody) }
      }, logBody);
    } catch (e) { /* non-critical */ }
    return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify({ success: true }) };
  } else {
    return { statusCode: res.status, headers: getCorsHeaders(event), body: JSON.stringify({ error: res.body?.msg || res.body?.message || 'Failed to send reset email' }) };
  }
};
