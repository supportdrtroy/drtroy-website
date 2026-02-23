# DrTroy CE Platform — Agent Instructions

Read this ENTIRE file before making any changes. Violations of these rules have broken the site before.

## Architecture Overview

Static site deployed on **Netlify**. Build: `node build.js` → outputs to `dist/`. Supabase for auth/database. Stripe for payments. No framework — vanilla HTML/CSS/JS.

### File Structure

```
admin.html              → Admin dashboard (DO NOT minify)
js/admin.js             → Admin panel logic (DO NOT minify)
js/course-management.js → Course CRUD, content editor
js/supabase-client.js   → Supabase wrapper, exports window.DrTroySupabase / window.SB
js/course-guard.js      → Auth guard for course pages
js/cart.js              → Shopping cart (used by course-catalog.html)
netlify/functions/      → Serverless functions (service role key, bypasses RLS)
courses/                → Static HTML course files + images
```

### Script Load Order in admin.html (CRITICAL)

```
1. Supabase CDN (head)
2. js/supabase-client.js (head)     → exports window.DrTroySupabase
3. js/course-management.js (head)   → defines escapeHtml(), exports window.CourseManagement
4. Inline <script> (head)           → emergency switchMainTab(), logout()
5. js/admin.js (body, LAST)         → main admin logic, uses var escapeHtml = esc
```

**Never change this load order.** admin.js MUST load last.

---

## CRITICAL RULES — Breaking these will silently kill the admin panel

### 1. NEVER use `const` or `let` for globals shared across script files

In browsers, `const`/`let` at the top level cannot coexist with a prior `function` declaration of the same name in another `<script>` block. This causes a **silent SyntaxError** that kills the entire script with NO error in the console.

```javascript
// course-management.js declares:
function escapeHtml(text) { ... }

// admin.js MUST use var, NOT const:
var escapeHtml = esc;  // ✅ CORRECT — var allows reassignment
const escapeHtml = esc; // ❌ FATAL — SyntaxError kills entire script silently
let escapeHtml = esc;   // ❌ FATAL — same problem
```

**Rule:** Any variable that might collide with a name in another JS file MUST use `var`, never `const`/`let`.

### 2. NEVER duplicate function names across JS files

All JS files share the global scope. If two files define `function foo()`, the last one loaded wins and silently replaces the first. This has caused major bugs.

Before adding any new function, **search all JS files** for the name:
```bash
grep -r "function yourFunctionName" js/
```

### 3. NEVER remove or rename files without checking all references

Before deleting or renaming ANY file, search for references:
```bash
grep -r "filename" *.html js/ netlify/
```

Course-management.js was once removed and it broke everything because admin.html still loaded it.

### 4. Module/lesson operations MUST go through the Netlify function

Supabase RLS blocks direct client writes to `course_modules` and `course_lessons`. All module/lesson CRUD must use:

```javascript
courseApi('POST', { resource: 'module', course_id: '...', title: '...' })
courseApi('PATCH', { resource: 'lesson', id: '...', title: '...' })
courseApi('DELETE', { resource: 'module', id: '...' })
```

This calls `/.netlify/functions/admin-course-management` which uses the service role key.

### 5. NEVER modify build.js minification exclusions

`admin.html` and `admin.js` are deliberately excluded from minification. Do not change this. Minification breaks onclick handlers and inline scripts.

### 6. Always bump cache busters after changing JS files

After modifying any JS file referenced in HTML, bump the version query string:
```html
<script src="js/admin.js?v=20260224d"></script>
                                    ^ bump this
```

---

## IMPORTANT RULES

### HTML Patterns
- Modals use `.modal-overlay` class. Show: `classList.add('active')`. Hide: `classList.remove('active')`.
- Tab content uses `id="tabname"` with `class="tab-content"`.
- Form inputs use `class="form-input"`.

### Supabase Patterns
- Client-side read operations: use `window.DrTroySupabase.getClient()` directly
- Admin write operations: use `SB.adminAction(action, payload)` or call Netlify functions
- The anon key is public. The service role key is ONLY in Netlify function env vars.

### Netlify Functions
- All functions must return CORS headers matching `ALLOWED_ORIGINS`
- Must handle OPTIONS preflight requests
- Use `process.env.SUPABASE_SERVICE_ROLE_KEY` for privileged operations

### Toast Notifications
```javascript
showAdminToast('Message', 'success');  // or 'error'
```
This is defined in admin.js. If calling from course-management.js, guard with:
```javascript
if (typeof showAdminToast === 'function') showAdminToast('...', 'success');
```

---

## Before Committing — Validation Checklist

Run the validation script:
```bash
node validate-site.js
```

Manual checks:
1. `node -c js/admin.js` — syntax check
2. `node -c js/course-management.js` — syntax check
3. `node build.js` — full build passes
4. No new `const`/`let` declarations that duplicate names across files
5. No removed files that are still referenced in HTML
6. Cache busters bumped on changed JS files

---

## File-Specific Notes

### admin.html (~2500 lines)
- Contains ALL admin dashboard HTML, CSS, and inline emergency scripts
- 8 tabs: dashboard, users, courses, emails, licenses, discount-codes, credits, waitlist
- Two course modals: `courseModal` (metadata editing) and `courseContentModal` (content editor)

### js/admin.js (~1800 lines)
- Main admin logic. Loaded LAST in body tag.
- `esc()` / `var escapeHtml` at top — DO NOT change to const/let
- `SB = window.DrTroySupabase` alias at top
- Course management is delegated to course-management.js (do not re-add course functions here)

### js/course-management.js (~1050 lines)
- All course CRUD, module/lesson editing, content editor
- Exports `window.CourseManagement` object
- Uses `courseApi()` helper to call Netlify function for module/lesson ops
- `escapeHtml()` defined here — also aliased in admin.js (see Rule #1)

### js/supabase-client.js (~680 lines)
- Supabase client wrapper
- Exports to `window.DrTroySupabase` and `window.SB`
- Contains ALL admin helper functions (adminCreateCourse, adminAction, etc.)

### netlify.toml
- Build: `node build.js`, publish: `dist/`
- `/admin` redirects to `secure-admin-access-2026.html`
- CSP headers: `script-src 'self' 'unsafe-inline'` + CDN domains
- Blocks access to .md, .sql, /docs/ files via redirects

### courses/ directory
- Static HTML files: `{course-id}-progressive.html`
- `COURSE_FILE_MAP` in course-management.js maps DB IDs to filenames
- Images in `courses/images/`
- Protected by `course-guard.js` (enrollment check)
