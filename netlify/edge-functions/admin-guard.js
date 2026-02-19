/**
 * DrTroy CE Platform — Edge Function: Admin Access Guard
 * Logs all admin page access attempts and blocks suspicious patterns.
 */

const ADMIN_PATHS = ['/admin.html', '/secure-admin-access-2026.html', '/system-settings.html'];
const BLOCKED_BOTS = [
  'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python-requests',
  'httpclient', 'java/', 'go-http-client', 'semrush', 'ahrefs', 'mj12',
  'dotbot', 'petalbot', 'bytespider', 'gptbot', 'ccbot', 'chatgpt'
];

export default async (request, context) => {
  const url = new URL(request.url);
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // Block known bots from admin pages
  if (BLOCKED_BOTS.some(bot => ua.includes(bot))) {
    return new Response('Not Found', { status: 404 });
  }

  // Log admin access (visible in Netlify function logs)
  console.log(`[ADMIN-ACCESS] ${new Date().toISOString()} | IP: ${ip} | Path: ${url.pathname} | UA: ${ua.substring(0, 100)}`);

  // Add extra security headers for admin pages
  const response = await context.next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  
  return response;
};

export const config = {
  path: ['/admin.html', '/secure-admin-access-2026.html'],
};
