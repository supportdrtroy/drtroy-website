// Submit Course Feedback - Stores user feedback in Supabase
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pnqoxulxdmlmbywcpbyx.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event, context) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { 
            course_id, 
            overall_rating, 
            content_quality, 
            format_rating,
            objectives_met,
            practice_relevance,
            improvements, 
            recommend,
            user_token 
        } = body;

        // Validate required fields
        if (!course_id || !overall_rating) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        // Create Supabase client with service role for admin operations
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // Verify user token and get user ID
        const { data: { user }, error: authError } = await supabase.auth.getUser(user_token);
        
        if (authError || !user) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }

        // Check if user already submitted feedback for this course
        const { data: existingFeedback } = await supabase
            .from('course_feedback')
            .select('id')
            .eq('course_id', course_id)
            .eq('user_id', user.id)
            .single();

        let result;
        
        if (existingFeedback) {
            // Update existing feedback
            result = await supabase
                .from('course_feedback')
                .update({
                    overall_rating,
                    content_quality,
                    format_rating,
                    objectives_met,
                    practice_relevance,
                    improvements,
                    recommend,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingFeedback.id)
                .select()
                .single();
        } else {
            // Insert new feedback
            result = await supabase
                .from('course_feedback')
                .insert({
                    course_id,
                    user_id: user.id,
                    overall_rating,
                    content_quality,
                    format_rating,
                    objectives_met,
                    practice_relevance,
                    improvements,
                    recommend
                })
                .select()
                .single();
        }

        if (result.error) {
            throw result.error;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: 'Feedback submitted successfully',
                data: result.data
            })
        };

    } catch (error) {
        console.error('Error submitting feedback:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message 
            })
        };
    }
};
