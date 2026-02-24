-- ═════════════════════════════════════════════════════════════════════════════
-- MASTER SQL FILE - DrTroy Course Management System
-- Run this ONE file in Supabase SQL Editor
-- Safe: Uses IF NOT EXISTS everywhere
-- ═════════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- CORE COURSE TABLES (TEXT IDs to match existing courses table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_modules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
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
    order_index INTEGER NOT NULL DEFAULT 0,
    required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
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

-- ============================================================================
-- USER PROGRESS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_course_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
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

-- ============================================================================
-- CERTIFICATES & COMPLIANCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ce_transcript_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    completion_date DATE NOT NULL,
    ceu_hours DECIMAL(3,1) NOT NULL,
    ce_category VARCHAR(30),
    state VARCHAR(5) DEFAULT 'TX',
    license_number VARCHAR(50),
    reporting_period VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ANALYTICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    enrollments INTEGER DEFAULT 0,
    completions INTEGER DEFAULT 0,
    average_score DECIMAL(5,2),
    average_completion_time_minutes INTEGER,
    dropout_points JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course_id, date)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_course_modules_course_id ON course_modules(course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_course_lessons_module_id ON course_lessons(module_id, order_index);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment_id ON assessment_questions(assessment_id, order_index);
CREATE INDEX IF NOT EXISTS idx_user_course_progress_user_id ON user_course_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_course_progress_course_id ON user_course_progress(course_id);

-- ============================================================================
-- ADD MISSING COLUMNS TO EXISTING COURSES TABLE
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'subtitle') THEN
        ALTER TABLE courses ADD COLUMN subtitle TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'learning_objectives') THEN
        ALTER TABLE courses ADD COLUMN learning_objectives TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'target_audience') THEN
        ALTER TABLE courses ADD COLUMN target_audience VARCHAR(100)[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'status') THEN
        ALTER TABLE courses ADD COLUMN status VARCHAR(20) DEFAULT 'published';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'category') THEN
        ALTER TABLE courses ADD COLUMN category VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'difficulty_level') THEN
        ALTER TABLE courses ADD COLUMN difficulty_level VARCHAR(20) DEFAULT 'intermediate';
    END IF;
END
$$;

-- ============================================================================
-- ENABLE RLS ON NEW TABLES
-- ============================================================================

ALTER TABLE IF EXISTS course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS course_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assessment_questions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT '✅ All course management tables created successfully!' as status;