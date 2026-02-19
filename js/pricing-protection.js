/**
 * DrTroy.com Pricing Protection System
 * Hides specific pricing from non-registered users to prevent competitive intelligence
 */

(function() {
    'use strict';
    
    // Check if user is authenticated
    function isUserAuthenticated() {
        return localStorage.getItem('drtroyAccount') || 
               sessionStorage.getItem('supabase.auth.token') ||
               localStorage.getItem('supabase.auth.token');
    }
    
    // Obfuscate pricing elements
    function obfuscatePricing() {
        if (isUserAuthenticated()) {
            return; // Show real prices to authenticated users
        }
        
        // Hide specific price amounts
        const priceElements = document.querySelectorAll(
            '[data-price], .price, .course-price, .package-price, ' +
            '.pricing, .cost, .fee, .amount, .total, .discount'
        );
        
        priceElements.forEach(element => {
            const text = element.textContent;
            if (text.includes('$') || text.match(/\d+\s*(dollars?|usd|cents?)/i)) {
                element.innerHTML = '<span style="background: linear-gradient(45deg, #e2e8f0, #cbd5e1); color: transparent; background-clip: text; -webkit-background-clip: text;">Competitive Pricing</span>';
                element.setAttribute('data-original-price', text);
            }
        });
        
        // Replace specific price text patterns
        const textNodes = getTextNodes(document.body);
        textNodes.forEach(node => {
            let text = node.textContent;
            
            // Replace dollar amounts with generic text
            if (text.match(/\$\d+/)) {
                text = text.replace(/\$\d+(\.\d{2})?/g, '[Competitive Rate]');
                node.textContent = text;
            }
            
            // Replace percentage discounts
            if (text.match(/\d+%\s*(off|discount|save)/i)) {
                text = text.replace(/\d+%\s*(off|discount|save)/gi, 'Member Discount');
                node.textContent = text;
            }
        });
        
        // Add registration prompt where prices were
        const priceContainers = document.querySelectorAll('.package, .course-card, .pricing-card');
        priceContainers.forEach(container => {
            if (container.querySelector('[data-original-price]')) {
                const prompt = document.createElement('div');
                prompt.className = 'registration-prompt';
                prompt.innerHTML = `
                    <div style="
                        background: linear-gradient(135deg, #1a365d, #2c5282);
                        color: white;
                        padding: 1rem;
                        border-radius: 8px;
                        text-align: center;
                        margin: 1rem 0;
                        box-shadow: 0 4px 12px rgba(26, 54, 93, 0.3);
                    ">
                        <p style="margin: 0 0 0.5rem 0; font-weight: 600;">📋 View Pricing</p>
                        <p style="margin: 0; font-size: 0.9rem; opacity: 0.9;">Create a free account to see our competitive rates</p>
                        <button onclick="scrollToRegistration()" style="
                            background: #d69e2e;
                            color: #1a365d;
                            border: none;
                            padding: 0.5rem 1rem;
                            border-radius: 6px;
                            font-weight: 600;
                            margin-top: 0.5rem;
                            cursor: pointer;
                        ">Get Pricing</button>
                    </div>
                `;
                container.appendChild(prompt);
            }
        });
    }
    
    // Get all text nodes in an element
    function getTextNodes(element) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        
        return textNodes;
    }
    
    // Scroll to registration section
    window.scrollToRegistration = function() {
        const registrationSection = document.querySelector('.optin, #registration, .signup');
        if (registrationSection) {
            registrationSection.scrollIntoView({ 
                behavior: 'smooth',
                block: 'center'
            });
            
            // Add highlight effect
            registrationSection.style.border = '3px solid #d69e2e';
            registrationSection.style.borderRadius = '8px';
            setTimeout(() => {
                registrationSection.style.border = '';
            }, 3000);
        }
    };
    
    // Hide sensitive course details
    function protectCourseDetails() {
        if (isUserAuthenticated()) {
            return;
        }
        
        // Hide detailed course descriptions beyond first paragraph
        const courseDescriptions = document.querySelectorAll('.course-description, .course-content');
        courseDescriptions.forEach(desc => {
            const paragraphs = desc.querySelectorAll('p');
            if (paragraphs.length > 1) {
                for (let i = 1; i < paragraphs.length; i++) {
                    paragraphs[i].style.filter = 'blur(3px)';
                    paragraphs[i].style.pointerEvents = 'none';
                    paragraphs[i].style.userSelect = 'none';
                }
                
                // Add unlock prompt
                const unlockPrompt = document.createElement('div');
                unlockPrompt.className = 'unlock-content-prompt';
                unlockPrompt.style.cssText = `
                    position: relative;
                    margin-top: -50px;
                    padding: 1rem;
                    background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.95));
                    text-align: center;
                    font-size: 0.9rem;
                    color: #4a5568;
                `;
                unlockPrompt.innerHTML = `
                    🔒 <strong>Full course details</strong> available after registration<br>
                    <button onclick="scrollToRegistration()" style="
                        background: transparent;
                        border: 1px solid #d69e2e;
                        color: #d69e2e;
                        padding: 0.25rem 0.5rem;
                        border-radius: 4px;
                        font-size: 0.8rem;
                        cursor: pointer;
                        margin-top: 0.5rem;
                    ">View Details</button>
                `;
                desc.appendChild(unlockPrompt);
            }
        });
    }
    
    // Initialize protection
    function initPricingProtection() {
        // Only apply on pages with pricing/course info
        const sensitivePages = ['home-preview', 'course-catalog', 'courses', 'checkout'];
        const currentPage = window.location.pathname;
        
        const isSensitivePage = sensitivePages.some(page => 
            currentPage.includes(page) || 
            currentPage === '/' || 
            currentPage === ''
        );
        
        if (isSensitivePage) {
            obfuscatePricing();
            protectCourseDetails();
            
            // Re-check when user status changes
            document.addEventListener('userStatusChanged', function() {
                if (isUserAuthenticated()) {
                    location.reload(); // Reload to show prices
                }
            });
        }
    }
    
    // Wait for DOM and run protection
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPricingProtection);
    } else {
        initPricingProtection();
    }
    
    // Protect against developer tools inspection of pricing
    if (!isUserAuthenticated()) {
        const originalConsole = console.log;
        console.log = function() {
            const args = Array.from(arguments);
            const hasPrice = args.some(arg => 
                typeof arg === 'string' && (arg.includes('$') || arg.match(/\d+\.\d{2}/))
            );
            if (!hasPrice) {
                originalConsole.apply(console, arguments);
            }
        };
    }
    
})();