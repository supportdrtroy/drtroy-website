// Simple admin authentication with new Supabase token
exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

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
        const { email, password } = JSON.parse(event.body);

        if (!email || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Email and password required' })
            };
        }

        // Simple password check for Troy's admin account
        if (email === 'troy@drtroy.com' && password === 'DrTroy2026!Admin') {
            // Get user data from database
            const dbResponse = await fetch('https://api.supabase.com/v1/projects/pnqoxulxdmlmbywcpbyx/database/query', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sbp_9916e407c9d5a8ed354ff7c45bcd5a6d0112569d',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: `SELECT id, email, first_name, last_name, is_admin FROM profiles WHERE email = '${email}' AND is_admin = true;`
                })
            });

            const dbData = await dbResponse.json();
            
            if (dbData && dbData[0]) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        user: dbData[0],
                        token: 'admin-session-' + Date.now()
                    })
                };
            }
        }

        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Invalid credentials' })
        };

    } catch (error) {
        console.error('Auth error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};