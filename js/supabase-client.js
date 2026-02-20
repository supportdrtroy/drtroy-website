/**
 * DrTroy CE Platform — Supabase Client
 * Initializes Supabase and exports all auth + data helpers.
 * Uses Supabase JS v2 via CDN (no npm).
 *
 * ANON KEY ONLY — never expose service role key in frontend.
 */

const SUPABASE_URL = 'https://pnqoxulxdmlmbywcpbyx.supabase.co';
const SUPABASE_ANON_KEY = 'process.env.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'';

// Initialize Supabase client (requires CDN script to be loaded first)
let _supabase = null;

function getSupabaseClient() {
    if (_supabase) return _supabase;
    if (typeof window !== 'undefined' && window.supabase) {
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        return _supabase;
    }
    console.error('Supabase CDN not loaded yet.');
    return null;
}

/* ─── AUTH HELPERS ─────────────────────────────────────────────────────────── */

async function signUp(email, password, metadata = {}) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };

    const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: metadata }
    });

    if (data?.user && !error) {
        // Create profile row (trigger may already do this, but we ensure it exists)
        await sb.from('profiles').upsert({
            id: data.user.id,
            email: email,
            first_name: metadata.first_name || '',
            last_name: metadata.last_name || '',
            profession: metadata.profession || '',
            license_number: metadata.license_number || '',
            license_state: metadata.state || ''
        }, { onConflict: 'id' });
    }

    return { data, error };
}

async function signIn(email, password) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };
    const result = await sb.auth.signInWithPassword({ email, password });
    if (result.data?.session) resetSessionTimeout();
    return result;
}

async function signOut() {
    const sb = getSupabaseClient();
    if (!sb) return;
    clearSessionTimeout();
    await sb.auth.signOut();
}

/* ─── SESSION TIMEOUT (2 hours inactivity) ──────────────────────────────── */
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
let _sessionTimer = null;

function resetSessionTimeout() {
    if (_sessionTimer) clearTimeout(_sessionTimer);
    _sessionTimer = setTimeout(async () => {
        console.log('[session] Auto-logout due to inactivity');
        await signOut();
        if (typeof window !== 'undefined') {
            window.location.href = '/my-account.html?expired=1';
        }
    }, SESSION_TIMEOUT_MS);
}

function clearSessionTimeout() {
    if (_sessionTimer) { clearTimeout(_sessionTimer); _sessionTimer = null; }
}

// Start monitoring on load
if (typeof window !== 'undefined') {
    ['click', 'keydown', 'scroll', 'mousemove'].forEach(evt => {
        document.addEventListener(evt, () => {
            if (_sessionTimer) resetSessionTimeout();
        }, { passive: true });
    });
}

async function getUser() {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { data: { user } } = await sb.auth.getUser();
    return user;
}

async function getSession() {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { data: { session } } = await sb.auth.getSession();
    return session;
}

async function resetPassword(email) {
    const sb = getSupabaseClient();
    if (!sb) return { error: { message: 'Database unavailable' } };
    return await sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/my-account.html'
    });
}

async function updatePassword(newPassword) {
    const sb = getSupabaseClient();
    if (!sb) return { error: { message: 'Database unavailable' } };
    return await sb.auth.updateUser({ password: newPassword });
}

/* ─── PROFILE HELPERS ───────────────────────────────────────────────────────── */

async function getProfile(userId) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };
    return await sb.from('profiles').select('*').eq('id', userId).single();
}

async function updateProfile(userId, updates) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };
    return await sb.from('profiles').update(updates).eq('id', userId).select().single();
}

async function isAdmin(userId) {
    const sb = getSupabaseClient();
    if (!sb) return false;
    const { data } = await sb.from('profiles').select('is_admin').eq('id', userId).single();
    return data?.is_admin === true;
}

/* ─── COURSE HELPERS ────────────────────────────────────────────────────────── */

async function getCourses() {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };
    return await sb.from('courses')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
}

async function getCourseById(courseId) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };
    return await sb.from('courses').select('*').eq('id', courseId).single();
}

async function getPackages() {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };
    return await sb.from('packages')
        .select('*')
        .eq('is_active', true)
        .order('price_cents', { ascending: true });
}

/* ─── ENROLLMENT HELPERS ────────────────────────────────────────────────────── */

async function getEnrollments(userId) {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };

    // Join enrollments with courses and course_progress
    const { data, error } = await sb.from('enrollments')
        .select(`
            *,
            courses (
                id, title, description, ceu_hours, professions
            ),
            course_progress (
                id, status, progress_percent, completed_at
            )
        `)
        .eq('user_id', userId)
        .order('purchased_at', { ascending: false });

    return { data: data || [], error };
}

async function createEnrollment(enrollmentData) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };

    const { data, error } = await sb.from('enrollments')
        .insert(enrollmentData)
        .select()
        .single();

    return { data, error };
}

async function isEnrolled(userId, courseId) {
    const sb = getSupabaseClient();
    if (!sb) return false;
    const { data } = await sb.from('enrollments')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();
    return !!data;
}

/* ─── COURSE PROGRESS HELPERS ───────────────────────────────────────────────── */

async function getCourseProgress(userId) {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };

    return await sb.from('course_progress')
        .select('*, courses(title, ceu_hours)')
        .eq('user_id', userId);
}

async function createProgressRow(progressData) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };

    return await sb.from('course_progress')
        .insert(progressData)
        .select()
        .single();
}

async function updateProgress(userId, courseId, updates) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };

    return await sb.from('course_progress')
        .update(updates)
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .select()
        .single();
}

/* ─── CERTIFICATE HELPERS ───────────────────────────────────────────────────── */

async function getCertificates(userId) {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };

    return await sb.from('certificates')
        .select('*, courses(title, ceu_hours)')
        .eq('user_id', userId)
        .order('issued_at', { ascending: false });
}

async function issueCertificate(certData) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };

    // Generate certificate number if not provided
    if (!certData.certificate_number) {
        certData.certificate_number = `DRTROY-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    }

    return await sb.from('certificates')
        .insert(certData)
        .select()
        .single();
}

/* ─── DISCOUNT CODE HELPERS ─────────────────────────────────────────────────── */

async function validateDiscountCode(code, profession) {
    // SECURITY: Validate via server-side function (no direct DB access to discount_codes)
    try {
        const resp = await fetch('/.netlify/functions/validate-discount', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const result = await resp.json();
        if (!result || !result.valid) {
            return { data: null, error: { message: 'Invalid discount code' } };
        }
        return { data: result, error: null };
    } catch (err) {
        return { data: null, error: { message: 'Could not validate code. Please try again.' } };
    }
}

/* ─── ADMIN HELPERS ─────────────────────────────────────────────────────────── */

async function getAllUsers() {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };
    return await sb.from('profiles').select('*').order('created_at', { ascending: false });
}

async function getAllEnrollments() {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };
    return await sb.from('enrollments')
        .select('*, profiles(first_name, last_name, email), courses(title, ceu_hours)')
        .order('purchased_at', { ascending: false });
}

async function getRevenueSummary() {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };
    return await sb.from('enrollments')
        .select('amount_paid_cents, purchased_at, courses(title)')
        .order('purchased_at', { ascending: false });
}

async function getCourseCompletionStats() {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };
    return await sb.from('completions')
        .select('*, courses(title, ceu_hours)')
        .order('completed_at', { ascending: false });
}

/* ─── ADMIN ACTION HELPERS ──────────────────────────────────────────────────── */

/**
 * Call a privileged admin action via the admin-actions Netlify function.
 * Automatically attaches the current user's JWT for server-side auth.
 */
async function adminAction(action, payload) {
    const sb = getSupabaseClient();
    if (!sb) return { error: 'Database unavailable' };
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { error: 'Not authenticated' };

    try {
        const resp = await fetch('/.netlify/functions/admin-actions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + session.access_token
            },
            body: JSON.stringify({ action, payload })
        });
        const json = await resp.json();
        if (!resp.ok) return { error: json.error || `HTTP ${resp.status}` };
        return json;
    } catch (err) {
        return { error: err.message };
    }
}

async function adminGetUserByEmail(email) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: 'Database unavailable' };
    return await sb.from('profiles').select('*').eq('email', email).single();
}

async function adminGetUserEnrollments(userId) {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: 'Database unavailable' };
    return await sb.from('enrollments')
        .select('*, courses(id, title, ceu_hours)')
        .eq('user_id', userId)
        .order('purchased_at', { ascending: false });
}

async function adminGetAllCourses() {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: 'Database unavailable' };
    return await sb.from('courses')
        .select('*')
        .order('sort_order', { ascending: true });
}

/* ─── COURSE MANAGEMENT (Admin CRUD) ───────────────────────────────────────── */

async function adminCreateCourse(courseData) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };
    return await sb.from('courses').insert(courseData).select().single();
}

async function adminUpdateCourse(courseId, updates) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };
    return await sb.from('courses').update(updates).eq('id', courseId).select().single();
}

async function adminToggleCourseActive(courseId, isActive) {
    return adminUpdateCourse(courseId, { is_active: isActive });
}

/* ─── DISCOUNT CODE MANAGEMENT (Admin) ─────────────────────────────────────── */

async function adminGetDiscountCodes() {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };
    return await sb.from('discount_codes').select('*').order('created_at', { ascending: false });
}

async function adminCreateDiscountCode(codeData) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };
    return await sb.from('discount_codes').insert(codeData).select().single();
}

async function adminUpdateDiscountCode(codeId, updates) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };
    return await sb.from('discount_codes').update(updates).eq('id', codeId).select().single();
}

async function adminDeleteDiscountCode(codeId) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };
    return await sb.from('discount_codes').delete().eq('id', codeId);
}

/* ─── LICENSE TRACKING (Admin) ──────────────────────────────────────────────── */

async function adminGetExpiringLicenses(withinDays = 90) {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    return await sb.from('profiles')
        .select('*')
        .not('license_expiry_date', 'is', null)
        .lte('license_expiry_date', cutoff.toISOString().split('T')[0])
        .order('license_expiry_date', { ascending: true });
}

async function adminUpdateLicenseExpiry(userId, expiryDate) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };
    return await sb.from('profiles').update({ license_expiry_date: expiryDate }).eq('id', userId).select().single();
}

/* ─── CERTIFICATE MANAGEMENT (Admin) ───────────────────────────────────────── */

async function adminGetUserCertificates(userId) {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };
    return await sb.from('certificates')
        .select('*')
        .eq('user_id', userId)
        .order('issued_at', { ascending: false });
}

async function adminGetUserCompletions(userId) {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };
    return await sb.from('completions')
        .select('*, courses(title, ceu_hours)')
        .eq('user_id', userId)
        .eq('passed', true)
        .order('completed_at', { ascending: false });
}

/* ─── CAMPAIGN / PASSWORD RESET / CERTIFICATE (via Netlify functions) ──────── */

async function adminSendCampaign(subject, htmlBody, filters = {}, countOnly = false) {
    const sb = getSupabaseClient();
    if (!sb) return { error: 'Database unavailable' };
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { error: 'Not authenticated' };
    try {
        const resp = await fetch('/.netlify/functions/send-campaign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
            body: JSON.stringify({ action: countOnly ? 'count' : 'send', subject, htmlBody, filters })
        });
        return await resp.json();
    } catch (err) { return { error: err.message }; }
}

async function adminResetPassword(email) {
    const sb = getSupabaseClient();
    if (!sb) return { error: 'Database unavailable' };
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { error: 'Not authenticated' };
    try {
        const resp = await fetch('/.netlify/functions/admin-reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
            body: JSON.stringify({ email })
        });
        return await resp.json();
    } catch (err) { return { error: err.message }; }
}

async function adminIssueCertificate(params) {
    const sb = getSupabaseClient();
    if (!sb) return { error: 'Database unavailable' };
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { error: 'Not authenticated' };
    try {
        const resp = await fetch('/.netlify/functions/issue-certificate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
            body: JSON.stringify(params)
        });
        return await resp.json();
    } catch (err) { return { error: err.message }; }
}

function adminExportUsersCSV(users) {
    const headers = ['Email', 'First Name', 'Last Name', 'Profession', 'License #', 'State', 'Admin', 'Created'];
    const rows = users.map(u => [
        u.email,
        u.first_name,
        u.last_name,
        u.profession,
        u.license_number,
        u.license_state,
        u.is_admin ? 'Yes' : 'No',
        u.created_at ? new Date(u.created_at).toLocaleDateString() : ''
    ]);
    const csv = [headers, ...rows]
        .map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drtroy-users.csv';
    a.click();
    URL.revokeObjectURL(url);
}

/* ─── AUTH STATE LISTENER ───────────────────────────────────────────────────── */

function onAuthStateChange(callback) {
    const sb = getSupabaseClient();
    if (!sb) return () => {};

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
        // Fire custom DOM event so any page can listen
        document.dispatchEvent(new CustomEvent('supabase:authchange', {
            detail: { event, session, user: session?.user || null }
        }));
        if (typeof callback === 'function') callback(event, session);
    });

    return () => subscription.unsubscribe();
}

/* ─── ENROLLMENT FLOW (post-purchase) ──────────────────────────────────────── */

/**
 * After a successful payment, call this to create all necessary DB records.
 * Works for both single courses and packages.
 */
async function processSuccessfulPurchase({ userId, courseIds, packageId, paymentId, amountPaidCents }) {
    const sb = getSupabaseClient();
    if (!sb) return { success: false, error: 'Database unavailable' };

    const errors = [];
    const createdEnrollments = [];

    for (const courseId of courseIds) {
        // Check if already enrolled
        const alreadyIn = await isEnrolled(userId, courseId);
        if (alreadyIn) continue;

        // Create enrollment
        const { data: enrollment, error: enrollErr } = await createEnrollment({
            user_id: userId,
            course_id: courseId,
            stripe_payment_intent_id: paymentId || null,
            amount_paid_cents: amountPaidCents || 0,
            purchased_at: new Date().toISOString(),
            is_active: true
        });

        if (enrollErr) {
            errors.push(`Enrollment error for ${courseId}: ${enrollErr.message}`);
            continue;
        }

        createdEnrollments.push(enrollment);

        // Create course_progress row
        await createProgressRow({
            user_id: userId,
            course_id: courseId,
            enrollment_id: enrollment.id,
            status: 'not_started',
            progress_percent: 0
        });
    }

    return {
        success: errors.length === 0,
        enrollments: createdEnrollments,
        errors
    };
}

/* ─── EXPORTS ───────────────────────────────────────────────────────────────── */

// Make everything available globally (CDN/no-module context)
window.DrTroySupabase = {
    getClient: getSupabaseClient,

    // Auth
    signUp,
    signIn,
    signOut,
    getUser,
    getSession,
    resetPassword,
    updatePassword,
    onAuthStateChange,

    // Profile
    getProfile,
    updateProfile,
    isAdmin,

    // Courses & Packages
    getCourses,
    getCourseById,
    getPackages,

    // Enrollments
    getEnrollments,
    createEnrollment,
    isEnrolled,
    processSuccessfulPurchase,

    // Progress
    getCourseProgress,
    updateProgress,
    createProgressRow,

    // Certificates
    getCertificates,
    issueCertificate,

    // Discount Codes
    validateDiscountCode,

    // Admin (read)
    getAllUsers,
    getAllEnrollments,
    getRevenueSummary,
    getCourseCompletionStats,

    // Admin (privileged actions via Netlify function)
    adminAction,
    adminGetUserByEmail,
    adminGetUserEnrollments,
    adminGetAllCourses,
    adminExportUsersCSV,

    // Admin Course CRUD
    adminCreateCourse,
    adminUpdateCourse,
    adminToggleCourseActive,

    // Admin Discount Codes
    adminGetDiscountCodes,
    adminCreateDiscountCode,
    adminUpdateDiscountCode,
    adminDeleteDiscountCode,

    // Admin License Tracking
    adminGetExpiringLicenses,
    adminUpdateLicenseExpiry,

    // Admin Certificates
    adminGetUserCertificates,
    adminGetUserCompletions,

    // Admin Campaigns / Password Reset / Certificates (Netlify)
    adminSendCampaign,
    adminResetPassword,
    adminIssueCertificate,
};

// Expose raw client for advanced use
window.DrTroySupabase.getClient = getSupabaseClient;

// Convenience alias
window.SB = window.DrTroySupabase;

/* ─── PASSWORD VALIDATION ───────────────────────────────────────────────────── */

/**
 * Validate password meets security requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
function validatePassword(password) {
    const errors = [];
    if (!password || password.length < 8) errors.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Password must contain at least one special character');
    return { valid: errors.length === 0, errors };
}

window.DrTroySupabase.validatePassword = validatePassword;

/* ─── SESSION IDLE TIMEOUT ──────────────────────────────────────────────────── */

(function initSessionTimeout() {
    const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    let idleTimer = null;

    function resetIdleTimer() {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(async () => {
            const sb = getSupabaseClient();
            if (!sb) return;
            const { data: { session } } = await sb.auth.getSession();
            if (session) {
                await sb.auth.signOut();
                alert('Your session has expired due to inactivity. Please log in again.');
                window.location.href = '/my-account.html';
            }
        }, IDLE_TIMEOUT_MS);
    }

    // Track user activity
    ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, resetIdleTimer, { passive: true });
    });

    // Start timer
    resetIdleTimer();
})();

console.log('✅ DrTroy Supabase client loaded (security-hardened)');
