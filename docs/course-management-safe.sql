-- DrTroy CE Platform: Course Management Schema (Safe Version - Won't Conflicts)
-- Use CREATE IF NOT EXISTS and skip existing items

-- Create courses table (will skip if exists)
CREATE TABLE IF NOT EXISTS courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    subtitle TEXT,
    description TEXT,
    learning_objectives TEXT[],
    target_audience VARCHAR(100)[],
    category VARCHAR(50),
    difficulty_level VARCHAR(20) DEFAULT 'intermediate',
    ceu_hours DECIMAL(3,1) NOT NULL,
    ce_category VARCHAR(30) DEFAULT 'general',
    state_approvals VARCHAR(5)[] DEFAULT ARRAY['TX'],
    approval_numbers JSONB,
    price_cents INTEGER DEFAULT 0,
    package_only BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'draft',
    featured BOOLEAN DEFAULT false,
    prerequisites JSONB,
    thumbnail_url TEXT,
    preview_video_url TEXT,
    course_materials JSONB,
    slug VARCHAR(100) UNIQUE,
    meta_title VARCHAR(60),
    meta_description VARCHAR(160),
    tags VARCHAR(50)[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    published_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1
);

-- Create other tables with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS course_modules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    estimated_duration INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_lessons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    lesson_type VARCHAR(20) DEFAULT 'content',
    content TEXT,
    video_url TEXT,
    video_duration INTEGER,
    downloadable_resources JSONB,
    order_index INTEGER NOT NULL,
    required BOOLEAN DEFAULT true,
    passing_criteria JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    assessment_type VARCHAR(20) DEFAULT 'quiz',
    passing_score INTEGER DEFAULT 80,
    max_attempts INTEGER DEFAULT 3,
    time_limit_minutes INTEGER,
    randomize_questions BOOLEAN DEFAULT true,
    show_feedback BOOLEAN DEFAULT true,
    required_for_completion BOOLEAN DEFAULT true,
    order_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessment_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES course_assessments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) DEFAULT 'multiple_choice',
    answer_options JSONB,
    correct_answer TEXT,
    explanation TEXT,
    points INTEGER DEFAULT 1,
    order_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_course_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'not_started',
    progress_percentage INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    time_spent_seconds INTEGER DEFAULT 0,
    UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS user_lesson_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT false,
    time_spent_seconds INTEGER DEFAULT 0,
    last_position INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS user_assessment_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES course_assessments(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    score_percentage INTEGER,
    passed BOOLEAN DEFAULT false,
    answers JSONB,
    time_taken_seconds INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, assessment_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS certificates (
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

CREATE TABLE IF NOT EXISTS ce_transcript_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    completion_date DATE NOT NULL,
    ceu_hours DECIMAL(3,1) NOT NULL,
    ce_category VARCHAR(30),
    state VARCHAR(5) DEFAULT 'TX',
    license_number VARCHAR(50),
    reporting_period VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (safe version)
DO $$
BEGIN
    -- Published courses policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' 
        AND tablename = 'courses' AND policyname = 'Published courses are viewable by everyone'
    ) THEN
        CREATE POLICY "Published courses are viewable by everyone" ON courses
            FOR SELECT USING (status = 'published');
    END IF;
END
$$;

-- Add author columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courses' AND column_name = 'primary_author_id'
    ) THEN
        ALTER TABLE courses ADD COLUMN primary_author_id UUID;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courses' AND column_name = 'author_revenue_model'
    ) THEN
        ALTER TABLE courses ADD COLUMN author_revenue_model VARCHAR(20) DEFAULT 'royalty';
    END IF;
END
$$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);

-- Success message
SELECT 'Course management tables created/verified successfully' as status;