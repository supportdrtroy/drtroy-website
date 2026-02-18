/**
 * DrTroy CE Platform — Course Access Guard
 * Include as the FIRST script in any course page's <head>.
 * Set data-course-id on the <html> element, e.g.:
 *   <html data-course-id="pt-msk-001">
 *
 * Flow:
 *  1. Show a loading overlay immediately (prevents content flash)
 *  2. Wait for Supabase CDN to load
 *  3. Check for a valid session
 *     → No session → redirect to my-account.html (login)
 *  4. Check enrollment or admin status
 *     → Not enrolled, not admin → redirect to course-catalog.html
 *  5. Access granted → remove overlay, let page load normally
 */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://pnqoxulxdmlmbywcpbyx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucW94dWx4ZG1sbWJ5d2NwYnl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNjU3NTIsImV4cCI6MjA4Njk0MTc1Mn0.YEPrwIvINX_Q1AsbxyU0T5m5oxpV9M756yiSCzy6LTc';

  /* ── Detect course ID from <html data-course-id="..."> ── */
  function getCourseId() {
    return document.documentElement.getAttribute('data-course-id') || null;
  }

  /* ── Compute path depth so redirects work from /courses/ subdirectory ── */
  function rootPath(page) {
    var depth = window.location.pathname.split('/').filter(Boolean).length;
    var prefix = depth > 1 ? '../' : '';
    return prefix + page;
  }

  /* ── Inject a full-screen loading overlay immediately ── */
  function injectOverlay() {
    var style = document.createElement('style');
    style.id = 'cg-style';
    style.textContent = [
      '#cg-overlay{position:fixed;inset:0;z-index:99999;background:#0f172a;',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;',
      'font-family:\'Source Sans Pro\',sans-serif;color:#fff;}',
      '#cg-overlay .cg-logo{font-family:\'Playfair Display\',serif;font-size:1.8rem;',
      'color:#34d399;margin-bottom:1.5rem;letter-spacing:-.02em;}',
      '#cg-overlay .cg-msg{font-size:1rem;color:#94a3b8;margin-bottom:2rem;}',
      '#cg-overlay .cg-spinner{width:36px;height:36px;border:3px solid rgba(52,211,153,.2);',
      'border-top-color:#34d399;border-radius:50%;animation:cg-spin .8s linear infinite;}',
      '@keyframes cg-spin{to{transform:rotate(360deg);}}'
    ].join('');
    document.head.appendChild(style);

    var div = document.createElement('div');
    div.id = 'cg-overlay';
    div.innerHTML = '<div class="cg-logo">DrTroy CE</div>' +
      '<div class="cg-msg">Verifying access...</div>' +
      '<div class="cg-spinner"></div>';
    document.body ? document.body.appendChild(div) : document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(div);
    });
    return div;
  }

  /* ── Remove overlay once access is confirmed ── */
  function removeOverlay() {
    var el = document.getElementById('cg-overlay');
    if (el) el.remove();
    var st = document.getElementById('cg-style');
    if (st) st.remove();
  }

  /* ── Redirect helpers ── */
  function redirectLogin() {
    sessionStorage.setItem('cg_return', window.location.href);
    window.location.replace(rootPath('my-account.html') + '?auth=required');
  }

  function redirectCatalog() {
    window.location.replace(rootPath('course-catalog.html') + '?access=denied');
  }

  /* ── Wait for Supabase CDN (loaded via <script> tag in the page) ── */
  function waitForSupabase(timeout) {
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      (function check() {
        if (window.supabase && window.supabase.createClient) return resolve();
        if (Date.now() - start > timeout) return reject(new Error('Supabase timeout'));
        setTimeout(check, 50);
      })();
    });
  }

  /* ── Main guard logic ── */
  async function runGuard() {
    var courseId = getCourseId();
    if (!courseId) {
      // No course ID configured — don't gate (defensive: allow but warn)
      console.warn('[course-guard] No data-course-id set on <html>. Skipping guard.');
      removeOverlay();
      return;
    }

    try {
      await waitForSupabase(8000);
    } catch (e) {
      // If Supabase CDN fails to load, deny access (fail closed)
      redirectLogin();
      return;
    }

    var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    /* 1. Check session */
    var sessionRes = await sb.auth.getSession();
    var session = sessionRes.data && sessionRes.data.session;
    if (!session || !session.user) {
      redirectLogin();
      return;
    }

    var userId = session.user.id;

    /* 2. Check admin status */
    var profileRes = await sb.from('profiles').select('is_admin').eq('id', userId).single();
    if (profileRes.data && profileRes.data.is_admin === true) {
      removeOverlay();
      return; // Admins can access everything
    }

    /* 3. Check enrollment */
    var enrollRes = await sb.from('enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle();

    if (enrollRes.data) {
      removeOverlay();
      return; // Enrolled — grant access
    }

    /* 4. Not enrolled → redirect */
    redirectCatalog();
  }

  /* Kick off as soon as DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectOverlay();
      runGuard();
    });
  } else {
    injectOverlay();
    runGuard();
  }
})();
