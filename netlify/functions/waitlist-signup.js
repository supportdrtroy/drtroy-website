/**
 * DrTroy CE Platform — Netlify Function: waitlist-signup
 * POST /.netlify/functions/waitlist-signup
 * Server-side waitlist signup with bot protection.
 * Validates input, checks honeypot, rate-limits by IP, upserts to Supabase,
 * and triggers confirmation email for new signups.
 */
const https = require('https');

const SUPABASE_HOST = 'pnqoxulxdmlmbywcpbyx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error('[waitlist-signup] Missing SUPABASE_SERVICE_ROLE_KEY'); }

const ALLOWED_ORIGINS = ['https://drtroy.com', 'https://www.drtroy.com'];

// In-memory rate limit store (per function instance)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 600000; // 10 minutes
const RATE_LIMIT_MAX = 5;         // 5 signups per window per IP

function getCorsHeaders(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

function httpReq(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
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

function sbRest(method, path, bodyObj, extra = {}) {
  const body = bodyObj ? JSON.stringify(bodyObj) : null;
  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extra,
  };
  if (body) headers['Content-Length'] = Buffer.byteLength(body);
  return httpReq({ hostname: SUPABASE_HOST, path, method, headers }, body);
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function isRateLimited(ip) {
  const now = Date.now();
  let entry = rateLimitStore.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    entry = { start: now, count: 0 };
    rateLimitStore.set(ip, entry);
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

exports.handler = async (event) => {
  const cors = getCorsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };

  // Rate limit by IP
  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
             event.headers['x-real-ip'] || 'unknown';
  if (isRateLimited(ip)) {
    return { statusCode: 429, headers: cors, body: JSON.stringify({ error: 'Too many requests. Please try again later.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { email, first_name, last_name, discipline, source, honeypot } = body;

  // Honeypot check — if filled, return fake success
  if (honeypot) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true, is_new: true }) };
  }

  // Validate required fields
  if (!email || !first_name || !last_name) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Name and email are required.' }) };
  }

  if (!isValidEmail(email)) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid email address.' }) };
  }

  // Block disposable/suspicious email patterns
  const emailLower = email.toLowerCase().trim();
  const disposableDomains = ['mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email', 'yopmail.com', 'sharklasers.com', 'grr.la', 'guerrillamailblock.com', 'pokemail.net', 'spam4.me', 'trashmail.com', 'discard.email'];
  const domain = emailLower.split('@')[1];
  if (disposableDomains.includes(domain)) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Please use a valid email address.' }) };
  }

  try {
    // Upsert to waitlist (merge on duplicate email)
    const res = await sbRest('POST', '/rest/v1/waitlist', {
      email: emailLower,
      first_name: first_name.trim() || null,
      last_name: last_name.trim() || null,
      discipline: discipline || null,
      source: source || 'coming-soon',
    }, { Prefer: 'resolution=merge-duplicates,return=representation' });

    if (res.status >= 400) {
      console.error('[waitlist-signup] Supabase error:', res.body);
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Server error. Please try again.' }) };
    }

    const isNew = Array.isArray(res.body) && res.body[0] && !res.body[0].notified_at;

    // Trigger confirmation email for new signups (fire and forget)
    if (isNew) {
      const confirmBody = JSON.stringify({ email: emailLower, firstName: first_name.trim(), lastName: last_name.trim(), discipline });
      httpReq({
        hostname: event.headers.host || 'drtroy.com',
        path: '/.netlify/functions/send-waitlist-confirm',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(confirmBody) },
      }, confirmBody).catch(() => {});
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ success: true, is_new: isNew }),
    };

  } catch (error) {
    console.error('[waitlist-signup] Error:', error);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Server error. Please try again.' }) };
  }
};
