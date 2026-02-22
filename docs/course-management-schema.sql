-- DrTroy CE Platform: Complete Course Management Schema
-- Designed for scalable continuing education with compliance tracking

-- ============================================================================
-- CORE COURSE STRUCTURE
-- ============================================================================

-- Main courses table
CREATE TABLE courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    subtitle TEXT,
    description TEXT,
    learning_objectives TEXT[],
    target_audience VARCHAR(100)[],  -- ['PT', 'OT', 'PTA', 'COTA']
    category VARCHAR(50),  -- 'musculoskeletal', 'neurological', 'ethics', etc.
    difficulty_level VARCHAR(20) DEFAULT 'intermediate',  -- 'beginner', 'intermediate', 'advanced'
    
    -- CE Credits and Compliance
    ceu_hours DECIMAL(3,1) NOT NULL,
    ce_category VARCHAR(30) DEFAULT 'general',  -- 'ethics', 'general', 'specialty'
    state_approvals VARCHAR(5)[] DEFAULT '{"TX"}',  -- Array of state codes
    approval_numbers JSONB,  -- {'TX': 'CE-2026-001', 'CA': 'CA-2026-002'}
    
    -- Pricing and Business
    price_cents INTEGER DEFAULT 0,
    package_only BOOLEAN DEFAULT false,  -- Only available in packages
    
    -- Content Management
    status VARCHAR(20) DEFAULT 'draft',  -- 'draft', 'review', 'published', 'retired'
    featured BOOLEAN DEFAULT false,
    prerequisites JSONB,  -- Course IDs and requirements
    
    -- Media and Assets
    thumbnail_url TEXT,
    preview_video_url TEXT,
    course_materials JSONB,  -- Links to PDFs, handouts, etc.
    
    -- SEO and Marketing
    slug VARCHAR(100) UNIQUE,
    meta_title VARCHAR(60),
    meta_description VARCHAR(160),
    tags VARCHAR(50)[],
    
    -- Tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    published_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1,
    
    -- Search
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
        setweight(to_tsvector('english', array_to_string(tags, ' ')), 'C')
    ) STORED
);

-- Course modules (sections within courses)
CREATE TABLE course_modules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    estimated_duration INTEGER,  -- minutes
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual lessons within modules
CREATE TABLE course_lessons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    lesson_type VARCHAR(20) DEFAULT 'content',  -- 'content', 'video', 'assessment', 'resource'
    content TEXT,  -- HTML content
    video_url TEXT,
    video_duration INTEGER,  -- seconds
    downloadable_resources JSONB,  -- Array of resource objects
    order_index INTEGER NOT NULL,
    required BOOLEAN DEFAULT true,
    passing_criteria JSONB,  -- For assessments
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ASSESSMENT SYSTEM
-- ============================================================================

-- Course assessments (quizzes, exams)
CREATE TABLE course_assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    assessment_type VARCHAR(20) DEFAULT 'quiz',  -- 'quiz', 'final_exam', 'practice'
    passing_score INTEGER DEFAULT 80,  -- Percentage
    max_attempts INTEGER DEFAULT 3,
    time_limit_minutes INTEGER,
    randomize_questions BOOLEAN DEFAULT true,
    show_feedback BOOLEAN DEFAULT true,
    required_for_completion BOOLEAN DEFAULT true,
    order_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assessment questions
CREATE TABLE assessment_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES course_assessments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) DEFAULT 'multiple_choice',  -- 'multiple_choice', 'true_false', 'essay'
    answer_options JSONB,  -- For multiple choice: [{"text": "Option A", "correct": true}]
    correct_answer TEXT,
    explanation TEXT,
    points INTEGER DEFAULT 1,
    order_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- USER PROGRESS TRACKING
-- ============================================================================

-- Overall course progress
CREATE TABLE user_course_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'not_started',  -- 'not_started', 'in_progress', 'completed', 'failed'
    progress_percentage INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    time_spent_seconds INTEGER DEFAULT 0,
    
    UNIQUE(user_id, course_id)
);

-- Detailed lesson progress
CREATE TABLE user_lesson_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT false,
    time_spent_seconds INTEGER DEFAULT 0,
    last_position INTEGER DEFAULT 0,  -- For video position tracking
    completed_at TIMESTAMPTZ,
    
    UNIQUE(user_id, lesson_id)
);

-- Assessment attempts and scoring
CREATE TABLE user_assessment_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES course_assessments(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    score_percentage INTEGER,
    passed BOOLEAN DEFAULT false,
    answers JSONB,  -- User's answers
    time_taken_seconds INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    UNIQUE(user_id, assessment_id, attempt_number)
);

-- ============================================================================
-- CERTIFICATES AND COMPLIANCE
-- ============================================================================

-- Generated certificates
CREATE TABLE certificates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    certificate_number VARCHAR(50) UNIQUE NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    pdf_url TEXT,
    verification_hash VARCHAR(64) UNIQUE,
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    
    UNIQUE(user_id, course_id)
);

-- CE transcript for compliance tracking
CREATE TABLE ce_transcript_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    completion_date DATE NOT NULL,
    ceu_hours DECIMAL(3,1) NOT NULL,
    ce_category VARCHAR(30),
    state VARCHAR(5) DEFAULT 'TX',
    license_number VARCHAR(50),
    reporting_period VARCHAR(20),  -- '2026-2028'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CONTENT ANALYTICS
-- ============================================================================

-- Course completion analytics
CREATE TABLE course_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    enrollments INTEGER DEFAULT 0,
    completions INTEGER DEFAULT 0,
    average_score DECIMAL(5,2),
    average_completion_time_minutes INTEGER,
    dropout_points JSONB,  -- Common exit points
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(course_id, date)
);

-- User engagement tracking
CREATE TABLE user_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES course_lessons(id) ON DELETE CASCADE,
    activity_type VARCHAR(30) NOT NULL,  -- 'lesson_start', 'lesson_complete', 'assessment_start', etc.
    session_id VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Course indexes
CREATE INDEX idx_courses_status ON courses(status);
CREATE INDEX idx_courses_target_audience ON courses USING GIN(target_audience);
CREATE INDEX idx_courses_category ON courses(category);
CREATE INDEX idx_courses_search ON courses USING GIN(search_vector);

-- Module and lesson indexes
CREATE INDEX idx_course_modules_course_id ON course_modules(course_id, order_index);
CREATE INDEX idx_course_lessons_module_id ON course_lessons(module_id, order_index);

-- Progress tracking indexes
CREATE INDEX idx_user_course_progress_user_id ON user_course_progress(user_id);
CREATE INDEX idx_user_course_progress_course_id ON user_course_progress(course_id);
CREATE INDEX idx_user_lesson_progress_user_id ON user_lesson_progress(user_id);

-- Assessment indexes
CREATE INDEX idx_assessment_questions_assessment_id ON assessment_questions(assessment_id, order_index);
CREATE INDEX idx_user_assessment_attempts_user_assessment ON user_assessment_attempts(user_id, assessment_id);

-- Certificate indexes
CREATE INDEX idx_certificates_user_id ON certificates(user_id);
CREATE INDEX idx_certificates_verification_hash ON certificates(verification_hash);

-- Analytics indexes
CREATE INDEX idx_course_analytics_date ON course_analytics(date);
CREATE INDEX idx_user_activity_log_user_course ON user_activity_log(user_id, course_id, created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_transcript_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- Courses: Published courses visible to all, drafts only to admins
CREATE POLICY "Published courses are viewable by everyone" ON courses
    FOR SELECT USING (status = 'published');

CREATE POLICY "Admins can manage all courses" ON courses
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Progress: Users can only see their own progress
CREATE POLICY "Users can view own progress" ON user_course_progress
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own lesson progress" ON user_lesson_progress
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own assessment attempts" ON user_assessment_attempts
    FOR ALL USING (auth.uid() = user_id);

-- Certificates: Users can view their own certificates
CREATE POLICY "Users can view own certificates" ON certificates
    FOR SELECT USING (auth.uid() = user_id);

-- Additional policies for other tables would be similar...

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATING
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate certificate numbers
CREATE OR REPLACE FUNCTION generate_certificate_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.certificate_number = 'DRTROY-' || TO_CHAR(NEW.issued_at, 'YYYY') || '-' || 
                             LPAD(EXTRACT(DOY FROM NEW.issued_at)::TEXT, 3, '0') || '-' ||
                             LPAD(EXTRACT(EPOCH FROM NEW.issued_at)::INTEGER % 10000, 4, '0');
    NEW.verification_hash = encode(digest(NEW.certificate_number || NEW.user_id::TEXT || NEW.course_id::TEXT, 'sha256'), 'hex');
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER generate_certificate_number_trigger BEFORE INSERT ON certificates
    FOR EACH ROW EXECUTE FUNCTION generate_certificate_number();

-- ============================================================================
-- SAMPLE DATA FOR DEVELOPMENT
-- ============================================================================

-- Insert sample course
INSERT INTO courses (
    title,
    subtitle,
    description,
    learning_objectives,
    target_audience,
    category,
    ceu_hours,
    price_cents,
    status,
    slug
) VALUES (
    'Advanced Musculoskeletal Assessment',
    'Evidence-based evaluation techniques for complex orthopedic conditions',
    'Comprehensive course covering advanced assessment techniques for musculoskeletal conditions commonly seen in outpatient physical therapy practice.',
    ARRAY['Perform advanced orthopedic special tests', 'Interpret imaging findings', 'Develop differential diagnoses'],
    ARRAY['PT', 'PTA'],
    'musculoskeletal',
    3.0,
    4900,  -- $49.00
    'published',
    'advanced-msk-assessment'
);