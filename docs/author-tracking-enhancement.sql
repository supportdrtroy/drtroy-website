-- DrTroy CE Platform: Author Tracking & Sales Attribution Enhancement
-- Adds comprehensive author management and revenue tracking

-- ============================================================================
-- AUTHOR MANAGEMENT
-- ============================================================================

-- Authors table for content creators
CREATE TABLE authors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name VARCHAR(100) NOT NULL,
    bio TEXT,
    credentials VARCHAR(200), -- 'PT, DPT, ScD'
    email VARCHAR(255),
    phone VARCHAR(20),
    
    -- Revenue Settings
    default_royalty_percentage DECIMAL(5,2) DEFAULT 0.00, -- 0-100%
    payment_method VARCHAR(20) DEFAULT 'manual', -- 'paypal', 'stripe', 'manual'
    payment_details JSONB, -- PayPal email, bank info, etc.
    
    -- Profile
    profile_image_url TEXT,
    website_url TEXT,
    social_links JSONB, -- LinkedIn, etc.
    
    -- Business
    tax_id VARCHAR(50),
    w9_on_file BOOLEAN DEFAULT false,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'archived'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Course-Author relationships (supports multiple authors per course)
CREATE TABLE course_authors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    role VARCHAR(30) DEFAULT 'primary', -- 'primary', 'contributor', 'reviewer'
    royalty_percentage DECIMAL(5,2) DEFAULT 0.00, -- Override default
    contribution_description TEXT,
    order_index INTEGER DEFAULT 1,
    
    UNIQUE(course_id, author_id)
);

-- ============================================================================
-- ENHANCED SALES TRACKING
-- ============================================================================

-- Sales transactions with author attribution
CREATE TABLE course_sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Sale Details
    sale_price_cents INTEGER NOT NULL,
    discount_code VARCHAR(50),
    discount_amount_cents INTEGER DEFAULT 0,
    final_price_cents INTEGER NOT NULL,
    
    -- Payment
    stripe_payment_intent_id VARCHAR(100),
    payment_status VARCHAR(20) DEFAULT 'completed', -- 'pending', 'completed', 'refunded'
    
    -- Attribution
    marketing_source VARCHAR(50), -- 'organic', 'email', 'social', 'referral'
    referrer_url TEXT,
    
    -- Timestamps
    sale_date TIMESTAMPTZ DEFAULT NOW(),
    refund_date TIMESTAMPTZ,
    refund_reason TEXT
);

-- Author revenue from sales
CREATE TABLE author_revenue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES course_sales(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    
    -- Revenue Calculation
    gross_sale_amount_cents INTEGER NOT NULL,
    author_royalty_percentage DECIMAL(5,2) NOT NULL,
    author_revenue_cents INTEGER NOT NULL,
    
    -- Platform Fees
    platform_fee_cents INTEGER DEFAULT 0,
    processing_fee_cents INTEGER DEFAULT 0,
    net_author_revenue_cents INTEGER NOT NULL,
    
    -- Payout Tracking
    payout_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'held'
    payout_date TIMESTAMPTZ,
    payout_batch_id VARCHAR(100),
    payout_reference VARCHAR(100),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly author revenue summaries
CREATE TABLE author_revenue_summary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL, -- 1-12
    
    -- Sales Metrics
    total_sales_count INTEGER DEFAULT 0,
    gross_revenue_cents INTEGER DEFAULT 0,
    total_royalties_cents INTEGER DEFAULT 0,
    platform_fees_cents INTEGER DEFAULT 0,
    net_revenue_cents INTEGER DEFAULT 0,
    
    -- Course Breakdown
    course_sales_breakdown JSONB, -- {"course-id": {"sales": 5, "revenue": 12500}, ...}
    
    -- Payout Status
    payout_status VARCHAR(20) DEFAULT 'pending',
    payout_date TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(author_id, year, month)
);

-- ============================================================================
-- COURSE SCHEMA ENHANCEMENTS
-- ============================================================================

-- Add author tracking fields to existing courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS primary_author_id UUID REFERENCES authors(id);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS author_revenue_model VARCHAR(20) DEFAULT 'royalty'; -- 'royalty', 'flat_fee', 'none'

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- Author performance dashboard view
CREATE OR REPLACE VIEW author_dashboard AS
SELECT 
    a.id,
    a.author_name,
    a.credentials,
    COUNT(DISTINCT ca.course_id) as total_courses,
    COUNT(DISTINCT CASE WHEN c.status = 'published' THEN ca.course_id END) as published_courses,
    COALESCE(SUM(ars.total_sales_count), 0) as lifetime_sales,
    COALESCE(SUM(ars.gross_revenue_cents), 0) as lifetime_gross_revenue_cents,
    COALESCE(SUM(ars.net_revenue_cents), 0) as lifetime_net_revenue_cents,
    COALESCE(SUM(CASE WHEN ars.year = EXTRACT(YEAR FROM NOW()) AND ars.month = EXTRACT(MONTH FROM NOW()) 
                 THEN ars.total_sales_count END), 0) as current_month_sales,
    COALESCE(SUM(CASE WHEN ars.year = EXTRACT(YEAR FROM NOW()) AND ars.month = EXTRACT(MONTH FROM NOW()) 
                 THEN ars.net_revenue_cents END), 0) as current_month_revenue_cents,
    a.status,
    a.created_at
FROM authors a
LEFT JOIN course_authors ca ON a.id = ca.author_id
LEFT JOIN courses c ON ca.course_id = c.id
LEFT JOIN author_revenue_summary ars ON a.id = ars.author_id
GROUP BY a.id, a.author_name, a.credentials, a.status, a.created_at;

-- Course sales by author view
CREATE OR REPLACE VIEW course_sales_by_author AS
SELECT 
    c.id as course_id,
    c.title as course_title,
    a.id as author_id,
    a.author_name,
    ca.role as author_role,
    ca.royalty_percentage,
    COUNT(cs.id) as total_sales,
    COALESCE(SUM(cs.final_price_cents), 0) as gross_sales_cents,
    COALESCE(SUM(ar.net_author_revenue_cents), 0) as author_net_revenue_cents,
    AVG(cs.final_price_cents) as avg_sale_price_cents
FROM courses c
LEFT JOIN course_authors ca ON c.id = ca.course_id
LEFT JOIN authors a ON ca.author_id = a.id
LEFT JOIN course_sales cs ON c.id = cs.course_id
LEFT JOIN author_revenue ar ON cs.id = ar.sale_id AND a.id = ar.author_id
GROUP BY c.id, c.title, a.id, a.author_name, ca.role, ca.royalty_percentage;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC REVENUE CALCULATION
-- ============================================================================

-- Function to calculate and record author revenue when a sale occurs
CREATE OR REPLACE FUNCTION calculate_author_revenue()
RETURNS TRIGGER AS $$
DECLARE
    author_record RECORD;
    revenue_amount INTEGER;
    platform_fee INTEGER;
    processing_fee INTEGER;
    net_revenue INTEGER;
BEGIN
    -- Calculate revenue for each author of the sold course
    FOR author_record IN 
        SELECT ca.author_id, ca.royalty_percentage
        FROM course_authors ca
        WHERE ca.course_id = NEW.course_id
    LOOP
        -- Calculate author revenue
        revenue_amount := ROUND(NEW.final_price_cents * (author_record.royalty_percentage / 100.0));
        
        -- Calculate fees (you can adjust these)
        platform_fee := ROUND(revenue_amount * 0.10); -- 10% platform fee
        processing_fee := ROUND(NEW.final_price_cents * 0.029) + 30; -- Stripe fees: 2.9% + 30¢
        net_revenue := revenue_amount - platform_fee - processing_fee;
        
        -- Ensure net revenue isn't negative
        IF net_revenue < 0 THEN
            net_revenue := 0;
        END IF;
        
        -- Insert author revenue record
        INSERT INTO author_revenue (
            sale_id,
            author_id,
            course_id,
            gross_sale_amount_cents,
            author_royalty_percentage,
            author_revenue_cents,
            platform_fee_cents,
            processing_fee_cents,
            net_author_revenue_cents
        ) VALUES (
            NEW.id,
            author_record.author_id,
            NEW.course_id,
            NEW.final_price_cents,
            author_record.royalty_percentage,
            revenue_amount,
            platform_fee,
            processing_fee,
            net_revenue
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to calculate author revenue on each sale
CREATE TRIGGER trigger_calculate_author_revenue
    AFTER INSERT ON course_sales
    FOR EACH ROW
    EXECUTE FUNCTION calculate_author_revenue();

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Insert Dr. Troy as the primary author
INSERT INTO authors (
    author_name,
    credentials,
    email,
    bio,
    default_royalty_percentage,
    status
) VALUES (
    'Dr. Troy Hounshell',
    'PT, ScD',
    'troy@drtroy.com',
    'Physical therapist with 25+ years of experience in outpatient, inpatient, home health, and skilled nursing settings. Doctor of Science in Physical Therapy from Texas Tech University Health Sciences Center.',
    100.00, -- 100% royalty as the platform owner
    'active'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_course_authors_course_id ON course_authors(course_id);
CREATE INDEX idx_course_authors_author_id ON course_authors(author_id);
CREATE INDEX idx_course_sales_course_id ON course_sales(course_id);
CREATE INDEX idx_course_sales_user_id ON course_sales(user_id);
CREATE INDEX idx_course_sales_sale_date ON course_sales(sale_date);
CREATE INDEX idx_author_revenue_author_id ON author_revenue(author_id);
CREATE INDEX idx_author_revenue_sale_id ON author_revenue(sale_id);
CREATE INDEX idx_author_revenue_summary_author_month ON author_revenue_summary(author_id, year, month);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Authors can only see their own data
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE author_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE author_revenue_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can view own data" ON authors
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Authors can view own revenue" ON author_revenue
    FOR SELECT USING (
        author_id IN (SELECT id FROM authors WHERE user_id = auth.uid())
    );

-- Admins can see everything
CREATE POLICY "Admins can manage authors" ON authors
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can manage author revenue" ON author_revenue
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');