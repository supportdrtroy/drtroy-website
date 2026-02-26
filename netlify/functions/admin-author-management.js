/**
 * DrTroy CE Platform — Netlify Function: admin-author-management
 * POST /.netlify/functions/admin-author-management
 *
 * Privileged admin operations for author management using Supabase service role.
 * Requires a valid admin JWT in Authorization: Bearer <token>
 *
 * Actions: list-authors, get-author, create-author, update-author, delete-author,
 *          assign-course, remove-course, get-author-sales, get-author-stats
 */

const https = require('https');

const SUPABASE_HOST = 'pnqoxulxdmlmbywcpbyx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error('[admin-author-management] Missing SUPABASE_SERVICE_ROLE_KEY'); }

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
  return httpReq({ hostname: SUPABASE_HOST, path, method, headers }, body);
}

/* ─── Verify caller is admin ──────────────────────────────── */

async function verifyAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, reason: 'Missing Authorization header' };
  }
  const token = authHeader.replace('Bearer ', '');

  // Get user identity from their JWT
  const userRes = await httpReq(
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

/**
 * List all authors with course count and total sales
 */
async function listAuthors() {
  // Get all authors
  const authorsRes = await sbRest('GET', '/rest/v1/authors?select=*&order=last_name.asc,first_name.asc');
  if (authorsRes.status >= 400) throw new Error('Failed to fetch authors');
  const authors = Array.isArray(authorsRes.body) ? authorsRes.body : [];

  // Get course counts per author
  const courseAuthorsRes = await sbRest('GET', '/rest/v1/course_authors?select=author_id');
  const courseAuthors = Array.isArray(courseAuthorsRes.body) ? courseAuthorsRes.body : [];

  // Get sales aggregates per author
  const salesRes = await sbRest('GET', '/rest/v1/author_sales?select=author_id,author_earning');
  const sales = Array.isArray(salesRes.body) ? salesRes.body : [];

  // Build lookup maps
  const courseCountMap = {};
  courseAuthors.forEach(function(ca) {
    courseCountMap[ca.author_id] = (courseCountMap[ca.author_id] || 0) + 1;
  });

  const salesMap = {};
  const earningsMap = {};
  sales.forEach(function(s) {
    salesMap[s.author_id] = (salesMap[s.author_id] || 0) + 1;
    earningsMap[s.author_id] = (earningsMap[s.author_id] || 0) + (s.author_earning || 0);
  });

  // Merge into authors
  const enriched = authors.map(function(a) {
    return Object.assign({}, a, {
      course_count: courseCountMap[a.id] || 0,
      total_sales: salesMap[a.id] || 0,
      total_earnings: earningsMap[a.id] || 0,
    });
  });

  return { authors: enriched };
}

/**
 * Get single author with full details including assigned courses and sales stats
 */
async function getAuthor(authorId) {
  if (!authorId) throw new Error('author_id is required');

  const authorRes = await sbRest('GET', `/rest/v1/authors?id=eq.${encodeURIComponent(authorId)}&select=*`);
  if (authorRes.status >= 400 || !Array.isArray(authorRes.body) || authorRes.body.length === 0) {
    throw new Error('Author not found');
  }
  const author = authorRes.body[0];

  // Get course assignments
  const coursesRes = await sbRest('GET', `/rest/v1/course_authors?author_id=eq.${encodeURIComponent(authorId)}&select=*`);
  const courses = Array.isArray(coursesRes.body) ? coursesRes.body : [];

  // Get sales stats
  const salesRes = await sbRest('GET', `/rest/v1/author_sales?author_id=eq.${encodeURIComponent(authorId)}&select=*&order=sale_date.desc`);
  const sales = Array.isArray(salesRes.body) ? salesRes.body : [];

  const totalEarnings = sales.reduce(function(sum, s) { return sum + (s.author_earning || 0); }, 0);
  const totalSales = sales.length;

  author.courses = courses;
  author.sales_stats = { total_earnings: totalEarnings, total_sales: totalSales };

  return { author: author };
}

/**
 * Create a new author
 */
async function createAuthor(data) {
  if (!data.first_name || !data.last_name || !data.email) {
    throw new Error('first_name, last_name, and email are required');
  }

  // Check for duplicate email
  const existing = await sbRest('GET', `/rest/v1/authors?email=eq.${encodeURIComponent(data.email)}&select=id`);
  if (Array.isArray(existing.body) && existing.body.length > 0) {
    throw new Error('An author with this email already exists');
  }

  const insertData = {
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    email: data.email.trim().toLowerCase(),
    credentials: data.credentials ? data.credentials.trim() : null,
    status: data.status || 'active',
  };

  const res = await sbRest('POST', '/rest/v1/authors', insertData);
  if (res.status >= 400) {
    throw new Error(res.body?.message || 'Failed to create author');
  }

  return { author: Array.isArray(res.body) ? res.body[0] : res.body };
}

/**
 * Update an existing author
 */
async function updateAuthor(data) {
  if (!data.author_id) throw new Error('author_id is required');

  const updates = {};
  if (data.first_name !== undefined) updates.first_name = data.first_name.trim();
  if (data.last_name !== undefined) updates.last_name = data.last_name.trim();
  if (data.email !== undefined) updates.email = data.email.trim().toLowerCase();
  if (data.credentials !== undefined) updates.credentials = data.credentials.trim();
  if (data.status !== undefined) updates.status = data.status;

  if (Object.keys(updates).length === 0) {
    throw new Error('No fields to update');
  }

  const res = await sbRest('PATCH', `/rest/v1/authors?id=eq.${encodeURIComponent(data.author_id)}`, updates);
  if (res.status >= 400) {
    throw new Error(res.body?.message || 'Failed to update author');
  }

  return { author: Array.isArray(res.body) ? res.body[0] : res.body };
}

/**
 * Delete an author and their course_authors entries
 */
async function deleteAuthor(authorId) {
  if (!authorId) throw new Error('author_id is required');

  // Remove course_authors entries first
  await sbRest('DELETE', `/rest/v1/course_authors?author_id=eq.${encodeURIComponent(authorId)}`);

  // Delete the author
  const res = await sbRest('DELETE', `/rest/v1/authors?id=eq.${encodeURIComponent(authorId)}`);
  if (res.status >= 400 && res.status !== 404) {
    throw new Error('Failed to delete author');
  }

  return { deleted: true };
}

/**
 * Assign a course to an author
 */
async function assignCourse(data) {
  if (!data.author_id || !data.course_id) {
    throw new Error('author_id and course_id are required');
  }

  // Check if already assigned
  const existing = await sbRest('GET',
    `/rest/v1/course_authors?author_id=eq.${encodeURIComponent(data.author_id)}&course_id=eq.${encodeURIComponent(data.course_id)}&select=id`
  );
  if (Array.isArray(existing.body) && existing.body.length > 0) {
    throw new Error('This course is already assigned to this author');
  }

  const insertData = {
    author_id: data.author_id,
    course_id: data.course_id,
    role: data.role || 'author',
    revenue_share: data.revenue_share !== undefined ? data.revenue_share : 15,
  };

  const res = await sbRest('POST', '/rest/v1/course_authors', insertData);
  if (res.status >= 400) {
    throw new Error(res.body?.message || 'Failed to assign course');
  }

  return { course_author: Array.isArray(res.body) ? res.body[0] : res.body };
}

/**
 * Remove a course assignment
 */
async function removeCourse(courseAuthorId) {
  if (!courseAuthorId) throw new Error('course_author_id is required');

  const res = await sbRest('DELETE', `/rest/v1/course_authors?id=eq.${encodeURIComponent(courseAuthorId)}`);
  if (res.status >= 400 && res.status !== 404) {
    throw new Error('Failed to remove course assignment');
  }

  return { removed: true };
}

/**
 * Get author sales with optional date filtering
 */
async function getAuthorSales(data) {
  if (!data.author_id) throw new Error('author_id is required');

  let path = `/rest/v1/author_sales?author_id=eq.${encodeURIComponent(data.author_id)}&select=*&order=sale_date.desc`;

  if (data.date_from) {
    path += `&sale_date=gte.${encodeURIComponent(data.date_from)}`;
  }
  if (data.date_to) {
    path += `&sale_date=lte.${encodeURIComponent(data.date_to)}`;
  }

  const res = await sbRest('GET', path);
  if (res.status >= 400) throw new Error('Failed to fetch author sales');

  return { sales: Array.isArray(res.body) ? res.body : [] };
}

/**
 * Get aggregate stats: total authors, total revenue, pending payouts
 */
async function getAuthorStats() {
  // Total and active authors
  const authorsRes = await sbRest('GET', '/rest/v1/authors?select=id,status');
  const authors = Array.isArray(authorsRes.body) ? authorsRes.body : [];
  const totalAuthors = authors.length;
  const activeAuthors = authors.filter(function(a) { return a.status === 'active'; }).length;

  // Total revenue and pending payouts from author_sales
  const salesRes = await sbRest('GET', '/rest/v1/author_sales?select=author_earning,payment_status');
  const sales = Array.isArray(salesRes.body) ? salesRes.body : [];

  let totalRevenue = 0;
  let pendingPayouts = 0;
  sales.forEach(function(s) {
    totalRevenue += (s.author_earning || 0);
    if (s.payment_status !== 'paid') {
      pendingPayouts += (s.author_earning || 0);
    }
  });

  return {
    total_authors: totalAuthors,
    active_authors: activeAuthors,
    total_revenue: totalRevenue,
    pending_payouts: pendingPayouts,
  };
}

/* ─── Main handler ────────────────────────────────────────── */

exports.handler = async (event) => {
  const cors = getCorsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };

  // Auth — verify admin
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const adminCheck = await verifyAdmin(authHeader);
  if (!adminCheck.valid) {
    return { statusCode: 403, headers: cors, body: JSON.stringify({ error: adminCheck.reason }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const action = body.action;
  if (!action) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'action is required' }) };
  }

  try {
    let result;

    switch (action) {
      case 'list-authors':
        result = await listAuthors();
        break;
      case 'get-author':
        result = await getAuthor(body.author_id);
        break;
      case 'create-author':
        result = await createAuthor(body);
        break;
      case 'update-author':
        result = await updateAuthor(body);
        break;
      case 'delete-author':
        result = await deleteAuthor(body.author_id);
        break;
      case 'assign-course':
        result = await assignCourse(body);
        break;
      case 'remove-course':
        result = await removeCourse(body.course_author_id);
        break;
      case 'get-author-sales':
        result = await getAuthorSales(body);
        break;
      case 'get-author-stats':
        result = await getAuthorStats();
        break;
      default:
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Unknown action: ' + action }) };
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error('[admin-author-management] Error:', action, err.message);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
