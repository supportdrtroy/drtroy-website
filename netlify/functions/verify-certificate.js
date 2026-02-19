/**
 * DrTroy CE Platform — Netlify Function: verify-certificate
 * GET /.netlify/functions/verify-certificate?number=DRTROY-2026-12345678
 * Public certificate verification endpoint.
 */
const https = require('https');

const SUPABASE_HOST = 'pnqoxulxdmlmbywcpbyx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const certNumber = event.queryStringParameters?.number;
  if (!certNumber) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Certificate number required' }) };
  if (!SERVICE_ROLE_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server config error' }) };

  // Look up certificate with course and user info
  const path = `/rest/v1/certificates?certificate_number=eq.${encodeURIComponent(certNumber)}&select=certificate_number,issued_at,revoked_at,course_id,user_id`;
  const certRes = await httpReq({
    hostname: SUPABASE_HOST, path, method: 'GET',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
  }, null);

  if (!Array.isArray(certRes.body) || certRes.body.length === 0) {
    return { statusCode: 404, headers, body: JSON.stringify({ valid: false, message: 'Certificate not found' }) };
  }

  const cert = certRes.body[0];
  if (cert.revoked_at) {
    return { statusCode: 200, headers, body: JSON.stringify({ valid: false, message: 'Certificate has been revoked', revokedAt: cert.revoked_at }) };
  }

  // Get course title
  const courseRes = await httpReq({
    hostname: SUPABASE_HOST,
    path: `/rest/v1/courses?id=eq.${encodeURIComponent(cert.course_id)}&select=title,ceu_hours`,
    method: 'GET',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
  }, null);

  // Get user name (first/last only)
  const profileRes = await httpReq({
    hostname: SUPABASE_HOST,
    path: `/rest/v1/profiles?id=eq.${encodeURIComponent(cert.user_id)}&select=first_name,last_name`,
    method: 'GET',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
  }, null);

  const course = Array.isArray(courseRes.body) ? courseRes.body[0] : {};
  const profile = Array.isArray(profileRes.body) ? profileRes.body[0] : {};

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      valid: true,
      certificateNumber: cert.certificate_number,
      issuedAt: cert.issued_at,
      recipientName: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'N/A',
      courseTitle: course.title || 'N/A',
      ceuHours: course.ceu_hours || 'N/A',
    }),
  };
};
