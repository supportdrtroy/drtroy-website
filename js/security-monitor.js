/**
 * DrTroy.com Security Monitoring System
 * Monitors and logs suspicious activities for admin review
 */

(function() {
    'use strict';
    
    const SECURITY_LOG_KEY = 'drtroy_security_log';
    const MAX_LOG_ENTRIES = 1000;
    
    // Security event logger
    function logSecurityEvent(eventType, details, severity = 'medium') {
        const event = {
            timestamp: new Date().toISOString(),
            type: eventType,
            severity: severity,
            details: details,
            userAgent: navigator.userAgent.substring(0, 200),
            url: window.location.href,
            referrer: document.referrer || 'direct',
            fingerprint: getBasicFingerprint()
        };
        
        // Get existing log
        const existingLog = JSON.parse(localStorage.getItem(SECURITY_LOG_KEY) || '[]');
        existingLog.unshift(event);
        
        // Keep only recent entries
        if (existingLog.length > MAX_LOG_ENTRIES) {
            existingLog.splice(MAX_LOG_ENTRIES);
        }
        
        localStorage.setItem(SECURITY_LOG_KEY, JSON.stringify(existingLog));
        
        // For high-severity events, try to alert admin
        if (severity === 'high' || severity === 'critical') {
            notifyAdminOfThreat(event);
        }
        
        console.log(`🚨 Security Event [${severity}]: ${eventType}`, details);
    }
    
    // Basic fingerprinting for tracking
    function getBasicFingerprint() {
        return btoa(JSON.stringify({
            screen: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled
        }));
    }
    
    // Attempt to notify admin of threats
    async function notifyAdminOfThreat(event) {
        try {
            // In production, this would send to your security monitoring endpoint
            console.warn('HIGH SEVERITY SECURITY EVENT:', event);
            
            // Could integrate with email alerts or security service here
            // Example: send to webhook, email API, or security monitoring service
        } catch (error) {
            console.error('Failed to notify admin of security threat:', error);
        }
    }
    
    // Monitor for automated behavior patterns
    function monitorAutomatedBehavior() {
        let pageLoadTime = performance.now();
        let clickCount = 0;
        let mouseMovements = 0;
        let keystrokes = 0;
        let scrollEvents = 0;
        
        // Track user interactions
        document.addEventListener('click', () => clickCount++);
        document.addEventListener('mousemove', () => mouseMovements++);
        document.addEventListener('keydown', () => keystrokes++);
        document.addEventListener('scroll', () => scrollEvents++);
        
        // Check for bot patterns after 10 seconds
        setTimeout(() => {
            const timeSpent = (performance.now() - pageLoadTime) / 1000;
            const interactionScore = clickCount + (mouseMovements / 10) + keystrokes + scrollEvents;
            
            if (timeSpent > 10 && interactionScore < 5) {
                logSecurityEvent('automated_behavior_detected', {
                    timeSpent: Math.round(timeSpent),
                    clicks: clickCount,
                    mouseMovements: mouseMovements,
                    keystrokes: keystrokes,
                    scrolls: scrollEvents,
                    score: interactionScore
                }, 'high');
            }
        }, 10000);
    }
    
    // Monitor for rapid page navigation
    function monitorNavigationSpeed() {
        let lastNavigationTime = Date.now();
        let rapidNavigationCount = 0;
        
        window.addEventListener('beforeunload', () => {
            const timeSinceLastNav = Date.now() - lastNavigationTime;
            if (timeSinceLastNav < 2000) { // Less than 2 seconds on page
                rapidNavigationCount++;
                if (rapidNavigationCount > 3) {
                    logSecurityEvent('rapid_page_navigation', {
                        averageTimePerPage: timeSinceLastNav,
                        rapidNavigationCount: rapidNavigationCount
                    }, 'high');
                }
            }
            lastNavigationTime = Date.now();
        });
    }
    
    // Monitor for developer tools usage
    function monitorDevTools() {
        let devtoolsOpen = false;
        
        // Check for console access
        const threshold = 160;
        setInterval(() => {
            const heightDiff = window.outerHeight - window.innerHeight;
            const widthDiff = window.outerWidth - window.innerWidth;
            
            if (heightDiff > threshold || widthDiff > threshold) {
                if (!devtoolsOpen) {
                    devtoolsOpen = true;
                    logSecurityEvent('developer_tools_opened', {
                        heightDiff: heightDiff,
                        widthDiff: widthDiff,
                        suspiciousActivity: 'potential_content_inspection'
                    }, 'medium');
                }
            } else {
                devtoolsOpen = false;
            }
        }, 1000);
        
        // Monitor console access
        let consoleUsed = false;
        const originalLog = console.log;
        console.log = function() {
            if (!consoleUsed) {
                consoleUsed = true;
                logSecurityEvent('console_access_detected', {
                    action: 'console.log called',
                    suspiciousActivity: 'potential_data_extraction'
                }, 'medium');
            }
            originalLog.apply(console, arguments);
        };
    }
    
    // Monitor for suspicious URL access patterns
    function monitorSuspiciousURLs() {
        const suspiciousPatterns = [
            /admin/i, /api/i, /config/i, /backup/i, /database/i,
            /\.json$/i, /\.xml$/i, /\.csv$/i, /\.sql$/i,
            /wp-admin/i, /phpmyadmin/i, /.env/i
        ];
        
        const currentURL = window.location.href.toLowerCase();
        suspiciousPatterns.forEach(pattern => {
            if (pattern.test(currentURL)) {
                logSecurityEvent('suspicious_url_access', {
                    url: window.location.href,
                    pattern: pattern.toString(),
                    riskLevel: 'attempting_sensitive_access'
                }, 'high');
            }
        });
    }
    
    // Monitor for form scraping attempts
    function monitorFormScraping() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            let fieldAccessCount = 0;
            
            form.querySelectorAll('input, select, textarea').forEach(field => {
                field.addEventListener('focus', () => {
                    fieldAccessCount++;
                    if (fieldAccessCount > 10) {
                        logSecurityEvent('potential_form_scraping', {
                            formId: form.id || 'unknown',
                            fieldAccessCount: fieldAccessCount,
                            suspiciousActivity: 'automated_field_access'
                        }, 'high');
                    }
                });
            });
        });
    }
    
    // Monitor for content scraping attempts
    function monitorContentScraping() {
        let textSelections = 0;
        let copyEvents = 0;
        
        document.addEventListener('selectstart', () => textSelections++);
        document.addEventListener('copy', () => copyEvents++);
        
        setTimeout(() => {
            if (textSelections > 20 || copyEvents > 5) {
                logSecurityEvent('potential_content_scraping', {
                    textSelections: textSelections,
                    copyEvents: copyEvents,
                    suspiciousActivity: 'mass_content_selection'
                }, 'medium');
            }
        }, 30000);
    }
    
    // Export security log for admin review
    window.getSecurityLog = function() {
        return JSON.parse(localStorage.getItem(SECURITY_LOG_KEY) || '[]');
    };
    
    // Clear security log (admin function)
    window.clearSecurityLog = function() {
        localStorage.removeItem(SECURITY_LOG_KEY);
        console.log('Security log cleared');
    };
    
    // Initialize all monitoring when DOM is ready
    function initSecurityMonitoring() {
        // Only monitor on sensitive pages
        const sensitivePages = ['admin', 'course', 'checkout', 'my-account'];
        const currentPage = window.location.pathname.toLowerCase();
        
        if (sensitivePages.some(page => currentPage.includes(page)) || currentPage === '/') {
            monitorAutomatedBehavior();
            monitorNavigationSpeed();
            monitorDevTools();
            monitorSuspiciousURLs();
            monitorFormScraping();
            monitorContentScraping();
            
            logSecurityEvent('security_monitoring_initialized', {
                page: window.location.pathname,
                timestamp: new Date().toISOString()
            }, 'low');
        }
    }
    
    // Initialize monitoring
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSecurityMonitoring);
    } else {
        initSecurityMonitoring();
    }
    
})();