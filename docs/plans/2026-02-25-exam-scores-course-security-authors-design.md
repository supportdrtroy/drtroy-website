# Design: Exam Scores, Course Security, Author Management

Date: 2026-02-25

## 1. Exam Scores to Database

**Problem:** Quiz scores are calculated client-side and saved only to localStorage. The `course_progress.quiz_score` column exists but is never populated.

**Solution:**
- New Netlify function `submit-exam-results.js` accepts course_id, quiz_score, passing_score, and answers. Validates auth token, writes to `course_progress`.
- Update `update-progress.js` to accept optional quiz_score field.
- Update quiz HTML files to POST scores to the new endpoint after calculation.
- Add Quiz Score column to admin user/course progress views.

**Data flow:** Quiz page -> submit-exam-results -> course_progress row -> admin dashboard

## 2. Course Security via Edge Function

**Problem:** Course HTML files are static and publicly accessible. course-guard.js is client-side only and bypassable.

**Solution:**
- New Edge Function `netlify/edge-functions/course-auth.js` intercepts `/courses/*.html` requests.
- Reads Supabase auth token from cookie, verifies with Supabase, checks enrollment.
- Returns 302 redirect to `/my-account.html?login=required` if unauthorized.
- Admins pass through via is_admin check.
- Update netlify.toml to register edge function for /courses/* path.
- Keep course-guard.js as secondary client-side layer.

## 3. Author Management Admin Tab

**Problem:** DB tables (authors, course_authors, author_sales) exist and Stripe webhook tracks sales, but no admin UI to manage authors or assign them to courses.

**Solution:**
- New 9th tab "Authors" in admin.html with:
  - Stats cards (total authors, revenue, pending payouts)
  - Authors table with CRUD (add/edit/remove)
  - Course assignment with per-course revenue share %
  - Sales analytics per author
- New Netlify function `admin-author-management.js` for CRUD + analytics queries.
- Follows existing admin patterns (modals, tables, toasts, SB.adminAction).
