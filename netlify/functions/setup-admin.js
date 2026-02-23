/**
 * TEMPORARY — One-time admin account setup.
 * Creates or resets the admin user using the service role key.
 *
 * DELETE THIS FILE after the admin account is working.
 *
 * Usage: POST /.netlify/functions/setup-admin
 *   Body: { "secret": "drtroy-setup-2026", "email": "troy@drtroy.com", "password": "DrTroy2026!" }
 */

const https = require('https');

const SUPABASE_HOST = 'pnqoxulxdmlmbywcpbyx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function sbRest(method, path, bodyObj) {
  const body = bodyObj ? JSON.stringify(bodyObj) : null;
  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  if (body) headers['Content-Length'] = Buffer.byteLength(body);
  return httpRequest({ hostname: SUPABASE_HOST, path, method, headers }, body);
}

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  // Simple secret to prevent random people from using this endpoint
  if (body.secret !== 'drtroy-setup-2026') {
    return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid secret' }) };
  }

  if (!SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured in Netlify' }) };
  }

  const email = body.email || 'troy@drtroy.com';
  const password = body.password || 'DrTroy2026!';

  const steps = [];

  try {
    // Step 1: Check if user already exists in auth
    steps.push('Checking for existing user...');
    const listRes = await httpRequest({
      hostname: SUPABASE_HOST,
      path: '/auth/v1/admin/users',
      method: 'GET',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }, null);

    let existingUser = null;
    if (listRes.status === 200 && listRes.body && listRes.body.users) {
      existingUser = listRes.body.users.find(u => u.email === email);
    }

    let userId;

    if (existingUser) {
      // User exists — update their password
      userId = existingUser.id;
      steps.push(`User found: ${userId}. Updating password...`);

      const updateBody = JSON.stringify({ password, email_confirm: true });
      const updateRes = await httpRequest({
        hostname: SUPABASE_HOST,
        path: `/auth/v1/admin/users/${userId}`,
        method: 'PUT',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(updateBody),
        },
      }, updateBody);

      if (updateRes.status >= 400) {
        steps.push(`Password update failed: ${JSON.stringify(updateRes.body)}`);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to update password', steps, detail: updateRes.body }) };
      }
      steps.push('Password updated successfully.');
    } else {
      // Create new user
      steps.push('User not found. Creating new auth user...');

      const createBody = JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: 'Troy', last_name: 'Admin' },
      });
      const createRes = await httpRequest({
        hostname: SUPABASE_HOST,
        path: '/auth/v1/admin/users',
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(createBody),
        },
      }, createBody);

      if (createRes.status >= 400) {
        steps.push(`User creation failed: ${JSON.stringify(createRes.body)}`);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to create user', steps, detail: createRes.body }) };
      }

      userId = createRes.body.id;
      steps.push(`User created: ${userId}`);
    }

    // Step 2: Upsert profile with is_admin = true
    steps.push('Upserting admin profile...');
    const profileRes = await sbRest('POST', '/rest/v1/profiles', {
      id: userId,
      email,
      first_name: 'Troy',
      last_name: 'Admin',
      is_admin: true,
      is_suspended: false,
    });

    // If POST fails due to conflict, try PATCH
    if (profileRes.status === 409 || profileRes.status === 400) {
      steps.push('Profile exists, updating is_admin flag...');
      const patchRes = await sbRest('PATCH', `/rest/v1/profiles?id=eq.${userId}`, { is_admin: true, is_suspended: false });
      if (patchRes.status >= 400) {
        steps.push(`Profile update failed: ${JSON.stringify(patchRes.body)}`);
      } else {
        steps.push('Profile updated with is_admin=true.');
      }
    } else if (profileRes.status >= 400) {
      steps.push(`Profile creation failed: ${JSON.stringify(profileRes.body)}`);
    } else {
      steps.push('Profile created with is_admin=true.');
    }

    // Step 3: Verify login works
    steps.push('Verifying login...');
    const loginBody = JSON.stringify({ email, password });
    const loginRes = await httpRequest({
      hostname: SUPABASE_HOST,
      path: '/auth/v1/token?grant_type=password',
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginBody),
      },
    }, loginBody);

    if (loginRes.status === 200) {
      steps.push('LOGIN VERIFIED — credentials work!');
    } else {
      steps.push(`Login verification failed: ${JSON.stringify(loginRes.body)}`);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: `Admin account ready: ${email}`,
        userId,
        steps,
      }),
    };
  } catch (err) {
    steps.push(`Exception: ${err.message}`);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message, steps }) };
  }
};
