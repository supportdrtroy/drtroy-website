/**
 * DrTroy CE Platform — Netlify Function: admin-actions
 * POST /.netlify/functions/admin-actions
 *
 * Privileged admin operations using Supabase service role.
 * Requires a valid admin JWT in Authorization: Bearer <token>
 *
 * Actions: toggle_admin, create_user, suspend_user, delete_user,
 *          manual_enroll, remove_enrollment
 */

const https = require('https');

const SUPABASE_HOST = 'pnqoxulxdmlmbywcpbyx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

/* ─── HTTP helper ─────────────────────────────────────────── */

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/* ─── Supabase REST helper (service role) ─────────────────── */

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

/* ─── Verify caller is admin ──────────────────────────────── */

async function verifyAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, reason: 'Missing Authorization header' };
  }
  const token = authHeader.replace('Bearer ', '');

  // Get user identity from their JWT
  const userRes = await httpRequest(
    {
      hostname: SUPABASE_HOST,
      path: '/auth/v1/user',
      method: 'GET',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${token}`,
      },
    },
    null
  );

  if (userRes.status !== 200 || !userRes.body?.id) {
    return { valid: false, reason: 'Invalid or expired session token' };
  }

  const userId = userRes.body.id;

  // Check is_admin flag in profiles (using service role so RLS is bypassed)
  const profileRes = await sbRest(
    'GET',
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=is_admin`,
  );

  if (
    !Array.isArray(profileRes.body) ||
    !profileRes.body[0]
  ) {
    return { valid: false, reason: 'Profile not found' };
  }

  if (profileRes.body[0].is_admin !== true) {
    return { valid: false, reason: 'Not an admin account' };
  }

  return { valid: true, userId };
}

/* ─── Action handlers ─────────────────────────────────────── */

async function toggleAdmin({ userId, makeAdmin }) {
  if (!userId || makeAdmin === undefined) throw new Error('userId and makeAdmin are required');
  const res = await sbRest(
    'PATCH',
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    { is_admin: Boolean(makeAdmin) }
  );
  if (res.status >= 400) throw new Error(res.body?.message || 'Failed to update admin status');
  return { updated: true };
}

async function createUser({ email, password, firstName, lastName, profession, licenseNumber, state }) {
  if (!email || !password) throw new Error('email and password are required');

  // Create auth user
  const authBody = JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName || '', last_name: lastName || '' },
  });
  const authRes = await httpRequest(
    {
      hostname: SUPABASE_HOST,
      path: '/auth/v1/admin/users',
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(authBody),
      },
    },
    authBody
  );

  if (authRes.status >= 400) {
    throw new Error(authRes.body?.msg || authRes.body?.message || 'Failed to create auth user');
  }

  const newUserId = authRes.body.id;

  // Upsert profile row
  await sbRest(
    'POST',
    '/rest/v1/profiles',
    {
      id: newUserId,
      email,
      first_name: firstName || '',
      last_name: lastName || '',
      profession: profession || '',
      license_number: licenseNumber || '',
      state: state || '',
      is_admin: false,
      is_suspended: false,
    },
    { Prefer: 'resolution=merge-duplicates,return=representation' }
  );

  return { success: true, userId: newUserId };
}

async function suspendUser({ userId, suspend }) {
  if (!userId || suspend === undefined) throw new Error('userId and suspend are required');
  const res = await sbRest(
    'PATCH',
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    { is_suspended: Boolean(suspend) }
  );
  if (res.status >= 400) throw new Error(res.body?.message || 'Failed to update suspension status');
  return { updated: true };
}

async function deleteUser({ userId }) {
  if (!userId) throw new Error('userId is required');

  const delRes = await httpRequest(
    {
      hostname: SUPABASE_HOST,
      path: `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      method: 'DELETE',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    },
    null
  );

  if (delRes.status >= 400) {
    throw new Error(delRes.body?.message || `Delete failed with status ${delRes.status}`);
  }

  return { deleted: true };
}

async function manualEnroll({ userId, courseId }) {
  if (!userId || !courseId) throw new Error('userId and courseId are required');

  // Check for existing enrollment
  const checkRes = await sbRest(
    'GET',
    `/rest/v1/enrollments?user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}&select=id`
  );
  if (Array.isArray(checkRes.body) && checkRes.body.length > 0) {
    throw new Error('User is already enrolled in this course');
  }

  const res = await sbRest('POST', '/rest/v1/enrollments', {
    user_id: userId,
    course_id: courseId,
    amount_paid_cents: 0,
    purchased_at: new Date().toISOString(),
    is_active: true,
  });

  if (res.status >= 400) throw new Error(res.body?.message || 'Failed to enroll user');
  return { enrolled: true, enrollment: Array.isArray(res.body) ? res.body[0] : res.body };
}

async function removeEnrollment({ enrollmentId }) {
  if (!enrollmentId) throw new Error('enrollmentId is required');

  // Delete dependent course_progress rows first (FK constraint: NO ACTION)
  await sbRest('DELETE', `/rest/v1/course_progress?enrollment_id=eq.${encodeURIComponent(enrollmentId)}`);
  // Delete dependent completions rows (FK constraint: NO ACTION)
  await sbRest('DELETE', `/rest/v1/completions?enrollment_id=eq.${encodeURIComponent(enrollmentId)}`);

  const res = await sbRest(
    'DELETE',
    `/rest/v1/enrollments?id=eq.${encodeURIComponent(enrollmentId)}`
  );
  if (res.status >= 400) throw new Error(res.body?.message || 'Failed to remove enrollment');
  return { removed: true };
}

/* ─── Read-only admin data actions ────────────────────────── */

async function getUsers() {
  const res = await sbRest(
    'GET',
    '/rest/v1/profiles?select=*&order=created_at.desc'
  );
  if (res.status >= 400) throw new Error(res.body?.message || 'Failed to fetch users');
  return { users: Array.isArray(res.body) ? res.body : [] };
}

async function getDashboard() {
  const [usersRes, enrollRes, completionsRes] = await Promise.all([
    sbRest('GET', '/rest/v1/profiles?select=id'),
    sbRest('GET', '/rest/v1/enrollments?select=id,amount_paid_cents'),
    sbRest('GET', '/rest/v1/completions?select=id'),
  ]);
  const users = Array.isArray(usersRes.body) ? usersRes.body : [];
  const enrollments = Array.isArray(enrollRes.body) ? enrollRes.body : [];
  const completions = Array.isArray(completionsRes.body) ? completionsRes.body : [];
  const revenue = enrollments.reduce((sum, e) => sum + (parseInt(e.amount_paid_cents) || 0), 0) / 100;
  return { totalUsers: users.length, totalEnrollments: enrollments.length, totalCompletions: completions.length, revenue };
}

async function getEnrollments() {
  // Fetch enrollments and profiles separately (no FK between them in PostgREST)
  const [enrollRes, profilesRes] = await Promise.all([
    sbRest('GET', '/rest/v1/enrollments?select=*,courses(title,ceu_hours)&order=purchased_at.desc'),
    sbRest('GET', '/rest/v1/profiles?select=id,first_name,last_name,email'),
  ]);
  const enrollments = Array.isArray(enrollRes.body) ? enrollRes.body : [];
  const profiles = Array.isArray(profilesRes.body) ? profilesRes.body : [];
  const profileMap = {};
  profiles.forEach(p => { profileMap[p.id] = p; });
  // Attach profile data to each enrollment
  enrollments.forEach(e => {
    e.profiles = profileMap[e.user_id] || null;
  });
  return { enrollments };
}

async function getLicenseData() {
  const res = await sbRest(
    'GET',
    '/rest/v1/profiles?select=id,email,first_name,last_name,license_number,license_state,profession,license_expiry_date&license_expiry_date=not.is.null&order=license_expiry_date.asc'
  );
  if (res.status >= 400) throw new Error(res.body?.message || 'Failed to fetch license data');
  return { profiles: Array.isArray(res.body) ? res.body : [] };
}

async function getDiscountCodes() {
  const res = await sbRest(
    'GET',
    '/rest/v1/discount_codes?select=*&order=created_at.desc'
  );
  if (res.status >= 400) throw new Error(res.body?.message || 'Failed to fetch discount codes');
  return { codes: Array.isArray(res.body) ? res.body : [] };
}

async function updateDiscountCode({ id, updates }) {
  if (!id) throw new Error('id is required');
  const res = await sbRest(
    'PATCH',
    `/rest/v1/discount_codes?id=eq.${encodeURIComponent(id)}`,
    updates
  );
  if (res.status >= 400) throw new Error(res.body?.message || 'Failed to update discount code');
  return { updated: true };
}

async function deleteDiscountCodeAction({ id }) {
  if (!id) throw new Error('id is required');
  const res = await sbRest(
    'DELETE',
    `/rest/v1/discount_codes?id=eq.${encodeURIComponent(id)}`
  );
  if (res.status >= 400) throw new Error(res.body?.message || 'Failed to delete discount code');
  return { deleted: true };
}

async function lookupUser({ email }) {
  if (!email) throw new Error('email is required');
  const res = await sbRest(
    'GET',
    `/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,first_name,last_name,email,profession`
  );
  if (res.status >= 400) throw new Error(res.body?.message || 'Failed to lookup user');
  const profiles = Array.isArray(res.body) ? res.body : [];
  if (profiles.length === 0) throw new Error('User not found');
  return { user: profiles[0] };
}

async function getUserCredits({ userId }) {
  if (!userId) throw new Error('userId is required');
  const [creditsRes, txnsRes] = await Promise.all([
    sbRest('GET', `/rest/v1/account_credits?user_id=eq.${encodeURIComponent(userId)}&select=balance_cents`),
    sbRest('GET', `/rest/v1/credit_transactions?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=25`),
  ]);
  const credits = Array.isArray(creditsRes.body) && creditsRes.body[0] ? creditsRes.body[0] : { balance_cents: 0 };
  const transactions = Array.isArray(txnsRes.body) ? txnsRes.body : [];
  return { balance_cents: credits.balance_cents, transactions };
}

async function grantCreditsAction({ userId, amountCents, description, adminId }) {
  if (!userId || !amountCents) throw new Error('userId and amountCents are required');
  // Call the grant_credits RPC function using PostgREST
  const res = await sbRest('POST', '/rest/v1/rpc/grant_credits', {
    p_user_id: userId,
    p_amount_cents: amountCents,
    p_type: 'admin_grant',
    p_description: description || 'Admin credit grant',
    p_admin_id: adminId || null,
  });
  if (res.status >= 400) throw new Error(res.body?.message || 'Failed to grant credits');
  return res.body || { success: true };
}

/* ─── Main handler ────────────────────────────────────────── */

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: getCorsHeaders(event), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { action, payload = {} } = body;
  const authHeader =
    event.headers.authorization || event.headers.Authorization || '';

  // ── Auth check ──────────────────────────────────────────────
  const adminCheck = await verifyAdmin(authHeader);
  if (!adminCheck.valid) {
    console.warn('[admin-actions] Auth failed:', adminCheck.reason);
    return {
      statusCode: 403,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: 'Unauthorized: ' + adminCheck.reason }),
    };
  }

  // ── Route to action ─────────────────────────────────────────
  try {
    let result;
    switch (action) {
      case 'get_users':         result = await getUsers();                       break;
      case 'get_dashboard':     result = await getDashboard();                   break;
      case 'get_enrollments':   result = await getEnrollments();                 break;
      case 'get_license_data':  result = await getLicenseData();                 break;
      case 'get_discount_codes': result = await getDiscountCodes();              break;
      case 'update_discount_code': result = await updateDiscountCode(payload);   break;
      case 'delete_discount_code': result = await deleteDiscountCodeAction(payload); break;
      case 'lookup_user':       result = await lookupUser(payload);              break;
      case 'get_user_credits':  result = await getUserCredits(payload);          break;
      case 'grant_credits':     result = await grantCreditsAction(payload);      break;
      case 'toggle_admin':      result = await toggleAdmin(payload);             break;
      case 'create_user':       result = await createUser(payload);       break;
      case 'suspend_user':      result = await suspendUser(payload);      break;
      case 'delete_user':       result = await deleteUser(payload);       break;
      case 'manual_enroll':     result = await manualEnroll(payload);     break;
      case 'remove_enrollment': result = await removeEnrollment(payload); break;
      default:
        return {
          statusCode: 400,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: `Unknown action: ${action}` }),
        };
    }

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ success: true, data: result }),
    };
  } catch (err) {
    console.error(`[admin-actions] ${action} error:`, err.message);
    return {
      statusCode: 500,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: err.message }),
    };
  }
};
