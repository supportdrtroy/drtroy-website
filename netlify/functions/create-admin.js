const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://pnqoxulxdmlmbywcpbyx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucW94dWx4ZG1sbWJ5d2NwYnl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2NTc1MiwiZXhwIjoyMDg2OTQxNzUyfQ.P3qGeWVSvEbp3hjBXcJHfbHKxlhNUbQdn5IIi3WEjkE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        const { email, password, name } = JSON.parse(event.body);

        // Validate input
        if (!email || !password || !name) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields' }),
            };
        }

        if (password.length < 8) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Password must be at least 8 characters' }),
            };
        }

        // Create user in Supabase Auth
        const { data: user, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: name,
                created_by: 'admin_setup'
            }
        });

        if (authError) {
            console.error('Auth error:', authError);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: authError.message }),
            };
        }

        // Create/update profile with admin privileges
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: user.user.id,
                first_name: name.split(' ')[0] || name,
                last_name: name.split(' ').slice(1).join(' ') || '',
                email: email,
                is_admin: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (profileError) {
            console.error('Profile error:', profileError);
            // Continue anyway - the auth user was created
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Admin account created successfully',
                user: {
                    id: user.user.id,
                    email: user.user.email,
                    name: name
                }
            }),
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                details: error.message
            }),
        };
    }
};