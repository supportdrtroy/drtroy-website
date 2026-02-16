-- DrTroy.com Database Schema
-- Run this in your Supabase SQL editor to create all tables

-- Enable RLS (Row Level Security) by default
ALTER DATABASE postgres SET row_security = on;

-- Users table - Core user information
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profession VARCHAR(10) CHECK (profession IN ('PT', 'PTA', 'OT', 'COTA')) NOT NULL,
    license_number VARCHAR(50),
    state VARCHAR(2) DEFAULT 'TX',
    phone VARCHAR(20),
    city VARCHAR(100),
    zip_code VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) CHECK (status IN ('active', 'suspended', 'deleted')) DEFAULT 'active',
    marketing_consent BOOLEAN DEFAULT FALSE,
    referral_source VARCHAR(100)
);

-- Purchases table - All transactions
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    package_type VARCHAR(10) CHECK (package_type IN ('PT', 'PTA', 'OT', 'COTA')) NOT NULL,
    original_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    final_price DECIMAL(10,2) NOT NULL,
    discount_code VARCHAR(50),
    payment_method VARCHAR(20) CHECK (payment_method IN ('stripe', 'paypal', 'free')) NOT NULL,
    payment_id VARCHAR(100), -- Stripe/PayPal transaction ID
    payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
    device_type VARCHAR(20) DEFAULT 'unknown',
    ip_address INET,
    user_agent TEXT,
    referrer_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_amount DECIMAL(10,2) DEFAULT 0
);

-- Course progress tracking
CREATE TABLE IF NOT EXISTS course_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
    course_id VARCHAR(50) NOT NULL,
    course_name VARCHAR(200) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    time_spent_minutes INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    quiz_score INTEGER,
    passing_score INTEGER DEFAULT 80,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    certificate_issued BOOLEAN DEFAULT FALSE,
    certificate_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discount codes table - Both employee and marketing codes
CREATE TABLE IF NOT EXISTS discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) CHECK (type IN ('employee', 'marketing')) NOT NULL,
    discount_type VARCHAR(20) CHECK (discount_type IN ('percentage', 'fixed', 'free')) NOT NULL,
    discount_value INTEGER NOT NULL,
    usage_type VARCHAR(20) CHECK (usage_type IN ('single', 'limited', 'unlimited')) NOT NULL,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    applies_to VARCHAR(20) DEFAULT 'all', -- 'all', 'PT', 'PTA', 'OT', 'COTA'
    min_purchase_amount DECIMAL(10,2) DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(100),
    employee_name VARCHAR(200), -- For employee codes
    employee_type VARCHAR(50),  -- staff, contractor, partner, referral
    campaign_name VARCHAR(200), -- For marketing codes
    notes TEXT,
    status VARCHAR(20) CHECK (status IN ('active', 'expired', 'deactivated')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics events - Track all user interactions
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    page_url TEXT,
    referrer_url TEXT,
    device_type VARCHAR(20),
    browser VARCHAR(50),
    os VARCHAR(50),
    ip_address INET,
    country VARCHAR(2),
    state VARCHAR(2),
    city VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    priority VARCHAR(20) CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
    status VARCHAR(20) CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
    assigned_to VARCHAR(100),
    resolution TEXT,
    satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Email subscriptions
CREATE TABLE IF NOT EXISTS email_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    subscription_source VARCHAR(100),
    status VARCHAR(20) CHECK (status IN ('subscribed', 'unsubscribed')) DEFAULT 'subscribed'
);

-- System logs for debugging and monitoring
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_level VARCHAR(10) CHECK (log_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')) NOT NULL,
    component VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    error_details JSONB,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_profession ON users(profession);
CREATE INDEX IF NOT EXISTS idx_users_state ON users(state);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_package_type ON purchases(package_type);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);
CREATE INDEX IF NOT EXISTS idx_purchases_discount_code ON purchases(discount_code);

CREATE INDEX IF NOT EXISTS idx_course_progress_user_id ON course_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_course_progress_purchase_id ON course_progress(purchase_id);
CREATE INDEX IF NOT EXISTS idx_course_progress_status ON course_progress(status);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_type ON discount_codes(type);
CREATE INDEX IF NOT EXISTS idx_discount_codes_status ON discount_codes(status);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);

-- Purchases can only be viewed by the owner
CREATE POLICY "Users can view own purchases" ON purchases FOR SELECT USING (auth.uid() = user_id);

-- Course progress can only be viewed/updated by the owner  
CREATE POLICY "Users can view own progress" ON course_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON course_progress FOR UPDATE USING (auth.uid() = user_id);

-- Discount codes are viewable by all (for validation)
CREATE POLICY "Anyone can view active codes" ON discount_codes FOR SELECT USING (status = 'active');

-- Admin policies (you'll need to set up admin role)
-- CREATE POLICY "Admins can do everything" ON users FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_progress_updated_at BEFORE UPDATE ON course_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discount_codes_updated_at BEFORE UPDATE ON discount_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing (remove in production)
INSERT INTO discount_codes (code, type, discount_type, discount_value, usage_type, applies_to, campaign_name, notes, created_by) VALUES
('SAVE10', 'marketing', 'fixed', 10, 'unlimited', 'all', 'Default Customer Discount', 'Built-in $10 off code', 'system'),
('LAUNCH25', 'marketing', 'percentage', 25, 'limited', 'all', 'Launch Promotion', '25% off for first 100 customers', 'troyhounshell');

-- Views for analytics (computed metrics)
CREATE OR REPLACE VIEW analytics_dashboard AS
SELECT 
    -- Revenue metrics
    (SELECT COALESCE(SUM(final_price), 0) FROM purchases WHERE created_at >= date_trunc('month', CURRENT_DATE)) as monthly_revenue,
    (SELECT COALESCE(AVG(final_price), 0) FROM purchases) as avg_order_value,
    (SELECT COUNT(*) FROM users WHERE created_at >= date_trunc('month', CURRENT_DATE)) as new_customers_this_month,
    (SELECT COUNT(*) FROM users WHERE status = 'active') as total_customers,
    
    -- Conversion metrics
    (SELECT COUNT(*) FROM purchases WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as purchases_last_30d,
    (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as signups_last_30d,
    
    -- Course metrics
    (SELECT COUNT(*) FROM course_progress WHERE status = 'completed') as total_completions,
    (SELECT AVG(progress_percent) FROM course_progress WHERE status IN ('in_progress', 'completed')) as avg_progress;

COMMENT ON VIEW analytics_dashboard IS 'Real-time analytics dashboard metrics';