// DrTroy Security Utilities - XSS Prevention
(function() {
    'use strict';
    
    // XSS Prevention: HTML Escape Function
    window.escapeHtml = function(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    // Safe innerHTML setter
    window.safeInnerHTML = function(element, html) {
        if (!element) return;
        // Remove scripts
        const clean = html.replace(/<script[^>]*>.*?<\/script>/gi, '');
        element.innerHTML = clean;
    };
    
    // DrTroySecurity namespace
    window.DrTroySecurity = {
        validateAdminAccess: async function() {
            try {
                const session = await window.DrTroySupabase?.getSession();
                if (!session?.user) return false;
                
                const { data: profile } = await window.DrTroySupabase?.getProfile(session.user.id);
                return profile?.is_admin === true;
            } catch (e) {
                console.error('Admin validation failed:', e);
                return false;
            }
        }
    };
    
    // Also expose as window.validateAdminAccess for backward compatibility
    window.validateAdminAccess = window.DrTroySecurity.validateAdminAccess;
    
    // Content Security Policy enforcement helper
    window.enforceCSP = function() {
        // Prevent inline event handlers
        document.querySelectorAll('[onclick], [onload], [onerror]').forEach(el => {
            console.warn('Removing inline event handler for security');
            el.removeAttribute('onclick');
            el.removeAttribute('onload');
            el.removeAttribute('onerror');
        });
    };
    
    console.log('🔒 DrTroy Security utilities loaded');
})();
