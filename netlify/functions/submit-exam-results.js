/**
 * DrTroy CE Platform — Netlify Function: submit-exam-results
 * POST /.netlify/functions/submit-exam-results
 * Submits quiz/exam scores to Supabase course_progress table.
 * Sets quiz_score and quiz_passed flag based on passing_score threshold.
 */
const https = require('https');

const SUPABASE_HOST = 'pnqoxulxdmlmbywcpbyx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error('[submit-exam-results] Missing SUPABASE_SERVICE_ROLE_KEY'); }

const ALLOWED_ORIGINS = ['https://drtroy.com', 'https://www.drtroy.com'];

function getCorsHeaders(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
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

  // CSRF protection: require custom header
  const xRequested = event.headers['x-requested-with'] || '';
  if (xRequested !== 'XMLHttpRequest' && xRequested !== 'fetch') {
    return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  // Auth
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const userId = await verifyUser(authHeader);
  if (!userId) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { course_id, quiz_score, passing_score, total_questions, correct_answers } = body;
  if (!course_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'course_id required' }) };

  // Sanitize inputs
  const safeQuizScore = Math.min(100, Math.max(0, parseInt(quiz_score) || 0));
  const safePassingScore = parseInt(passing_score) || 70;
  const safeTotalQuestions = Math.max(0, parseInt(total_questions) || 0);
  const safeCorrectAnswers = Math.max(0, parseInt(correct_answers) || 0);
  const quizPassed = safeQuizScore >= safePassingScore;
  const now = new Date().toISOString();

  // Find enrollment
  const enrollRes = await sbRest('GET', `/rest/v1/enrollments?user_id=eq.${userId}&course_id=eq.${encodeURIComponent(course_id)}&limit=1`);
  if (!Array.isArray(enrollRes.body) || enrollRes.body.length === 0) {
    return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'Enrollment not found' }) };
  }
  const enrollment = enrollRes.body[0];

  // Find or create course_progress record
  const existingRes = await sbRest('GET', `/rest/v1/course_progress?user_id=eq.${userId}&course_id=eq.${encodeURIComponent(course_id)}&limit=1`);
  let progressRecord;

  const quizData = {
    quiz_score: safeQuizScore,
    quiz_passed: quizPassed,
    updated_at: now,
  };

  if (Array.isArray(existingRes.body) && existingRes.body.length > 0) {
    // Update existing record
    const id = existingRes.body[0].id;
    const upd = await sbRest('PATCH', `/rest/v1/course_progress?id=eq.${id}`, quizData);
    progressRecord = Array.isArray(upd.body) ? upd.body[0] : upd.body;
  } else {
    // Create new record with quiz data
    const insertData = {
      user_id: userId,
      course_id: course_id,
      enrollment_id: enrollment.id,
      status: 'in_progress',
      progress_percent: 0,
      started_at: now,
      ...quizData,
    };
    const ins = await sbRest('POST', '/rest/v1/course_progress', insertData);
    progressRecord = Array.isArray(ins.body) ? ins.body[0] : ins.body;
  }

  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({
      success: true,
      quiz_score: safeQuizScore,
      quiz_passed: quizPassed,
      total_questions: safeTotalQuestions,
      correct_answers: safeCorrectAnswers,
      progress: progressRecord,
    }),
  };
};
