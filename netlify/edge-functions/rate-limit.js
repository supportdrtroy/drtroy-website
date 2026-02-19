/**
 * DrTroy CE Platform — Edge Function: Rate Limiting
 * Applies rate limiting to auth and sensitive endpoints.
 * Uses in-memory store (resets on cold start, but effective per-edge-node).
 */

const RATE_LIMITS = {
  '/auth/v1/token': { window: 60, max: 10 },        // login: 10/min
  '/auth/v1/signup': { window: 300, max: 5 },        // signup: 5/5min
  '/auth/v1/recover': { window: 300, max: 3 },       // password reset: 3/5min
  '/.netlify/functions/create-checkout': { window: 60, max: 10 },
  '/.netlify/functions/send-referral': { window: 300, max: 5 },
  '/.netlify/functions/send-waitlist-confirm': { window: 300, max: 5 },
  '/.netlify/functions/admin-actions': { window: 60, max: 30 },        // admin ops: 30/min
  '/.netlify/functions/send-campaign': { window: 3600, max: 5 },       // campaigns: 5/hour
  '/.netlify/functions/admin-reset-password': { window: 300, max: 10 }, // pwd resets: 10/5min
  '/.netlify/functions/issue-certificate': { window: 60, max: 20 },    // certs: 20/min
  '/.netlify/functions/complete-course': { window: 3600, max: 5 },     // course completion: 5/hour
  '/.netlify/functions/update-progress': { window: 3600, max: 100 },   // progress updates: 100/hour
  '/.netlify/functions/validate-discount': { window: 300, max: 10 },   // discount validation: 10/5min
  '/.netlify/functions/verify-certificate': { window: 60, max: 20 },   // cert verification: 20/min
};

// In-memory rate limit store (per edge node)
const store = new Map();

function getKey(ip, path) {
  return `${ip}:${path}`;
}

function isRateLimited(ip, path) {
  const config = Object.entries(RATE_LIMITS).find(([p]) => path.startsWith(p));
  if (!config) return false;

  const [, { window, max }] = config;
  const key = getKey(ip, config[0]);
  const now = Date.now();
  const windowMs = window * 1000;

  let entry = store.get(key);
  if (!entry || now - entry.start > windowMs) {
    entry = { start: now, count: 0 };
    store.set(key, entry);
  }

  entry.count++;
  return entry.count > max;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             request.headers.get('x-real-ip') || 'unknown';

  if (isRateLimited(ip, url.pathname)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
      },
    });
  }

  return context.next();
};

export const config = {
  path: [
    "/.netlify/functions/create-checkout",
    "/.netlify/functions/send-referral", 
    "/.netlify/functions/send-waitlist-confirm",
    "/.netlify/functions/admin-actions",
    "/.netlify/functions/send-campaign",
    "/.netlify/functions/admin-reset-password",
    "/.netlify/functions/issue-certificate",
    "/.netlify/functions/complete-course",
    "/.netlify/functions/update-progress",
    "/.netlify/functions/validate-discount",
    "/.netlify/functions/verify-certificate",
  ],
};
