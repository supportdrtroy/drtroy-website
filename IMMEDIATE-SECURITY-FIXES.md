# IMMEDIATE Security Fixes for DrTroy.com

## 🚨 CRITICAL: Fix These Within 24 Hours

### 1. Replace Exposed Admin Credentials (URGENT)

**Current Vulnerability:**
```javascript
// EXPOSED in admin.html - anyone can see this!
const ADMIN_CREDENTIALS = {
    username: 'troyhounshell',
    password: 'DrTroy2026!PT'  // VISIBLE TO WORLD!
};
```

**Immediate Fix - Option A (Quick):**
Replace `admin.html` with `secure-admin.html` which uses:
- Daily rotating passwords
- Rate limiting (5 attempts max)
- Session encryption
- Security event logging
- No hardcoded credentials

**Immediate Fix - Option B (Better):**
1. **Remove admin.html entirely** from public access
2. **Set up Vercel/Netlify** with serverless functions
3. **Move admin to subdomain:** `admin.drtroy.com` 
4. **Use environment variables** for credentials

### 2. Force HTTPS Everywhere

**Add to ALL HTML files** (index.html, admin.html, courses.html):
```html
<!-- Add right after <head> tag -->
<script>
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    location.replace('https:' + window.location.href.substring(window.location.protocol.length));
}
</script>
```

### 3. Add Security Headers

**Add to ALL HTML files** in `<head>` section:
```html
<!-- Security Headers -->
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://js.stripe.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' https://*.supabase.co;
">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta http-equiv="X-Frame-Options" content="DENY">
<meta http-equiv="X-XSS-Protection" content="1; mode=block">
```

### 4. Secure Database Configuration

**Before setting up Supabase:**
```javascript
// NEVER put service role key in client code!
// ❌ WRONG:
const SUPABASE_SERVICE_KEY = 'eyJ0eXAi...'; // GIVES FULL DATABASE ACCESS

// ✅ CORRECT - Only use anon key in client:
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1Q...'; // Safe for client-side

// Service key goes in server environment variables only
```

### 5. Add Input Validation

**Add to all form handlers:**
```javascript
function validateAndSanitizeInput(input, type) {
    if (!input) return { valid: false, error: 'Required field' };
    
    // Sanitize
    const sanitized = input.trim().replace(/[<>]/g, '');
    
    // Validate by type
    switch (type) {
        case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(sanitized) || sanitized.length > 254) {
                return { valid: false, error: 'Invalid email address' };
            }
            break;
        case 'name':
            if (sanitized.length < 1 || sanitized.length > 100) {
                return { valid: false, error: 'Name must be 1-100 characters' };
            }
            break;
        case 'password':
            if (input.length < 8) {
                return { valid: false, error: 'Password must be at least 8 characters' };
            }
            break;
    }
    
    return { valid: true, value: sanitized };
}

// Use in form handlers:
const emailValidation = validateAndSanitizeInput(email, 'email');
if (!emailValidation.valid) {
    showError(emailValidation.error);
    return;
}
```

## 🛡️ MEDIUM Priority (This Week)

### 1. Set Up Proper Hosting

**Move away from GitHub Pages to:**

**Vercel (Recommended):**
1. Create account at vercel.com
2. Connect GitHub repo
3. Deploy automatically
4. Add environment variables for secrets
5. Set up serverless functions for admin

**Netlify (Alternative):**
1. Create account at netlify.com
2. Connect GitHub repo
3. Deploy with build settings
4. Add environment variables
5. Set up Netlify functions

### 2. Implement Rate Limiting

**Add to all forms:**
```javascript
class RateLimiter {
    constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
        this.attempts = new Map();
    }
    
    checkLimit(ip) {
        const now = Date.now();
        const userAttempts = this.attempts.get(ip) || [];
        
        // Clean old attempts
        const recentAttempts = userAttempts.filter(time => now - time < this.windowMs);
        
        if (recentAttempts.length >= this.maxAttempts) {
            return false; // Rate limited
        }
        
        recentAttempts.push(now);
        this.attempts.set(ip, recentAttempts);
        return true; // Allow
    }
}

// Use before processing forms
const rateLimiter = new RateLimiter();
if (!rateLimiter.checkLimit(userIP)) {
    showError('Too many attempts. Please wait 15 minutes.');
    return;
}
```

### 3. Add Password Requirements

**Update password validation:**
```javascript
function validatePassword(password) {
    const requirements = [];
    
    if (password.length < 12) {
        requirements.push('At least 12 characters');
    }
    if (!/[a-z]/.test(password)) {
        requirements.push('One lowercase letter');
    }
    if (!/[A-Z]/.test(password)) {
        requirements.push('One uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
        requirements.push('One number');
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
        requirements.push('One special character');
    }
    
    return {
        valid: requirements.length === 0,
        requirements: requirements
    };
}
```

## 🔒 LONG-TERM Security (Month 1)

### 1. Multi-Factor Authentication

**Add to admin login:**
```javascript
// 1. Email-based MFA (simple)
async function sendMFACode(email) {
    const code = Math.floor(100000 + Math.random() * 900000);
    // Send via email service (SendGrid, etc.)
    return code;
}

// 2. TOTP-based MFA (better)
// Use libraries like otpauth or speakeasy
```

### 2. Security Monitoring

**Add security event logging:**
```javascript
async function logSecurityEvent(event, details) {
    const logData = {
        timestamp: new Date().toISOString(),
        event: event,
        ip: getUserIP(),
        userAgent: navigator.userAgent,
        details: details
    };
    
    // Send to logging service (LogRocket, Sentry, etc.)
    await fetch('/api/security-log', {
        method: 'POST',
        body: JSON.stringify(logData)
    });
}

// Log important events
logSecurityEvent('login_attempt', { username: 'troy***' });
logSecurityEvent('admin_access', { action: 'code_created' });
logSecurityEvent('suspicious_activity', { reason: 'rapid_requests' });
```

### 3. Data Backup & Recovery

**Set up automated backups:**
```javascript
// Supabase automatic backups (included)
// Additional backup to S3/Google Cloud
async function createBackup() {
    const tables = ['users', 'purchases', 'discount_codes'];
    
    for (const table of tables) {
        const { data } = await supabase.from(table).select('*');
        
        // Encrypt and store backup
        const encrypted = await encryptData(JSON.stringify(data));
        await uploadToSecureStorage(encrypted, `backup-${table}-${Date.now()}`);
    }
}

// Run daily
setInterval(createBackup, 24 * 60 * 60 * 1000);
```

## 🚨 Security Checklist (Before Launch)

### Essential Security
- [ ] Remove hardcoded credentials from all files
- [ ] Force HTTPS on all pages
- [ ] Add security headers to all HTML
- [ ] Set up proper hosting (not GitHub Pages)
- [ ] Validate and sanitize all user inputs
- [ ] Implement rate limiting on forms
- [ ] Use strong password requirements
- [ ] Set up error logging and monitoring

### Database Security  
- [ ] Use only anon keys in client-side code
- [ ] Set up Row Level Security (RLS) policies
- [ ] Enable audit logging in Supabase
- [ ] Create regular backup schedule
- [ ] Test backup restoration process
- [ ] Encrypt sensitive data in database

### Access Control
- [ ] Implement secure admin authentication
- [ ] Add multi-factor authentication
- [ ] Set up session management
- [ ] Create role-based permissions
- [ ] Log all administrative actions
- [ ] Set up account lockout policies

### Infrastructure Security
- [ ] Configure WAF (Web Application Firewall)
- [ ] Set up DDoS protection
- [ ] Enable intrusion detection
- [ ] Configure security monitoring
- [ ] Set up vulnerability scanning
- [ ] Create incident response plan

## 💰 Security Budget (Monthly)

### Minimum Security ($150/month)
- Vercel Pro: $20/month
- Supabase Pro: $25/month  
- Security monitoring: $30/month
- SSL certificates: $0 (included)
- Basic cyber insurance: $75/month

### Recommended Security ($400/month)
- Enhanced hosting: $80/month
- WAF + DDoS protection: $50/month
- Advanced monitoring: $100/month
- Backup services: $30/month
- Cyber insurance: $140/month

### Enterprise Security ($1000/month)
- Premium hosting: $200/month
- Enterprise security suite: $300/month
- 24/7 monitoring: $200/month
- Compliance consulting: $150/month
- Premium insurance: $150/month

## 🎯 Action Plan for This Week

### Day 1 (Today)
1. **Replace admin.html** with secure-admin.html
2. **Add HTTPS enforcement** to all pages  
3. **Add security headers** to all HTML files
4. **Remove any hardcoded secrets** from code

### Day 2-3
1. **Set up Vercel or Netlify** hosting
2. **Move admin to subdomain** or separate app
3. **Add input validation** to all forms
4. **Implement rate limiting** on forms

### Day 4-5
1. **Set up Supabase database** (following security guide)
2. **Test all security measures** 
3. **Create security monitoring** dashboard
4. **Document security procedures**

### Weekend
1. **Security testing** - try to hack your own site
2. **Backup testing** - verify you can restore data
3. **Create incident response plan**
4. **Get cyber insurance quotes**

---

**Bottom Line:** Your current system has critical security holes that could lead to data theft, financial loss, and legal liability. These fixes are not optional for a healthcare-related business - they're mandatory for protecting your customers and your business.**