/**
 * DrTroy CE Platform — Edge Function: Course Access Security
 *
 * Server-side protection for course HTML files at /courses/*.html.
 * Only authenticated users who are either admins or actively enrolled
 * in the relevant course may access course content.
 *
 * Flow:
 *  1. Intercept only .html requests under /courses/
 *  2. Extract Supabase auth token from cookie
 *  3. Verify the token via Supabase Auth API
 *  4. Check admin status — admins bypass enrollment checks
 *  5. Check active enrollment — match enrolled course IDs against the filename
 *  6. Redirect unauthorized users to /my-account.html?login=required
 */

const SUPABASE_URL = 'https://pnqoxulxdmlmbywcpbyx.supabase.co';
const SUPABASE_PROJECT_ID = 'pnqoxulxdmlmbywcpbyx';

/**
 * Map from database course_id to the file prefix used in /courses/ filenames.
 * Must stay in sync with COURSE_FILE_MAP in js/course-management.js.
 */
const COURSE_FILE_MAP = {
  'core-balance-001':    'balance-gait-001',
  'core-mobility-001':   'mobility-fall-001',
  'core-joint-001':      'joint-replacement-001',
  'core-geriatric-001':  'geriatric-care-001',
  'core-tech-001':       'healthcare-technology-001',
  'core-infection-001':  'infection-control-001',
  'core-neuro-001':      'pt-neuro-001',
  'core-education-001':  'patient-education-001',
  'core-agents-001':     'physical-agents-001',
  'core-postsurg-001':   'post-surgical-001',
  'core-doc-001':        'documentation-001',
  'ot-adl-001':          'ot-adl-001',
  'pt-msk-001':          'pt-msk-001',
};

/**
 * Build a reverse map: file prefix -> database course_id.
 * e.g. 'balance-gait-001' -> 'core-balance-001'
 */
const FILE_TO_COURSE_MAP = {};
for (const [courseId, filePrefix] of Object.entries(COURSE_FILE_MAP)) {
  FILE_TO_COURSE_MAP[filePrefix] = courseId;
}

/**
 * Known suffixes appended to the file prefix to form course HTML filenames.
 * e.g. balance-gait-001-progressive.html, pt-msk-001-quiz.html
 */
const KNOWN_SUFFIXES = ['-progressive', '-feedback', '-certificate', '-quiz'];

/**
 * Extract the file prefix from a course HTML filename.
 * "balance-gait-001-progressive.html" -> "balance-gait-001"
 * "pt-msk-001.html" -> "pt-msk-001"
 */
function extractFilePrefix(filename) {
  // Remove .html extension
  const base = filename.replace(/\.html$/, '');

  // Try stripping each known suffix
  for (const suffix of KNOWN_SUFFIXES) {
    if (base.endsWith(suffix)) {
      return base.slice(0, -suffix.length);
    }
  }

  // No known suffix — the base itself is the prefix (e.g. "pt-msk-001.html")
  return base;
}

/**
 * Given the filename from the URL, return all database course IDs that could
 * grant access. We check both the reverse-mapped ID and the file prefix itself
 * (in case the DB course_id matches the filename directly).
 */
function getPossibleCourseIds(filename) {
  const prefix = extractFilePrefix(filename);
  const ids = new Set();

  // Direct match: file prefix IS the course_id (e.g. 'pt-msk-001')
  ids.add(prefix);

  // Reverse-map match: file prefix maps to a different DB course_id
  if (FILE_TO_COURSE_MAP[prefix]) {
    ids.add(FILE_TO_COURSE_MAP[prefix]);
  }

  // Also try lowercase version in case of case mismatch
  ids.add(prefix.toLowerCase());

  return ids;
}

/**
 * Parse the Supabase auth token from cookies.
 *
 * Supabase JS v2 stores auth data in a cookie named:
 *   sb-<project-id>-auth-token
 *
 * The cookie value is a URL-encoded JSON array where element [0] is the
 * access token and element [1] is the refresh token.
 *
 * In some configurations it may also be stored as a base64-encoded JSON
 * string. We handle both formats.
 */
function extractAuthToken(cookieHeader) {
  if (!cookieHeader) return null;

  const cookieName = `sb-${SUPABASE_PROJECT_ID}-auth-token`;

  // Parse cookies manually (no cookie-parsing library in Deno edge)
  const cookies = cookieHeader.split(';');
  let tokenValue = null;

  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    // Handle both exact match and .0/.1 chunked cookies
    if (trimmed.startsWith(cookieName + '=')) {
      tokenValue = trimmed.slice(cookieName.length + 1);
      break;
    }
  }

  // Supabase v2.x can also chunk cookies as sb-<id>-auth-token.0, .1, etc.
  // Reassemble if the main cookie was not found
  if (!tokenValue) {
    const chunks = [];
    let i = 0;
    while (true) {
      const chunkName = `${cookieName}.${i}`;
      let found = false;
      for (const cookie of cookies) {
        const trimmed = cookie.trim();
        if (trimmed.startsWith(chunkName + '=')) {
          chunks.push(trimmed.slice(chunkName.length + 1));
          found = true;
          break;
        }
      }
      if (!found) break;
      i++;
    }
    if (chunks.length > 0) {
      tokenValue = chunks.join('');
    }
  }

  if (!tokenValue) return null;

  try {
    // URL-decode first
    const decoded = decodeURIComponent(tokenValue);

    // Try parsing as JSON — expected format: ["access_token", "refresh_token"]
    // or as a JSON object with access_token field
    const parsed = JSON.parse(decoded);

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed[0]; // First element is the access token
    }

    if (parsed && typeof parsed === 'object' && parsed.access_token) {
      return parsed.access_token;
    }

    // If it parsed as a plain string, it might be the token itself
    if (typeof parsed === 'string') {
      return parsed;
    }
  } catch (_e) {
    // Not valid JSON — try base64 decoding
    try {
      const base64decoded = atob(tokenValue);
      const parsed = JSON.parse(base64decoded);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }
      if (parsed && typeof parsed === 'object' && parsed.access_token) {
        return parsed.access_token;
      }
    } catch (_e2) {
      // If the raw value looks like a JWT (three dot-separated base64 segments), use it directly
      if (tokenValue.split('.').length === 3) {
        return tokenValue;
      }
    }
  }

  return null;
}

export default async function handler(request, context) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Only protect .html files under /courses/
  if (!pathname.match(/^\/courses\/[^/]+\.html$/)) {
    return context.next();
  }

  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    || Deno.env.get('VITE_SUPABASE_ANON_KEY')
    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucW94dWx4ZG1sbWJ5d2NwYnl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyMTgxNDYsImV4cCI6MjA1NDc5NDE0Nn0.VkzJaRj2jSlLsJHAeeVDmITHfhFjKMHqHS3PBWqDnKc';

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const filename = pathname.split('/').pop();

  // ── Step 1: Extract auth token from Supabase cookie ──
  const cookieHeader = request.headers.get('cookie');
  const accessToken = extractAuthToken(cookieHeader);

  if (!accessToken) {
    console.log(`[course-auth] BLOCKED (no token) | IP: ${ip} | Path: ${pathname}`);
    return Response.redirect(new URL('/my-account.html?login=required', request.url), 302);
  }

  // ── Step 2: Verify the token by calling Supabase Auth ──
  let userId;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userRes.ok) {
      console.log(`[course-auth] BLOCKED (invalid token, status ${userRes.status}) | IP: ${ip} | Path: ${pathname}`);
      return Response.redirect(new URL('/my-account.html?login=required', request.url), 302);
    }

    const userData = await userRes.json();
    userId = userData.id;

    if (!userId) {
      console.log(`[course-auth] BLOCKED (no user ID in response) | IP: ${ip} | Path: ${pathname}`);
      return Response.redirect(new URL('/my-account.html?login=required', request.url), 302);
    }
  } catch (err) {
    console.error(`[course-auth] Auth verification error: ${err.message}`);
    return Response.redirect(new URL('/my-account.html?login=required', request.url), 302);
  }

  // ── Step 3: Check admin status ──
  try {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=is_admin`,
      {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (profileRes.ok) {
      const profiles = await profileRes.json();
      if (profiles.length > 0 && profiles[0].is_admin === true) {
        console.log(`[course-auth] ALLOWED (admin) | User: ${userId} | Path: ${pathname}`);
        return context.next();
      }
    }
  } catch (err) {
    console.error(`[course-auth] Admin check error: ${err.message}`);
    // Continue to enrollment check — don't block just because admin check failed
  }

  // ── Step 4: Check enrollment ──
  try {
    const enrollRes = await fetch(
      `${SUPABASE_URL}/rest/v1/enrollments?user_id=eq.${userId}&select=course_id&is_active=eq.true`,
      {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (enrollRes.ok) {
      const enrollments = await enrollRes.json();

      // Build a set of all course IDs the user is enrolled in
      const enrolledCourseIds = new Set(enrollments.map(e => e.course_id));

      // Get all possible course IDs for the requested filename
      const possibleIds = getPossibleCourseIds(filename);

      // Check if any enrolled course ID matches any possible ID for this file
      for (const possibleId of possibleIds) {
        if (enrolledCourseIds.has(possibleId)) {
          console.log(`[course-auth] ALLOWED (enrolled: ${possibleId}) | User: ${userId} | Path: ${pathname}`);
          return context.next();
        }
      }

      // Fallback: check if any enrolled course_id's mapped file prefix appears in the filename
      // This handles future courses that might not be in the hardcoded map
      const filenameLower = filename.toLowerCase();
      for (const enrollment of enrollments) {
        const courseId = enrollment.course_id;

        // Check if the file prefix from COURSE_FILE_MAP is in the filename
        const mappedPrefix = COURSE_FILE_MAP[courseId];
        if (mappedPrefix && filenameLower.includes(mappedPrefix.toLowerCase())) {
          console.log(`[course-auth] ALLOWED (enrolled via map: ${courseId}) | User: ${userId} | Path: ${pathname}`);
          return context.next();
        }

        // Check if the course_id itself appears in the filename
        if (filenameLower.includes(courseId.toLowerCase())) {
          console.log(`[course-auth] ALLOWED (enrolled, id in filename: ${courseId}) | User: ${userId} | Path: ${pathname}`);
          return context.next();
        }
      }
    }
  } catch (err) {
    console.error(`[course-auth] Enrollment check error: ${err.message}`);
    // Fail closed — deny access if enrollment check fails
  }

  // ── Step 5: Not authorized — redirect ──
  console.log(`[course-auth] BLOCKED (not enrolled) | User: ${userId} | Path: ${pathname}`);
  return Response.redirect(new URL('/my-account.html?login=required', request.url), 302);
}

export const config = {
  path: '/courses/*',
};
