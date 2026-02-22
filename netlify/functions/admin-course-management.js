/**
 * DrTroy CE Platform — Admin Course Management API
 * Secure server-side course operations using Supabase service role
 */

const https = require('https');

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pnqoxulxdmlmbywcpbyx.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucW94dWx4ZG1sbWJ5d2NwYnl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2NTc1MiwiZXhwIjoyMDg2OTQxNzUyfQ.P3qGeWVSvEbp3hjBXcJHfbHKxlhNUbQdn5IIi3WEjkE';

/**
 * Make a request to Supabase REST API
 */
function supabaseRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(SUPABASE_URL + path);
        
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const result = body ? JSON.parse(body) : null;
                    resolve({ status: res.statusCode, data: result });
                } catch (err) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });
        
        req.on('error', reject);
        
        if (data && (method === 'POST' || method === 'PATCH')) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

/**
 * Validate course data
 */
function validateCourseData(course) {
    const errors = [];
    
    if (!course.title || course.title.trim().length === 0) {
        errors.push('Title is required');
    }
    
    if (!course.slug || course.slug.trim().length === 0) {
        errors.push('Slug is required');
    }
    
    if (!course.ceu_hours || course.ceu_hours <= 0) {
        errors.push('CEU hours must be greater than 0');
    }
    
    if (course.ceu_hours > 50) {
        errors.push('CEU hours cannot exceed 50');
    }
    
    if (!['draft', 'review', 'published', 'retired'].includes(course.status)) {
        errors.push('Invalid status');
    }
    
    if (course.price_cents && (course.price_cents < 0 || course.price_cents > 50000)) {
        errors.push('Price must be between $0.00 and $500.00');
    }
    
    if (course.target_audience && !Array.isArray(course.target_audience)) {
        errors.push('Target audience must be an array');
    }
    
    if (course.learning_objectives && !Array.isArray(course.learning_objectives)) {
        errors.push('Learning objectives must be an array');
    }
    
    return errors;
}

/**
 * Sanitize and prepare course data for database
 */
function prepareCourseData(course) {
    // Generate slug from title if not provided
    if (!course.slug && course.title) {
        course.slug = course.title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }
    
    // Ensure arrays are properly formatted
    if (course.target_audience && !Array.isArray(course.target_audience)) {
        course.target_audience = [];
    }
    
    if (course.learning_objectives && !Array.isArray(course.learning_objectives)) {
        course.learning_objectives = [];
    }
    
    if (course.tags && !Array.isArray(course.tags)) {
        course.tags = typeof course.tags === 'string' ? 
            course.tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
    }
    
    // Set published_at timestamp when publishing
    if (course.status === 'published' && !course.published_at) {
        course.published_at = new Date().toISOString();
    }
    
    // Auto-generate meta fields if not provided
    if (!course.meta_title && course.title) {
        course.meta_title = course.title.length <= 60 ? course.title : course.title.substring(0, 57) + '...';
    }
    
    if (!course.meta_description && course.description) {
        course.meta_description = course.description.length <= 160 ? course.description : course.description.substring(0, 157) + '...';
    }
    
    return course;
}

/**
 * Main handler function
 */
exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        const method = event.httpMethod;
        const path = event.path;
        const queryParams = event.queryStringParameters || {};
        
        let body = {};
        if (event.body) {
            try {
                body = JSON.parse(event.body);
            } catch (err) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid JSON in request body' })
                };
            }
        }
        
        // Route requests based on method and action
        switch (method) {
            case 'GET':
                return await handleGetCourses(queryParams, headers);
            
            case 'POST':
                return await handleCreateCourse(body, headers);
            
            case 'PATCH':
                return await handleUpdateCourse(body, headers);
            
            case 'DELETE':
                return await handleDeleteCourse(body, headers);
            
            default:
                return {
                    statusCode: 405,
                    headers,
                    body: JSON.stringify({ error: 'Method not allowed' })
                };
        }
    } catch (error) {
        console.error('Course management error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

/**
 * Get courses with optional filtering
 */
async function handleGetCourses(params, headers) {
    try {
        let path = '/rest/v1/courses?select=*,course_modules(*,course_lessons(*)),course_assessments(*)';
        
        // Add filtering
        const filters = [];
        if (params.status) {
            filters.push(`status=eq.${params.status}`);
        }
        if (params.category) {
            filters.push(`category=eq.${params.category}`);
        }
        if (params.featured) {
            filters.push(`featured=eq.${params.featured}`);
        }
        
        if (filters.length > 0) {
            path += '&' + filters.join('&');
        }
        
        // Add ordering
        path += '&order=created_at.desc';
        
        const result = await supabaseRequest('GET', path);
        
        if (result.status !== 200) {
            throw new Error('Failed to fetch courses');
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: result.data || []
            })
        };
    } catch (error) {
        console.error('Get courses error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch courses' })
        };
    }
}

/**
 * Create a new course
 */
async function handleCreateCourse(courseData, headers) {
    try {
        // Validate input
        const errors = validateCourseData(courseData);
        if (errors.length > 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Validation failed', details: errors })
            };
        }
        
        // Prepare data
        const preparedData = prepareCourseData({ ...courseData });
        delete preparedData.id; // Remove ID for creation
        
        // Check for slug uniqueness
        const slugCheck = await supabaseRequest('GET', `/rest/v1/courses?slug=eq.${preparedData.slug}&select=id`);
        if (slugCheck.data && slugCheck.data.length > 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Slug already exists' })
            };
        }
        
        // Create course
        const result = await supabaseRequest('POST', '/rest/v1/courses', preparedData);
        
        if (result.status !== 201) {
            throw new Error('Failed to create course');
        }
        
        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
                success: true,
                data: result.data
            })
        };
    } catch (error) {
        console.error('Create course error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to create course' })
        };
    }
}

/**
 * Update an existing course
 */
async function handleUpdateCourse(courseData, headers) {
    try {
        if (!courseData.id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Course ID is required for updates' })
            };
        }
        
        // Validate input
        const errors = validateCourseData(courseData);
        if (errors.length > 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Validation failed', details: errors })
            };
        }
        
        // Prepare data
        const preparedData = prepareCourseData({ ...courseData });
        const courseId = preparedData.id;
        delete preparedData.id; // Remove ID from update data
        
        // Check for slug uniqueness (excluding current course)
        if (preparedData.slug) {
            const slugCheck = await supabaseRequest('GET', `/rest/v1/courses?slug=eq.${preparedData.slug}&id=not.eq.${courseId}&select=id`);
            if (slugCheck.data && slugCheck.data.length > 0) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Slug already exists' })
                };
            }
        }
        
        // Update course
        const result = await supabaseRequest('PATCH', `/rest/v1/courses?id=eq.${courseId}`, preparedData);
        
        if (result.status !== 200) {
            throw new Error('Failed to update course');
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: result.data
            })
        };
    } catch (error) {
        console.error('Update course error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to update course' })
        };
    }
}

/**
 * Delete a course
 */
async function handleDeleteCourse(requestData, headers) {
    try {
        if (!requestData.id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Course ID is required' })
            };
        }
        
        const courseId = requestData.id;
        
        // Check if course exists and get its status
        const courseCheck = await supabaseRequest('GET', `/rest/v1/courses?id=eq.${courseId}&select=id,status,title`);
        if (!courseCheck.data || courseCheck.data.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Course not found' })
            };
        }
        
        const course = courseCheck.data[0];
        
        // Prevent deletion of published courses with enrollments
        if (course.status === 'published') {
            const enrollmentCheck = await supabaseRequest('GET', `/rest/v1/user_course_progress?course_id=eq.${courseId}&select=id`);
            if (enrollmentCheck.data && enrollmentCheck.data.length > 0) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Cannot delete published course with enrollments. Retire the course instead.' 
                    })
                };
            }
        }
        
        // Delete course (cascade will handle related records)
        const result = await supabaseRequest('DELETE', `/rest/v1/courses?id=eq.${courseId}`);
        
        if (result.status !== 200 && result.status !== 204) {
            throw new Error('Failed to delete course');
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Course "${course.title}" deleted successfully`
            })
        };
    } catch (error) {
        console.error('Delete course error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to delete course' })
        };
    }
}