/**
 * DrTroy CE Platform — Edge Function: Bot Guard
 * Blocks known scraper bots and AI crawlers from accessing course/pricing pages.
 */

const BLOCKED_BOTS = [
  'bot', 'crawler', 'spider', 'scraper', 'curl/', 'wget/', 'python-requests',
  'httpclient', 'java/', 'go-http-client', 'semrush', 'ahrefs', 'mj12',
  'dotbot', 'petalbot', 'bytespider', 'gptbot', 'ccbot', 'chatgpt',
  'anthropic', 'google-extended', 'facebookexternalhit', 'twitterbot'
];

export default async (request, context) => {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  
  // Block known bots entirely
  if (BLOCKED_BOTS.some(bot => ua.includes(bot))) {
    return new Response('Not Found', { status: 404 });
  }

  // Block requests with no user agent (likely automated)
  if (!ua || ua.length < 10) {
    return new Response('Not Found', { status: 404 });
  }

  return context.next();
};

export const config = {
  path: ['/course-catalog.html', '/checkout.html', '/cart.html', '/courses/*'],
};
