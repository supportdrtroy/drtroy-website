# DrTroy.com Database Architecture Plan

## 🔄 Current State vs Production Needs

### Demo (Current)
- **Storage:** Browser localStorage
- **Security:** None (client-side only)
- **Capacity:** ~5-10MB per user browser
- **Backup:** None
- **Multi-device:** No synchronization
- **Suitable for:** Demo/testing only

### Production Requirements
- **HIPAA Compliance:** Required for healthcare education
- **Multi-device sync:** Users access from phone, work, home
- **Backup & Recovery:** Business continuity essential
- **Scalability:** Handle 1000+ concurrent users
- **Security:** Encryption at rest and in transit
- **Audit Trail:** Track all user actions for compliance

## 🏗️ Recommended Database Architecture

### Option 1: Cloud-First (Recommended)
```
Frontend: React/HTML (Static hosting)
    ↓
API Gateway: Vercel/Netlify Functions
    ↓
Database: Supabase or PlanetScale
    ↓
File Storage: Cloudflare R2 or AWS S3
    ↓
Analytics: PostHog or Mixpanel
```

**Benefits:**
- HIPAA-compliant options available
- Automatic backups and scaling
- $50-200/month at scale
- Minimal server management

### Option 2: Traditional Hosting
```
Frontend: Static files (GitHub Pages/Netlify)
    ↓
Backend: Node.js + Express (VPS/DigitalOcean)
    ↓
Database: PostgreSQL (managed instance)
    ↓
File Storage: Local or S3-compatible
```

**Benefits:**
- Full control over data
- Lower costs at small scale ($20-50/month)
- Easier compliance auditing

### Option 3: All-in-One Platform
```
Platform: Bubble.io or Retool
- Database included
- HIPAA compliance available
- Visual development
- $100-300/month
```

**Benefits:**
- No coding required
- Built-in compliance features
- Faster time to market

## 📊 Database Schema Design

### Core Tables Needed

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profession ENUM('PT', 'PTA', 'OT', 'COTA') NOT NULL,
    license_number VARCHAR(50),
    state VARCHAR(2) DEFAULT 'TX',
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    email_verified BOOLEAN DEFAULT FALSE,
    status ENUM('active', 'suspended', 'deleted') DEFAULT 'active'
);
```

#### Purchases Table
```sql
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    package_type VARCHAR(20) NOT NULL,
    original_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    final_price DECIMAL(10,2) NOT NULL,
    discount_code VARCHAR(50),
    payment_method VARCHAR(20),
    payment_id VARCHAR(100), -- Stripe/PayPal transaction ID
    status ENUM('pending', 'completed', 'refunded') DEFAULT 'pending',
    purchased_at TIMESTAMP DEFAULT NOW()
);
```

#### Course Progress Table
```sql
CREATE TABLE course_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    purchase_id UUID REFERENCES purchases(id),
    course_id VARCHAR(50) NOT NULL,
    status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
    progress_percent INTEGER DEFAULT 0,
    time_spent_minutes INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    certificate_issued BOOLEAN DEFAULT FALSE
);
```

#### Discount Codes Table
```sql
CREATE TABLE discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    type ENUM('employee', 'marketing') NOT NULL,
    discount_type ENUM('percentage', 'fixed', 'free') NOT NULL,
    discount_value INTEGER NOT NULL,
    usage_type ENUM('single', 'limited', 'unlimited') NOT NULL,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    applies_to VARCHAR(20), -- 'all', 'PT', 'PTA', etc.
    expires_at TIMESTAMP,
    created_by VARCHAR(100),
    notes TEXT,
    status ENUM('active', 'expired', 'deactivated') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔒 Security & Compliance

### HIPAA Requirements
Even though CE courses aren't PHI, healthcare professionals expect HIPAA-level security:

1. **Encryption at Rest:** All data encrypted in database
2. **Encryption in Transit:** HTTPS/TLS for all connections
3. **Access Controls:** Role-based permissions
4. **Audit Logs:** Track all data access and changes
5. **Business Associate Agreement:** With hosting provider
6. **Data Backup:** Encrypted backups with retention policy

### Implementation
```javascript
// Example: Secure password hashing
const bcrypt = require('bcrypt');
const saltRounds = 12;

async function hashPassword(password) {
    return await bcrypt.hash(password, saltRounds);
}

// Example: API authentication
const jwt = require('jsonwebtoken');

function generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { 
        expiresIn: '24h',
        issuer: 'drtroy.com'
    });
}
```

## 💰 Cost Analysis

### Small Scale (0-100 users)
**Option 1: Supabase**
- Database: Free tier (500MB)
- Authentication: Free tier
- Storage: Free tier (1GB)
- **Total: $0-25/month**

**Option 2: DigitalOcean**
- VPS: $12/month
- Managed Database: $15/month
- **Total: $27/month**

### Medium Scale (100-1000 users)
**Option 1: Supabase Pro**
- Database: $25/month (8GB)
- Authentication: Included
- Storage: $10/month (100GB)
- **Total: $35/month**

**Option 2: DigitalOcean**
- VPS: $24/month (upgraded)
- Managed Database: $50/month
- **Total: $74/month**

### Large Scale (1000+ users)
**Enterprise Solutions**
- AWS RDS: $200-500/month
- Azure SQL: $300-600/month
- Google Cloud SQL: $250-400/month

## 🚀 Migration Strategy

### Phase 1: MVP Database (Week 1-2)
1. Set up Supabase project
2. Create core tables (users, purchases, codes)
3. Build basic API endpoints
4. Migrate discount codes from localStorage

### Phase 2: User Authentication (Week 3-4)
1. Implement secure registration/login
2. Password reset functionality
3. Email verification
4. Session management

### Phase 3: Purchase System (Week 5-6)
1. Stripe/PayPal integration
2. Order processing workflow
3. Receipt generation
4. Refund handling

### Phase 4: Course Tracking (Week 7-8)
1. Course progress tracking
2. Certificate generation
3. Completion reporting
4. Analytics integration

## 📋 Implementation Checklist

### Technical Setup
- [ ] Choose hosting provider (Supabase recommended)
- [ ] Set up development environment
- [ ] Create database schema
- [ ] Build API endpoints
- [ ] Implement authentication
- [ ] Set up payment processing
- [ ] Configure backups
- [ ] Enable SSL/TLS encryption

### Compliance Setup
- [ ] Review HIPAA requirements
- [ ] Sign Business Associate Agreement
- [ ] Set up audit logging
- [ ] Create data retention policy
- [ ] Document security procedures
- [ ] Set up monitoring/alerts

### Testing & Launch
- [ ] Load testing with 100+ concurrent users
- [ ] Security penetration testing
- [ ] Backup/restore testing
- [ ] Payment processing testing
- [ ] Cross-device synchronization testing

## 🎯 Recommendation for DrTroy.com

**Immediate (Next 30 days):**
Start with **Supabase** - it's healthcare-friendly, HIPAA-compliant, and scales automatically.

**Why Supabase:**
1. **HIPAA Compliance:** Available with Pro plan
2. **Built-in Authentication:** Secure user management
3. **Real-time Features:** Live progress tracking
4. **PostgreSQL:** Industry-standard database
5. **API Auto-generation:** Faster development
6. **Generous Free Tier:** Start with $0/month

**Setup Process:**
1. Create Supabase project
2. Import your current discount codes
3. Build user registration/login
4. Add payment processing (Stripe)
5. Migrate from demo to production

**Long-term (6-12 months):**
If you outgrow Supabase or need more control, migrate to dedicated infrastructure on AWS/DigitalOcean with full HIPAA compliance.

This approach gives you professional-grade infrastructure without the complexity of managing servers yourself.