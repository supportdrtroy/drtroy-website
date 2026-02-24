// Get Course Feedback Statistics - Returns aggregated feedback data for admin dashboard
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pnqoxulxdmlmbywcpbyx.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event, context) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get query parameters
        const params = new URLSearchParams(event.queryStringParameters);
        const course_id = params.get('course_id');
        const user_token = event.headers.authorization?.replace('Bearer ', '');

        if (!user_token) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Unauthorized - No token provided' })
            };
        }

        // Create Supabase client
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // Verify admin status
        const { data: { user }, error: authError } = await supabase.auth.getUser(user_token);
        
        if (authError || !user) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }

        // Check if user is admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();

        if (!profile?.is_admin) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Forbidden - Admin access required' })
            };
        }

        // Build query
        let query = supabase
            .from('course_feedback')
            .select('*');

        if (course_id) {
            query = query.eq('course_id', course_id);
        }

        const { data: feedback, error } = await query;

        if (error) {
            throw error;
        }

        // Calculate statistics
        const stats = {
            total_responses: feedback.length,
            by_course: {}
        };

        // Group by course and calculate averages
        feedback.forEach(item => {
            if (!stats.by_course[item.course_id]) {
                stats.by_course[item.course_id] = {
                    course_id: item.course_id,
                    total_responses: 0,
                    overall_rating: { sum: 0, count: 0, avg: 0 },
                    content_quality: { sum: 0, count: 0, avg: 0 },
                    format_rating: { sum: 0, count: 0, avg: 0 },
                    objectives_met: { sum: 0, count: 0, avg: 0 },
                    practice_relevance: { sum: 0, count: 0, avg: 0 },
                    recommend: { yes: 0, maybe: 0, no: 0 },
                    recent_feedback: []
                };
            }

            const course = stats.by_course[item.course_id];
            course.total_responses++;

            if (item.overall_rating) {
                course.overall_rating.sum += item.overall_rating;
                course.overall_rating.count++;
            }
            if (item.content_quality) {
                course.content_quality.sum += item.content_quality;
                course.content_quality.count++;
            }
            if (item.format_rating) {
                course.format_rating.sum += item.format_rating;
                course.format_rating.count++;
            }
            if (item.objectives_met) {
                course.objectives_met.sum += item.objectives_met;
                course.objectives_met.count++;
            }
            if (item.practice_relevance) {
                course.practice_relevance.sum += item.practice_relevance;
                course.practice_relevance.count++;
            }
            if (item.recommend) {
                course.recommend[item.recommend]++;
            }

            // Add to recent feedback (keep last 5)
            if (course.recent_feedback.length < 5) {
                course.recent_feedback.push({
                    overall_rating: item.overall_rating,
                    content_quality: item.content_quality,
                    format_rating: item.format_rating,
                    objectives_met: item.objectives_met,
                    practice_relevance: item.practice_relevance,
                    recommend: item.recommend,
                    improvements: item.improvements,
                    created_at: item.created_at
                });
            }
        });

        // Calculate averages
        Object.keys(stats.by_course).forEach(courseId => {
            const course = stats.by_course[courseId];
            
            ['overall_rating', 'content_quality', 'format_rating', 'objectives_met', 'practice_relevance'].forEach(metric => {
                if (course[metric].count > 0) {
                    course[metric].avg = (course[metric].sum / course[metric].count).toFixed(2);
                }
            });
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                stats: stats
            })
        };

    } catch (error) {
        console.error('Error getting feedback stats:', error);
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
