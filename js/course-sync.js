/**
 * DrTroy CE Platform — Course Progress Sync
 * Auto-syncs course progress to Supabase whenever localStorage is updated.
 * Include this script in course content pages.
 */
(function() {
  'use strict';

  const SUPA_URL = 'https://pnqoxulxdmlmbywcpbyx.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucW94dWx4ZG1sbWJ5d2NwYnl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNjU3NTIsImV4cCI6MjA4Njk0MTc1Mn0.YEPrwIvINX_Q1AsbxyU0T5m5oxpV9M756yiSCzy6LTc';

  // Map localStorage keys to Supabase course IDs and module counts
  const PROGRESS_KEY_MAP = {
    'pt-msk-001-progress': { courseId: 'pt-msk-001', totalModules: 12 },
    'balanceGaitProgress': { courseId: 'core-balance-001', totalModules: 12 },
    'documentationProgress': { courseId: 'core-doc-001', totalModules: 12 },
    'geriatricCareProgress': { courseId: 'core-geriatric-001', totalModules: 12 },
    'healthTechExpandedProgress': { courseId: 'core-tech-001', totalModules: 10 },
    'infectionControlProgress': { courseId: 'core-infection-001', totalModules: 12 },
    'jointReplacementProgress': { courseId: 'core-joint-001', totalModules: 12 },
    'mobility-fall-001-progress': { courseId: 'core-mobility-001', totalModules: 12 },
    'otAdlProgress': { courseId: 'ot-adl-001', totalModules: 12 },
    'patientEducationProgress': { courseId: 'core-education-001', totalModules: 12 },
    'physicalAgentsProgress': { courseId: 'core-agents-001', totalModules: 12 },
    'postSurgicalProgress': { courseId: 'core-postsurg-001', totalModules: 12 },
    'neuroRehabProgress': { courseId: 'core-neuro-001', totalModules: 12 },
  };

  // Debounce sync to avoid flooding
  let syncTimer = null;
  let pendingSync = null;

  function getUserJwt() {
    try {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.includes('auth-token') || k.includes('supabase')) {
          try {
            const stored = JSON.parse(localStorage.getItem(k) || '{}');
            const token = stored?.access_token || stored?.currentSession?.access_token || stored?.session?.access_token;
            if (token && token.split('.').length === 3) return token;
          } catch { /* skip non-JSON */ }
        }
      }
    } catch(e) { /* ignore */ }
    return null;
  }

  function extractProgress(key, value) {
    const mapping = PROGRESS_KEY_MAP[key];
    if (!mapping) return null;

    let data;
    try { data = JSON.parse(value); } catch { return null; }

    // Different course pages store progress differently. Normalize:
    let completedCount = 0;
    let totalModules = mapping.totalModules;
    let timeSpent = 0;

    // Common patterns:
    if (Array.isArray(data.completedModules)) {
      completedCount = data.completedModules.length;
    } else if (Array.isArray(data.modulesCompleted)) {
      completedCount = data.modulesCompleted.length;
    } else if (typeof data.completed === 'object') {
      completedCount = Object.values(data.completed).filter(Boolean).length;
    } else if (typeof data.modulesCompleted === 'number') {
      completedCount = data.modulesCompleted;
    }

    if (data.totalModules) totalModules = data.totalModules;
    if (data.timeSpent) timeSpent = typeof data.timeSpent === 'number' ? data.timeSpent * 60 : 0; // minutes to seconds

    const progressPercent = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

    return {
      courseId: mapping.courseId,
      progressPercent,
      modulesCompleted: completedCount,
      timeSpentSeconds: timeSpent,
    };
  }

  async function doSync(syncData) {
    const jwt = getUserJwt();
    if (!jwt) return;

    try {
      const endpoint = syncData.progressPercent >= 100
        ? '/.netlify/functions/complete-course'
        : '/.netlify/functions/update-progress';

      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify(syncData)
      });
      console.log(`✅ Progress synced: ${syncData.courseId} @ ${syncData.progressPercent}%`);
    } catch(e) {
      console.warn('Sync failed:', e.message);
    }
  }

  // Intercept localStorage.setItem to auto-sync
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    originalSetItem(key, value);

    // Check if this is a course progress key
    if (PROGRESS_KEY_MAP[key]) {
      const syncData = extractProgress(key, value);
      if (syncData) {
        pendingSync = syncData;
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
          if (pendingSync) {
            doSync(pendingSync);
            pendingSync = null;
          }
        }, 3000); // Debounce 3 seconds
      }
    }
  };

  // Load progress from Supabase on page load (merge with localStorage)
  async function loadFromSupabase() {
    const jwt = getUserJwt();
    if (!jwt) return;

    // Determine which course this page is for
    const currentPath = window.location.pathname;
    let matchedKey = null;
    let matchedMapping = null;

    for (const [key, mapping] of Object.entries(PROGRESS_KEY_MAP)) {
      // Check if localStorage has this key (indicates this page uses it)
      if (localStorage.getItem(key) !== null) {
        matchedKey = key;
        matchedMapping = mapping;
        break;
      }
    }

    if (!matchedMapping) return;

    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      const userId = payload.sub;
      if (!userId) return;

      const res = await fetch(
        `${SUPA_URL}/rest/v1/course_progress?user_id=eq.${userId}&course_id=eq.${encodeURIComponent(matchedMapping.courseId)}&limit=1`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return;

      const serverProgress = data[0];
      const localRaw = localStorage.getItem(matchedKey);
      const localData = localRaw ? JSON.parse(localRaw) : null;
      const localProgress = localData ? extractProgress(matchedKey, localRaw) : null;

      // If server has more progress than local, log it (user can refresh)
      if (localProgress && serverProgress.progress_percent > localProgress.progressPercent) {
        console.log(`📡 Server has more progress (${serverProgress.progress_percent}%) than local (${localProgress.progressPercent}%). Server progress will be used on next full load.`);
      }
    } catch(e) {
      console.warn('Failed to check server progress:', e.message);
    }
  }

  // Expose API for direct calls from course pages
  window.DrTroyCourseSync = {
    syncProgress: function(courseId, progressPercent, modulesCompleted, timeSpentSeconds) {
      doSync({ courseId, progressPercent, modulesCompleted, timeSpentSeconds });
    },
    completeCourse: function(courseId, timeSpentSeconds, modulesCompleted) {
      return doSync({ courseId, progressPercent: 100, modulesCompleted, timeSpentSeconds });
    },
    loadProgress: loadFromSupabase,
    getUserJwt
  };

  // Auto-check server progress on load
  setTimeout(loadFromSupabase, 2000);
})();
