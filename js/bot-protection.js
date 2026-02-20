/**
 * DrTroy.com Bot Protection & Anti-Scraping System
 * Protects against competitive intelligence gathering
 */

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        maxRequestsPerMinute: 10,
        blockDuration: 300000, // 5 minutes
        sensitivePages: ['/course-catalog.html', '/courses/', '/checkout.html'],
        blockedUserAgents: [
            'bot', 'crawler', 'spider', 'scraper', 'ahrefs', 'semrush', 
            'moz', 'screaming frog', 'wget', 'curl', 'python', 'scrapy'
        ]
    };
    
    // Rate limiting storage
    const STORAGE_KEY = 'drtroy_access_log';
    
    // Get client fingerprint
    function getFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('DrTroy fingerprint', 2, 2);
        
        return btoa(JSON.stringify({
            ua: navigator.userAgent.substring(0, 100),
            lang: navigator.language,
            screen: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            canvas: canvas.toDataURL().substring(0, 50),
            timestamp: Date.now()
        }));
    }
    
    // Check if user agent is suspicious
    function isSuspiciousAgent() {
        const ua = navigator.userAgent.toLowerCase();
        return CONFIG.blockedUserAgents.some(blocked => ua.includes(blocked));
    }
    
    // Check if accessing sensitive content
    function isAccessingSensitiveContent() {
        const path = window.location.pathname;
        return CONFIG.sensitivePages.some(sensitive => path.includes(sensitive));
    }
    
    // Rate limiting check
    function checkRateLimit() {
        const fingerprint = getFingerprint();
        const now = Date.now();
        const accessLog = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        
        // Clean old entries
        Object.keys(accessLog).forEach(key => {
            if (now - accessLog[key].lastAccess > 3600000) { // 1 hour
                delete accessLog[key];
            }
        });
        
        // Check current user
        if (!accessLog[fingerprint]) {
            accessLog[fingerprint] = { count: 0, firstAccess: now, lastAccess: now, blocked: false };
        }
        
        const userLog = accessLog[fingerprint];
        
        // Check if currently blocked
        if (userLog.blocked && (now - userLog.blockedAt) < CONFIG.blockDuration) {
            return false;
        }
        
        // Reset if more than 1 minute passed
        if (now - userLog.lastAccess > 60000) {
            userLog.count = 0;
            userLog.firstAccess = now;
            userLog.blocked = false;
        }
        
        userLog.count++;
        userLog.lastAccess = now;
        
        // Block if too many requests
        if (userLog.count > CONFIG.maxRequestsPerMinute) {
            userLog.blocked = true;
            userLog.blockedAt = now;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(accessLog));
            return false;
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(accessLog));
        return true;
    }
    
    // Mouse movement tracking (bots typically don't move mouse)
    let mouseMovements = 0;
    let humanBehaviorScore = 0;
    
    document.addEventListener('mousemove', function() {
        mouseMovements++;
        if (mouseMovements > 5) {
            humanBehaviorScore += 10;
        }
    }, { passive: true });
    
    // Scroll behavior tracking
    document.addEventListener('scroll', function() {
        humanBehaviorScore += 5;
    }, { passive: true });
    
    // Click tracking
    document.addEventListener('click', function() {
        humanBehaviorScore += 15;
    });
    
    // Main protection logic
    function initBotProtection() {
        // Immediate checks
        if (isSuspiciousAgent()) {
            console.log('Suspicious user agent detected');
            blockAccess('Automated access detected');
            return;
        }
        
        if (!checkRateLimit()) {
            blockAccess('Rate limit exceeded');
            return;
        }
        
        // Delayed human behavior check
        setTimeout(function() {
            if (isAccessingSensitiveContent() && humanBehaviorScore < 20) {
                blockAccess('Bot behavior detected');
                return;
            }
        }, 5000);
        
        // Advanced bot detection
        detectAdvancedBots();
    }
    
    // Block access function
    function blockAccess(reason) {
        console.log('Access blocked:', reason);
        
        // Hide sensitive content
        const sensitiveElements = document.querySelectorAll('[data-price], .course-price, .pricing, .admin-content');
        sensitiveElements.forEach(el => el.style.display = 'none');
        
        // Show generic message
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            font-family: Arial, sans-serif; text-align: center; z-index: 10000;
        `;
        message.innerHTML = `
            <h3>Access Temporarily Restricted</h3>
            <p>Please try again in a few minutes or <a href="/contact">contact us</a> for assistance.</p>
            <p style="font-size: 0.8em; color: #666; margin-top: 1rem;">If you're a legitimate user, please ensure JavaScript is enabled and cookies are allowed.</p>
        `;
        document.body.appendChild(message);
        
        // Prevent scrolling
        document.body.style.overflow = 'hidden';
    }
    
    // Advanced bot detection techniques
    function detectAdvancedBots() {
        // Check for headless browser indicators
        if (navigator.webdriver || window.phantom || window.callPhantom) {
            blockAccess('Headless browser detected');
            return;
        }
        
        // Check for automation tools
        if (window.chrome && window.chrome.runtime && window.chrome.runtime.onConnect) {
            // Likely Chrome automation
        }
        
        // Screen resolution check (many bots use default 1024x768)
        if (screen.width === 1024 && screen.height === 768) {
            humanBehaviorScore -= 10;
        }
        
        // Language checks
        if (!navigator.languages || navigator.languages.length === 0) {
            humanBehaviorScore -= 20;
        }
        
        // Plugin checks
        if (navigator.plugins.length === 0) {
            humanBehaviorScore -= 15;
        }
        
        // Check for common bot properties
        const botProperties = [
            'window.Buffer', 'window.emit', 'window.spawn',
            'document.documentElement.driver', 'window.domAutomation'
        ];
        
        botProperties.forEach(prop => {
            if (window[prop.split('.')[1]]) {
                humanBehaviorScore -= 25;
            }
        });
    }
    
    // Initialize protection when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBotProtection);
    } else {
        initBotProtection();
    }
    
    // Protect against console-based scraping
    if (window.location.pathname.includes('course') || window.location.pathname.includes('admin')) {
        console.clear();
        console.log('%c🚫 STOP!', 'color: red; font-size: 50px; font-weight: bold;');
        console.log('%cThis is a browser feature intended for developers. Content scraping violates our Terms of Service.', 'color: red; font-size: 16px;');
    }
    
})();