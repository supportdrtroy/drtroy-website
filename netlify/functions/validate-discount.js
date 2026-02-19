/**
 * DrTroy CE Platform — Netlify Function: validate-discount
 * POST /.netlify/functions/validate-discount
 * Server-side discount code validation (replaces client-side DB access).
 */
const https = require('https');

const SUPABASE_HOST = 'pnqoxulxdmlmbywcpbyx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = ['https://drtroy.com', 'https://www.drtroy.com'];

function getCorsHeaders(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Vary': 'Origin' };
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

exports.handler = async (event) => {
  const cors = getCorsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  if (!SERVICE_ROLE_KEY) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Server config error' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { code } = body;
  if (!code || typeof code !== 'string') return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'code is required' }) };

  const rpcBody = JSON.stringify({ code_input: code });
  const res = await httpReq({
    hostname: SUPABASE_HOST,
    path: '/rest/v1/rpc/validate_discount_code',
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(rpcBody),
    },
  }, rpcBody);

  return { statusCode: 200, headers: cors, body: JSON.stringify(res.body) };
};
