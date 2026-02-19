/**
 * DrTroy CE Platform — Netlify Function: update-progress
 * POST /.netlify/functions/update-progress
 * Syncs course progress from frontend to Supabase course_progress table.
 * Also updates enrollment status (not_started → in_progress → completed).
 */
const https = require('https');

const SUPABASE_HOST = 'pnqoxulxdmlmbywcpbyx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucW94dWx4ZG1sbWJ5d2NwYnl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2NTc1MiwiZXhwIjoyMDg2OTQxNzUyfQ.P3qGeWVSvEbp3hjBXcJHfbHKxlhNUbQdn5IIi3WEjkE';

const ALLOWED_ORIGINS = ['https://drtroy.com', 'https://www.drtroy.com'];

function getCorsHeaders(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

// Verify user JWT and return user_id
async function verifyUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const res = await httpReq({
    hostname: SUPABASE_HOST, path: '/auth/v1/user', method: 'GET',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` }
  }, null);
  return (res.status === 200 && res.body?.id) ? res.body.id : null;
}

exports.handler = async (event) => {
  const cors = getCorsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };

  // Auth
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const userId = await verifyUser(authHeader);
  if (!userId) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { courseId, progressPercent, modulesCompleted, timeSpentSeconds, status } = body;
  if (!courseId) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'courseId required' }) };

  const now = new Date().toISOString();
  const newStatus = status || (progressPercent >= 100 ? 'completed' : progressPercent > 0 ? 'in_progress' : 'not_started');

  // Find enrollment
  const enrollRes = await sbRest('GET', `/rest/v1/enrollments?user_id=eq.${userId}&course_id=eq.${encodeURIComponent(courseId)}&limit=1`);
  if (!Array.isArray(enrollRes.body) || enrollRes.body.length === 0) {
    return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'Enrollment not found' }) };
  }
  const enrollment = enrollRes.body[0];

  // Upsert course_progress
  const existingRes = await sbRest('GET', `/rest/v1/course_progress?user_id=eq.${userId}&course_id=eq.${encodeURIComponent(courseId)}&limit=1`);
  let progressRecord;

  const progressData = {
    user_id: userId,
    course_id: courseId,
    enrollment_id: enrollment.id,
    status: newStatus,
    progress_percent: Math.min(100, Math.max(0, progressPercent || 0)),
    modules_completed: modulesCompleted || null,
    time_spent_seconds: timeSpentSeconds || 0,
    updated_at: now,
  };

  if (Array.isArray(existingRes.body) && existingRes.body.length > 0) {
    // Update
    const id = existingRes.body[0].id;
    if (newStatus === 'completed' && !existingRes.body[0].completed_at) {
      progressData.completed_at = now;
    }
    if (!existingRes.body[0].started_at) {
      progressData.started_at = now;
    }
    const upd = await sbRest('PATCH', `/rest/v1/course_progress?id=eq.${id}`, progressData);
    progressRecord = Array.isArray(upd.body) ? upd.body[0] : upd.body;
  } else {
    // Insert
    progressData.started_at = now;
    if (newStatus === 'completed') progressData.completed_at = now;
    const ins = await sbRest('POST', '/rest/v1/course_progress', progressData);
    progressRecord = Array.isArray(ins.body) ? ins.body[0] : ins.body;
  }

  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({ success: true, progress: progressRecord })
  };
};
