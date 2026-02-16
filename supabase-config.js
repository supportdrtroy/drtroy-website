// Supabase Configuration for DrTroy.com
// This file handles all database connections and API calls

// Supabase client configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Initialize Supabase client
let supabase = null;

// Check if we're in browser environment and Supabase is available
if (typeof window !== 'undefined' && window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Database API wrapper functions
const DrTroyDB = {
    
    // User Management
    async createUser(userData) {
        if (!supabase) return { error: 'Database not available' };
        
        try {
            const { data, error } = await supabase
                .from('users')
                .insert([{
                    email: userData.email,
                    first_name: userData.firstName,
                    last_name: userData.lastName,
                    profession: userData.profession,
                    password_hash: await hashPassword(userData.password), // You'll need bcrypt or similar
                    license_number: userData.licenseNumber,
                    state: userData.state || 'TX',
                    phone: userData.phone,
                    city: userData.city,
                    zip_code: userData.zipCode,
                    marketing_consent: userData.marketingConsent || false,
                    referral_source: userData.referralSource
                }])
                .select();
                
            return { data, error };
        } catch (err) {
            return { error: err.message };
        }
    },
    
    async getUserByEmail(email) {
        if (!supabase) return { error: 'Database not available' };
        
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('status', 'active')
            .single();
            
        return { data, error };
    },
    
    async updateUserLastLogin(userId) {
        if (!supabase) return { error: 'Database not available' };
        
        const { data, error } = await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', userId);
            
        return { data, error };
    },
    
    // Purchase Management
    async createPurchase(purchaseData) {
        if (!supabase) return { error: 'Database not available' };
        
        try {
            const { data, error } = await supabase
                .from('purchases')
                .insert([{
                    user_id: purchaseData.userId,
                    package_type: purchaseData.packageType,
                    original_price: purchaseData.originalPrice,
                    discount_amount: purchaseData.discountAmount || 0,
                    final_price: purchaseData.finalPrice,
                    discount_code: purchaseData.discountCode,
                    payment_method: purchaseData.paymentMethod,
                    payment_id: purchaseData.paymentId,
                    device_type: this.getDeviceType(),
                    ip_address: purchaseData.ipAddress,
                    user_agent: navigator.userAgent,
                    referrer_url: document.referrer
                }])
                .select();
                
            // Create course progress entries for this purchase
            if (data && data[0]) {
                await this.createCourseProgress(data[0].id, purchaseData.packageType);
            }
                
            return { data, error };
        } catch (err) {
            return { error: err.message };
        }
    },
    
    async createCourseProgress(purchaseId, packageType) {
        if (!supabase) return { error: 'Database not available' };
        
        // Define courses for each package type
        const coursesByPackage = {
            'PT': [
                'Musculoskeletal Evaluation and Treatment',
                'Fall Prevention in Older Adults',
                'Post-Surgical Rehabilitation',
                'Chronic Pain Management',
                'Balance and Vestibular Disorders',
                'Sports Injury Rehabilitation',
                'Documentation and Billing Best Practices',
                'Geriatric Physical Therapy Considerations',
                'Neurological Rehabilitation',
                'Infection Control and Patient Safety'
            ],
            'PTA': [
                'Therapeutic Exercise Techniques',
                'Modalities and Physical Agents',
                'Transfer and Mobility Training',
                'Gait Training and Assessment',
                'Wound Care Basics for PTAs',
                'Neurological Rehabilitation',
                'Infection Control and Patient Safety'
            ],
            'OT': [
                'Activities of Daily Living (ADL) Assessment',
                'Upper Extremity Rehabilitation',
                'Cognitive Assessment and Intervention',
                'Home Modification and Safety',
                'Pediatric Occupational Therapy',
                'Adaptive Equipment and Assistive Technology',
                'Mental Health in Occupational Therapy',
                'Neurological Rehabilitation',
                'Infection Control and Patient Safety'
            ],
            'COTA': [
                'Therapeutic Activities in OT',
                'Functional Mobility Training',
                'Patient-Centered Care Techniques',
                'Orthotics and Splinting Basics',
                'Group Intervention Strategies',
                'Documentation for COTAs',
                'Pediatric Interventions for COTAs',
                'Neurological Rehabilitation',
                'Infection Control and Patient Safety'
            ]
        };
        
        const courses = coursesByPackage[packageType] || [];
        const courseProgressData = courses.map((courseName, index) => ({
            purchase_id: purchaseId,
            course_id: `${packageType}_${index + 1}`,
            course_name: courseName,
            status: 'not_started'
        }));
        
        const { data, error } = await supabase
            .from('course_progress')
            .insert(courseProgressData);
            
        return { data, error };
    },
    
    // Discount Code Management
    async validateDiscountCode(code, packageType) {
        if (!supabase) return { error: 'Database not available' };
        
        const { data, error } = await supabase
            .from('discount_codes')
            .select('*')
            .eq('code', code.toUpperCase())
            .eq('status', 'active')
            .single();
            
        if (error) return { error: 'Invalid discount code' };
        
        // Validate expiry
        if (data.expires_at && new Date() > new Date(data.expires_at)) {
            return { error: 'This code has expired' };
        }
        
        // Validate usage limits
        if (data.usage_type === 'single' && data.current_uses > 0) {
            return { error: 'This code has already been used' };
        }
        
        if (data.usage_type === 'limited' && data.current_uses >= data.max_uses) {
            return { error: 'This code has reached its usage limit' };
        }
        
        // Validate package compatibility
        if (data.applies_to !== 'all' && data.applies_to !== packageType) {
            return { error: 'This code does not apply to this package type' };
        }
        
        return { data, error: null };
    },
    
    async useDiscountCode(code) {
        if (!supabase) return { error: 'Database not available' };
        
        const { data, error } = await supabase
            .from('discount_codes')
            .update({ 
                current_uses: supabase.sql`current_uses + 1`,
                updated_at: new Date().toISOString()
            })
            .eq('code', code.toUpperCase());
            
        return { data, error };
    },
    
    async createDiscountCode(codeData) {
        if (!supabase) return { error: 'Database not available' };
        
        const { data, error } = await supabase
            .from('discount_codes')
            .insert([codeData])
            .select();
            
        return { data, error };
    },
    
    // Analytics Functions
    async trackEvent(eventData) {
        if (!supabase) return { error: 'Database not available' };
        
        const { data, error } = await supabase
            .from('analytics_events')
            .insert([{
                session_id: this.getSessionId(),
                user_id: eventData.userId || null,
                event_type: eventData.eventType,
                event_data: eventData.eventData || {},
                page_url: window.location.href,
                referrer_url: document.referrer,
                device_type: this.getDeviceType(),
                browser: this.getBrowser(),
                os: this.getOS(),
                ip_address: eventData.ipAddress
            }]);
            
        return { data, error };
    },
    
    async getAnalytics(timeframe = '30d') {
        if (!supabase) return { error: 'Database not available' };
        
        // Get the analytics dashboard view
        const { data, error } = await supabase
            .from('analytics_dashboard')
            .select('*')
            .single();
            
        return { data, error };
    },
    
    async getDetailedAnalytics() {
        if (!supabase) return { error: 'Database not available' };
        
        try {
            // Run multiple queries in parallel for comprehensive analytics
            const [
                revenue,
                customers,
                purchases,
                courseProgress,
                discountCodes,
                events
            ] = await Promise.all([
                // Revenue analytics
                supabase.from('purchases').select('*').eq('payment_status', 'completed'),
                // Customer analytics  
                supabase.from('users').select('*').eq('status', 'active'),
                // Purchase analytics
                supabase.from('purchases').select('*, users(profession, state)'),
                // Course analytics
                supabase.from('course_progress').select('*'),
                // Code analytics
                supabase.from('discount_codes').select('*'),
                // Event analytics
                supabase.from('analytics_events').select('*').gte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString())
            ]);
            
            return {
                revenue: revenue.data || [],
                customers: customers.data || [],
                purchases: purchases.data || [],
                courseProgress: courseProgress.data || [],
                discountCodes: discountCodes.data || [],
                events: events.data || [],
                error: null
            };
        } catch (err) {
            return { error: err.message };
        }
    },
    
    // Utility Functions
    getSessionId() {
        let sessionId = sessionStorage.getItem('drtroy_session_id');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('drtroy_session_id', sessionId);
        }
        return sessionId;
    },
    
    getDeviceType() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
            return 'tablet';
        } else if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
            return 'mobile';
        } else {
            return 'desktop';
        }
    },
    
    getBrowser() {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        if (userAgent.includes('Edge')) return 'Edge';
        return 'Other';
    },
    
    getOS() {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Windows')) return 'Windows';
        if (userAgent.includes('Mac')) return 'macOS';
        if (userAgent.includes('Linux')) return 'Linux';
        if (userAgent.includes('Android')) return 'Android';
        if (userAgent.includes('iOS')) return 'iOS';
        return 'Other';
    }
};

// Password hashing (you'll need to implement this with bcrypt or similar)
async function hashPassword(password) {
    // This is a placeholder - implement proper password hashing
    // In production, use bcrypt.js or similar library
    return 'hashed_' + password; // DO NOT USE THIS IN PRODUCTION
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DrTroyDB;
} else if (typeof window !== 'undefined') {
    window.DrTroyDB = DrTroyDB;
}