// Supabase Configuration for DrTroy.com
// All Supabase interaction is handled via js/supabase-client.js.
// This file is kept for legacy compatibility and re-exports the client.

const SUPABASE_URL  = 'https://pnqoxulxdmlmbywcpbyx.supabase.co';
const SUPABASE_ANON_KEY = 'process.env.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'';

// Legacy DrTroyDB shim — forwards calls to Supabase where possible.
// New code should use window.DrTroySupabase (js/supabase-client.js) directly.
const DrTroyDB = {
    getSupabaseClient() {
        return window.DrTroySupabase ? window.DrTroySupabase.getClient() : null;
    },

    async validateDiscountCode(code, packageType) {
        if (!window.DrTroySupabase) return { error: 'Database not available' };
        const { data, error } = await window.DrTroySupabase.validateDiscountCode(code, packageType);
        return { data, error };
    },

    getDeviceType() {
        const ua = navigator.userAgent || '';
        if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
        if (/mobile|iphone|ipod|android|blackberry/i.test(ua)) return 'mobile';
        return 'desktop';
    },

    getSessionId() {
        let id = sessionStorage.getItem('drtroy_session_id');
        if (!id) {
            id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('drtroy_session_id', id);
        }
        return id;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DrTroyDB;
} else if (typeof window !== 'undefined') {
    window.DrTroyDB = DrTroyDB;
}
