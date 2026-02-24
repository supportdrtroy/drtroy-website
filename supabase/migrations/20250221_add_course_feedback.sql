-- Create course_feedback table
CREATE TABLE IF NOT EXISTS course_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id),
    user_id UUID REFERENCES auth.users(id),
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    content_quality INTEGER CHECK (content_quality >= 1 AND content_quality <= 5),
    format_rating INTEGER CHECK (format_rating >= 1 AND format_rating <= 5),
    objectives_met INTEGER CHECK (objectives_met >= 1 AND objectives_met <= 5),
    practice_relevance INTEGER CHECK (practice_relevance >= 1 AND practice_relevance <= 5),
    improvements TEXT,
    recommend TEXT CHECK (recommend IN ('yes', 'maybe', 'no')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE course_feedback ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own feedback
CREATE POLICY "Users can insert their own feedback"
    ON course_feedback FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own feedback
CREATE POLICY "Users can view their own feedback"
    ON course_feedback FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Allow admins to view all feedback
CREATE POLICY "Admins can view all feedback"
    ON course_feedback FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Create index for faster queries
CREATE INDEX idx_course_feedback_course_id ON course_feedback(course_id);
CREATE INDEX idx_course_feedback_user_id ON course_feedback(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_course_feedback_updated_at
    BEFORE UPDATE ON course_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
