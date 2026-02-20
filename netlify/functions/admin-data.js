// Admin data operations with new Supabase token
exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const SUPABASE_TOKEN = 'sbp_9916e407c9d5a8ed354ff7c45bcd5a6d0112569d';
        const SUPABASE_PROJECT = 'pnqoxulxdmlmbywcpbyx';

        // Simple token validation (in production, use proper JWT validation)
        const authHeader = event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer admin-session-')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }

        if (event.httpMethod === 'GET') {
            // Get dashboard stats
            const queries = [
                'SELECT COUNT(*) as user_count FROM auth.users;',
                'SELECT COUNT(*) as profile_count FROM profiles;',
                'SELECT COUNT(*) as admin_count FROM profiles WHERE is_admin = true;'
            ];

            const results = {};
            
            for (const [index, query] of queries.entries()) {
                const response = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT}/database/query`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query })
                });
                
                const data = await response.json();
                
                if (index === 0) results.users = data[0]?.user_count || 0;
                if (index === 1) results.profiles = data[0]?.profile_count || 0;
                if (index === 2) results.admins = data[0]?.admin_count || 0;
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    stats: results
                })
            };
        }

        if (event.httpMethod === 'POST') {
            const { action, data } = JSON.parse(event.body);

            if (action === 'create_user') {
                // Create new user logic here
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        message: 'User creation feature ready to implement'
                    })
                };
            }

            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid action' })
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Admin data error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};