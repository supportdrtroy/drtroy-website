# DrTroy CE Platform — Complete System Briefing for Bane

**Last updated:** 2026-02-24
**Read this ENTIRE document before making any changes. Breaking these rules has crashed the site multiple times.**

---

## WHAT THIS SITE IS

DrTroy Continuing Education (drtroy.com) is a professional continuing education platform for physical therapists (PTs) and physical therapy assistants (PTAs). It sells CE courses, handles enrollment, course access, certificates, and has a full admin dashboard.

**Tech stack:** Vanilla HTML/CSS/JS (no framework). Supabase for auth + database. Stripe for payments. Netlify for hosting + serverless functions. Resend for email.

**URL:** https://drtroy.com
**Admin:** https://drtroy.com/admin (redirects to secure-admin-access-2026.html)
**Supabase project:** pnqoxulxdmlmbywcpbyx.supabase.co

---

## COMPLETE FILE MAP

### Root Directory

| File | Purpose | Notes |
|------|---------|-------|
| `index.html` | Homepage | Waitlist form, course preview, hero section |
| `about.html` | About Dr. Troy | Bio, credentials |
| `cart.html` | Shopping cart page | Uses js/cart.js |
| `checkout.html` | Stripe checkout | Creates Stripe session via Netlify function |
| `course-catalog.html` | Course listing/catalog | Browse and filter courses |
| `courses.html` | My courses dashboard | Shows enrolled courses |
| `my-account.html` | User account page | Profile, enrollments, certificates |
| `success.html` | Post-purchase success page | After Stripe checkout |
| `admin.html` | Admin dashboard (2500+ lines) | 8 tabs, DO NOT minify |
| `secure-admin-access-2026.html` | Admin login page | Password protected admin entry |
| `system-settings.html` | Redirects to admin login | Legacy URL |
| `clear-account.html` | Account cleanup utility | |
| `download-tpta-submission.html` | TPTA submission download | Regulatory compliance |
| `admin-backup.html` | Backup of old admin panel | For reference only |
| `admin-author-management.html` | Author tracking UI | NOT integrated yet — orphaned |
| `course-management-interface.html` | Course mgmt UI fragment | NOT integrated — orphaned |
| `courses-backup.html` | Old courses page | Redirected to course-catalog.html |
| `courses-standardized.html` | Standardization test file | Redirected to course-catalog.html |
| `course-template.html` | Template for new courses | Redirected to course-catalog.html |
| `home-preview.html` | Homepage preview version | |
| `Certificate_Sample_DrTroy.html` | Sample certificate | Demo file |
| `Course_Evaluation_Sample.html` | Sample evaluation form | Demo file |

### JavaScript Files (js/)

| File | Size | Purpose | Loaded In |
|------|------|---------|-----------|
| `supabase-client.js` | ~680 lines | Supabase auth/DB wrapper. Exports `window.DrTroySupabase` and `window.SB` | 11+ HTML files |
| `admin.js` | ~1800 lines | Main admin panel logic. Loaded LAST. | admin.html only |
| `course-management.js` | ~1050 lines | Course CRUD, module/lesson editor, content management. Exports `window.CourseManagement` | admin.html only |
| `course-guard.js` | ~150 lines | Course access protection. Checks enrollment before showing content. IIFE pattern. | 20+ course pages |
| `cart.js` | ~500 lines | Shopping cart. localStorage-based. | cart.html, checkout.html, course-catalog.html |
| `database.js` | ~750 lines | IndexedDB abstraction layer. Legacy fallback. | Limited use |
| `adaptive-course-system.js` | ~550 lines | PT/PTA adaptive content. Adjusts course material by profession. | Course pages |
| `certificate-manager.js` | ~300 lines | Certificate generation. Uses msk-certificate.html template. | Certificate flow |

### CSS Files

| File | Purpose |
|------|---------|
| `css/nav.css` | Navigation styles |
| `assets/css/styles.css` | Global styles |

### Netlify Functions (netlify/functions/)

| Function | Purpose | Auth Required |
|----------|---------|---------------|
| `admin-actions.js` | Admin CRUD operations (users, profiles, waitlist, etc.) | Yes — JWT + is_admin check |
| `admin-course-management.js` | Course/module/lesson CRUD via service role key | Yes — JWT + is_admin check |
| `admin-delete-waitlist.js` | Delete waitlist entries | Yes |
| `admin-reset-password.js` | Admin password reset | Yes |
| `create-checkout.js` | Creates Stripe checkout session | No (public) |
| `issue-certificate.js` | Issue CE certificates + send email | Yes |
| `send-campaign.js` | Send marketing email campaigns | Yes |
| `send-contact.js` | Contact form handler | No (public) |
| `send-referral.js` | Referral program emails | No (public) |
| `send-waitlist-confirm.js` | Waitlist signup confirmation email | No (public) |
| `stripe-webhook.js` | Stripe payment webhook handler | Stripe signature verification |

### Course Pages (courses/)

- 29 course HTML pages in `courses/` directory
- 357 image files in `courses/images/`
- Main course: `pt-msk-001.html` and `pt-msk-001-progressive.html`
- Protected by `course-guard.js` — checks enrollment before displaying content
- `COURSE_FILE_MAP` in course-management.js maps database course IDs to static file paths

### Config Files

| File | Purpose |
|------|---------|
| `netlify.toml` | Build config, headers, CSP, redirects |
| `package.json` | Dependencies (html-minifier-terser, terser, nodemailer) |
| `supabase-config.js` | Legacy Supabase config shim |
| `build.js` | Build script — minifies to dist/ |
| `validate-site.js` | Pre-commit validation — run before every commit |
| `CLAUDE.md` | Agent instructions (you're reading the expanded version) |
| `.gitignore` | Ignores node_modules/, dist/, .DS_Store, *.log |

### Docs (docs/)

- SQL schemas, course lists, standardization docs, certificate system docs
- These are blocked from public access via netlify.toml redirects

---

## DATABASE SCHEMA (Supabase)

### Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User profiles | id, email, full_name, profession, license_number, license_state, is_admin |
| `courses` | Course catalog | id, title, slug, description, price, status, category, ce_credits, published_at |
| `enrollments` | User course enrollments | id, user_id, course_id, enrolled_at, completed_at |
| `course_progress` | Lesson completion tracking | id, user_id, course_id, lesson_id, completed_at |
| `course_modules` | Course module structure | id, course_id, title, description, order_index |
| `course_lessons` | Lessons within modules | id, module_id, title, type, content, video_url, order_index, required |
| `course_assessments` | Course assessments/quizzes | id, course_id, title, passing_score |
| `certificates` | Issued certificates | id, user_id, course_id, certificate_number, issued_at |
| `discount_codes` | Promo codes | id, code, discount_percent, max_uses, current_uses, active |
| `packages` | Course bundles | id, title, course_ids, price |
| `waitlist` | Waitlist signups | id, email, name, profession, created_at |
| `completions` | Course completions | id, user_id, course_id, completed_at |

### Row-Level Security (RLS)

- **IMPORTANT:** RLS is enabled on most tables
- Frontend (anon key) can READ courses, profiles (own), enrollments (own), progress (own)
- Frontend CANNOT write to: `course_modules`, `course_lessons`, `courses` (admin only)
- Admin writes MUST go through Netlify functions that use the service role key
- The service role key bypasses ALL RLS policies

---

## ADMIN DASHBOARD ARCHITECTURE

### The admin.html Structure

admin.html is a single-page application with 8 tabs:

1. **Dashboard** — Stats overview (users, revenue, enrollments)
2. **Users** — User management (view, search, edit profiles)
3. **Courses** — Course management (CRUD, module/lesson editor)
4. **Emails** — Email campaigns
5. **Licenses** — License verification
6. **Discount Codes** — Promo code management
7. **Credits** — CE credit tracking
8. **Waitlist** — Waitlist management

### Script Load Order (CRITICAL — DO NOT CHANGE)

```
1. Supabase CDN          — <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/...">
2. js/supabase-client.js — exports window.DrTroySupabase and window.SB
3. js/course-management.js — exports window.CourseManagement, defines escapeHtml()
4. Inline <script>       — emergency switchMainTab(), logout(), DOMContentLoaded handler
5. js/admin.js           — MUST BE LAST. Main admin logic. Uses var escapeHtml = esc
```

admin.js MUST load last because it depends on everything above it.

### Course Management Flow

1. User clicks "Courses" tab
2. `loadCourses()` calls `window.CourseManagement.loadCourses()`
3. `loadCoursesFromDatabase()` queries Supabase for courses with joined modules/lessons
4. `renderCourseList()` builds course cards with Edit/Content/Preview/Publish/Duplicate/Delete buttons
5. **Edit** opens courseModal (metadata: title, description, price, etc.)
6. **Content** opens courseContentModal (module tree + lesson editor)
7. Module/lesson CRUD goes through `courseApi()` → Netlify function (bypasses RLS)

### Modal Pattern

```javascript
// Show modal
document.getElementById('modalId').classList.add('active');

// Hide modal
document.getElementById('modalId').classList.remove('active');
```

CSS: `.modal-overlay.active { display: flex; }`

### Toast Notifications

```javascript
showAdminToast('Your message', 'success');  // green
showAdminToast('Error message', 'error');    // red
```

Defined in admin.js. From course-management.js, guard with:
```javascript
if (typeof showAdminToast === 'function') showAdminToast('...', 'success');
```

---

## BUILD & DEPLOYMENT PIPELINE

### Build Process

```bash
npm install          # Install dependencies
node build.js        # Minify and copy to dist/
# Netlify deploys from dist/
```

**build.js behavior:**
- Walks all files recursively
- Minifies .html and .js files
- Copies everything else as-is
- **EXCLUDES from minification:** admin.html, admin.js (they break when minified)
- **SKIPS entirely:** node_modules, dist, .git, build.js, package.json, validate-site.js, CLAUDE.md

### netlify.toml Configuration

- **Build command:** `node build.js`
- **Publish directory:** `dist`
- **Functions directory:** `netlify/functions`
- **Security headers:** CSP, X-Frame-Options, HSTS, Permissions-Policy
- **Cache:** 1-year cache on CSS/JS/images
- **Redirects:**
  - `/admin` → `/secure-admin-access-2026.html` (301)
  - `/account` → `/my-account.html` (301)
  - `/courses` → `/course-catalog.html` (301)
  - Backup/test files → `/course-catalog.html` (302)
  - `.md`, `.sql`, `/docs/` files → blocked (301, forced)
  - `/supabase-config.js` → blocked (301, forced)

### Validation Script

**ALWAYS run before committing:**

```bash
node validate-site.js
```

This checks:
1. JavaScript syntax in all JS files
2. Global scope const/let collisions
3. escapeHtml pattern in admin.js (must be `var`)
4. Script references in admin.html (all files exist)
5. Netlify function syntax
6. Build config exclusions (admin.html + admin.js excluded)
7. Full build test

---

## GUARDRAILS — RULES YOU MUST FOLLOW

### CRITICAL RULES (Breaking these kills the site)

#### Rule 1: NEVER use `const` or `let` for globals shared across script files

In browsers, `const`/`let` at the top level cannot coexist with a prior `function` declaration of the same name in another `<script>` block. This causes a **silent SyntaxError** that kills the entire script with NO error in the console.

```javascript
// course-management.js declares:
function escapeHtml(text) { ... }

// admin.js MUST use var, NOT const:
var escapeHtml = esc;  // CORRECT
const escapeHtml = esc; // FATAL — kills the script silently
let escapeHtml = esc;   // FATAL — same problem
```

**Any variable that might collide with a name in another JS file MUST use `var`.**

#### Rule 2: NEVER duplicate function names across JS files

All JS files share the global scope. If two files define `function foo()`, the last one loaded wins and silently replaces the first.

Before adding any function, search ALL JS files:
```bash
grep -r "function yourFunctionName" js/
```

#### Rule 3: NEVER remove or rename files without checking all references

Before deleting or renaming ANY file:
```bash
grep -r "filename" *.html js/ netlify/
```

course-management.js was once removed and it broke everything because admin.html still referenced it.

#### Rule 4: Module/lesson CRUD MUST go through the Netlify function

Supabase RLS blocks direct client writes to `course_modules` and `course_lessons`. All module/lesson operations must use the courseApi() helper:

```javascript
courseApi('POST', { resource: 'module', course_id: '...', title: '...' })
courseApi('PATCH', { resource: 'lesson', id: '...', title: '...' })
courseApi('DELETE', { resource: 'module', id: '...' })
```

This calls `/.netlify/functions/admin-course-management` which uses the service role key.

#### Rule 5: NEVER modify build.js minification exclusions

admin.html and admin.js are deliberately excluded from minification. Minification breaks onclick handlers and inline scripts.

#### Rule 6: Always bump cache busters after changing JS files

After modifying any JS file, bump the version query string in the HTML that loads it:
```html
<script src="js/admin.js?v=20260224d"></script>
                                    ^ bump this
```

#### Rule 7: NEVER change the script load order in admin.html

The order is: Supabase CDN → supabase-client.js → course-management.js → inline script → admin.js (LAST). Changing this order breaks everything.

#### Rule 8: NEVER add course management functions back to admin.js

All course CRUD is in course-management.js. admin.js previously had duplicate functions that caused a massive conflict (overriding the newer ones). This was fixed — DO NOT re-add course functions to admin.js.

### IMPORTANT RULES (Breaking these causes bugs)

#### Rule 9: Netlify functions must return CORS headers

All Netlify functions must include:
```javascript
const headers = {
    'Access-Control-Allow-Origin': origin,  // from ALLOWED_ORIGINS
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Content-Type': 'application/json'
};
```

And handle OPTIONS preflight:
```javascript
if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
}
```

#### Rule 10: Admin functions must verify JWT + is_admin

All admin Netlify functions must:
1. Extract Bearer token from Authorization header
2. Verify the token is valid via Supabase auth
3. Check that the user has `is_admin = true` in the profiles table
4. Return 403 if any check fails

#### Rule 11: Use showAdminToast() for user feedback

Don't use alert() or console.log() for user-facing messages. Use:
```javascript
showAdminToast('Message', 'success');  // or 'error'
```

#### Rule 12: Supabase reads use anon key; writes use service role

- Frontend reads: `window.DrTroySupabase.getClient()` (anon key, RLS applies)
- Admin writes: Call Netlify functions or use `SB.adminAction()` (service role key, bypasses RLS)

---

## WHAT CHANGED RECENTLY (Commits History)

### Session 1: Admin Panel Was Broken (Loading Forever)
**Problem:** Admin panel showed loading screen forever.
**Root causes found and fixed:**
1. `const escapeHtml` collision between course-management.js and admin.js → Changed to `var`
2. Inline script in admin.html wasn't executing → Moved to external admin.js
3. admin.html minification broke onclick handlers → Excluded from build
4. Missing HTML sections for tabs (emails, licenses, discount codes, credits) → Added

**Commits:** `5ca580a` through `58d24de`

### Session 2: Course Content Management Was Broken
**Problem:** Courses tab showed simplified cards, couldn't edit content, View went to client view.
**Root cause:** admin.js (loaded last) had its own `renderCourseList`, `editCourse`, `saveCourse`, `closeCourseModal` that overrode the better versions in course-management.js.
**Fix:** Removed all duplicate course functions from admin.js. Rewrote course-management.js with full CRUD for courses, modules, and lessons.

**Commits:** `742d22b`, `9ed5f0b`

### Session 3: RLS Blocking Module Creation
**Problem:** "Error adding module: new row violates row-level security policy for table course_modules"
**Fix:** Added module/lesson CRUD routes to admin-course-management.js Netlify function. Updated course-management.js to route through courseApi() helper.

**Commit:** `9ed5f0b`

### Troy's Changes (Before Fixes)
Troy (via Bane/OpenClaw) made these changes that caused issues:
- `242455f` — Removed course-management.js script tag (broke courses tab)
- `61df635` — Added author tracking system (admin-author-management.html — orphaned, not integrated)
- `0a8f865` — Added course management system (course-management-interface.html — orphaned)
- `2dd3113` — Security audit that re-added hardcoded keys as fallbacks
- `fd327a6` — Added fallback credentials (hardcoded service role keys)

---

## KNOWN ISSUES (Not Yet Fixed)

### Orphaned Files
- `admin-author-management.html` — Author tracking UI exists but is NOT loaded in admin.html. All its JavaScript functions are undefined. This was created in commit `61df635` but never integrated.
- `course-management-interface.html` — Course management UI fragment. NOT loaded anywhere. Created in commit `0a8f865` but never integrated.

### Hardcoded API Keys (Security)
Multiple Netlify functions have hardcoded service role keys and Resend API keys as fallbacks. These should be removed and replaced with proper env-var-only access:
- `admin-course-management.js` line 10
- `admin-delete-waitlist.js` line 56
- `admin-reset-password.js` line 9
- `issue-certificate.js` lines 9-10
- `send-campaign.js` lines 10-11
- `send-waitlist-confirm.js` lines 20-21

**The fix:** Change from `process.env.KEY || 'hardcoded'` to just `process.env.KEY` with a check that throws if missing.

### Missing CORS Headers
These functions are missing CORS headers (may fail when called from drtroy.com):
- `create-checkout.js`
- `send-contact.js`
- `send-referral.js`

### Outdated Reference
`send-referral.js` line 94 still says "Lubbock, Texas" — should be just "Texas".

### TODO in Code
`course-management.js` line 231: `completions: 0 // TODO: Implement from user progress data`

---

## HOW TO MAKE SAFE CHANGES

### Before Starting Any Change

1. **Pull latest code:** `git pull origin main`
2. **Read this document** and CLAUDE.md
3. **Understand what you're changing** — read the files first
4. **Search for dependencies** before modifying anything:
   ```bash
   grep -r "functionName" *.html js/ netlify/
   grep -r "filename" *.html js/ netlify/
   ```

### While Making Changes

1. **One logical change at a time** — don't combine unrelated changes
2. **Don't add features unless asked** — only fix what's requested
3. **Don't refactor surrounding code** — a bug fix doesn't need code cleanup
4. **Don't add comments, docstrings, or type annotations** to code you didn't change
5. **Test in admin.html** — open browser console, check for errors
6. **Use `var` not `const`/`let`** for any top-level variables in JS files loaded in admin.html

### Before Committing

1. **Run validation:** `node validate-site.js`
2. **Run syntax checks:**
   ```bash
   node -c js/admin.js
   node -c js/course-management.js
   ```
3. **Run build:** `node build.js`
4. **Check for collisions:** No new const/let that duplicate names across files
5. **Check references:** No removed files still referenced in HTML
6. **Bump cache busters** on any changed JS files

### After Committing

1. **Push:** `git push origin main`
2. **Wait for Netlify deploy** (automatic)
3. **Test on live site** — open admin panel, check all tabs work

---

## COMMON MISTAKES TO AVOID

| Mistake | Why It Breaks | What Happened |
|---------|---------------|---------------|
| Using `const` for a global shared across files | Silent SyntaxError kills entire script | Admin panel showed blank white page |
| Removing course-management.js from admin.html | CourseManagement becomes undefined | Courses tab completely broken |
| Adding course functions to admin.js | Overrides course-management.js versions | Wrong course cards rendered, edit broken |
| Direct Supabase writes to course_modules | RLS blocks the write | "row violates row-level security policy" error |
| Minifying admin.html or admin.js | Breaks onclick handlers and global refs | Admin panel fails on deploy |
| Not bumping cache busters | Browser loads old cached JS | Changes don't appear on site |
| Adding hardcoded API keys as fallbacks | Keys exposed in public repo | Security vulnerability |
| Not handling OPTIONS preflight in functions | CORS errors from browser | Functions fail when called from frontend |

---

## QUICK REFERENCE — Key Patterns

### Creating a New Netlify Function

```javascript
const ALLOWED_ORIGINS = ['https://drtroy.com', 'https://www.drtroy.com'];

exports.handler = async (event) => {
    const origin = event.headers.origin || event.headers.Origin || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    const headers = {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    try {
        // Your logic here
        return { statusCode: 200, headers, body: JSON.stringify({ data: result }) };
    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
```

### Adding a Function to course-management.js

```javascript
// 1. Define the function
async function myNewFunction(param) {
    // Use courseApi() for module/lesson writes
    var result = await courseApi('POST', { resource: 'module', ... });

    // Use toast for feedback
    if (typeof showAdminToast === 'function') showAdminToast('Done!', 'success');
}

// 2. Add to exports at bottom
window.CourseManagement = {
    // ... existing exports ...
    myNewFunction: myNewFunction,
};
```

### Reading Data from Supabase (Frontend)

```javascript
var sb = window.DrTroySupabase.getClient();
var { data, error } = await sb.from('courses').select('*').eq('status', 'published');
```

### Admin Write Operation

```javascript
// Via admin-actions Netlify function:
var result = await SB.adminAction('update-profile', { userId: '...', data: { ... } });

// Via courseApi for course/module/lesson:
var result = await courseApi('PATCH', { resource: 'course', id: '...', title: '...' });
```

---

## ENVIRONMENT VARIABLES (Netlify)

These MUST be set in Netlify dashboard (Site settings > Environment variables):

| Variable | Used By | Notes |
|----------|---------|-------|
| `SUPABASE_URL` | All functions | https://pnqoxulxdmlmbywcpbyx.supabase.co |
| `SUPABASE_SERVICE_ROLE_KEY` | All admin functions | SECRET — never expose in frontend code |
| `STRIPE_SECRET_KEY` | create-checkout.js | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook.js | Webhook signature verification |
| `RESEND_API_KEY` | Email functions | Resend email service key |
| `EMAIL_FROM` | Email functions | From address for emails |

**The anon key is public and safe in frontend code. The service role key is SECRET and must ONLY exist in Netlify environment variables.**

---

## SUMMARY

This is a vanilla HTML/CSS/JS site with no framework. The admin panel is the most complex part — it loads multiple JS files that share the global scope. The #1 cause of bugs has been variable/function name collisions between those files. Always use `var` for shared globals, never duplicate function names, and always run `node validate-site.js` before committing. When in doubt, don't change it — ask first.
