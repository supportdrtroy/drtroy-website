/**
 * DrTroy CE Platform — Supabase Client
 * Initializes Supabase and exports all auth + data helpers.
 * Uses Supabase JS v2 via CDN (no npm).
 *
 * ANON KEY ONLY — never expose service role key in frontend.
 */

const SUPABASE_URL = 'https://pnqoxulxdmlmbywcpbyx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucW94dWx4ZG1sbWJ5d2NwYnl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNjU3NTIsImV4cCI6MjA4Njk0MTc1Mn0.YEPrwIvINX_Q1AsbxyU0T5m5oxpV9M756yiSCzy6LTc';

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
            state: metadata.state || ''
        }, { onConflict: 'id' });
    }

    return { data, error };
}

async function signIn(email, password) {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };
    return await sb.auth.signInWithPassword({ email, password });
}

async function signOut() {
    const sb = getSupabaseClient();
    if (!sb) return;
    await sb.auth.signOut();
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
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Database unavailable' } };

    const { data, error } = await sb.from('discount_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

    if (error || !data) return { data: null, error: error || { message: 'Invalid discount code' } };

    // Check usage limits
    if (data.max_uses && data.current_uses >= data.max_uses) {
        return { data: null, error: { message: 'This code has reached its usage limit' } };
    }

    // Check profession applicability
    if (data.applies_to && data.applies_to !== 'all' && data.applies_to !== profession) {
        return { data: null, error: { message: 'This code does not apply to your profession' } };
    }

    return { data, error: null };
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
        .order('enrolled_at', { ascending: false });
}

async function getRevenueSummary() {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };
    return await sb.from('enrollments')
        .select('amount_paid, enrolled_at, courses(title)')
        .order('enrolled_at', { ascending: false });
}

async function getCourseCompletionStats() {
    const sb = getSupabaseClient();
    if (!sb) return { data: [], error: { message: 'Database unavailable' } };
    return await sb.from('completions')
        .select('*, courses(title, ceu_hours)')
        .order('completed_at', { ascending: false });
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
            package_id: packageId || null,
            payment_id: paymentId || null,
            amount_paid: amountPaidCents ? amountPaidCents / 100 : 0,
            enrolled_at: new Date().toISOString()
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
            progress_pct: 0
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

    // Admin
    getAllUsers,
    getAllEnrollments,
    getRevenueSummary,
    getCourseCompletionStats
};

// Expose raw client for advanced use
window.DrTroySupabase.getClient = getSupabaseClient;

// Convenience alias
window.SB = window.DrTroySupabase;

console.log('✅ DrTroy Supabase client loaded');
