/**
 * DrTroy CE Platform — Netlify Function: create-admin
 * POST /.netlify/functions/create-admin
 * Creates an admin user account using Supabase Management API
 */
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pnqoxulxdmlmbywcpbyx.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PROJECT_ID = 'pnqoxulxdmlmbywcpbyx';

function supabaseRequest(method, path, body, useManagementApi = false) {
    return new Promise((resolve, reject) => {
        const host = useManagementApi ? 'api.supabase.com' : 'pnqoxulxdmlmbywcpbyx.supabase.co';
        const token = useManagementApi
            ? 'sbp_9916e407c9d5a8ed354ff7c45bcd5a6d0112569d'
            : SUPABASE_SERVICE_KEY;

        const payload = body ? JSON.stringify(body) : null;
        const options = {
            hostname: host,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...(payload && { 'Content-Length': Buffer.byteLength(payload) })
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, data }); }
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { email, password, name } = JSON.parse(event.body || '{}');
        if (!email || !password || !name) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
        if (password.length < 8) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Password must be at least 8 characters' }) };

        // Create user via Supabase Auth Admin API
        const authRes = await supabaseRequest('POST', '/auth/v1/admin/users', {
            email, password,
            email_confirm: true,
            user_metadata: { full_name: name }
        });

        if (authRes.status >= 400) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: authRes.data.message || 'Failed to create user' }) };
        }

        const userId = authRes.data.id;

        // Create profile with admin flag
        await supabaseRequest('POST', '/rest/v1/profiles', {
            id: userId,
            first_name: name.split(' ')[0] || name,
            last_name: name.split(' ').slice(1).join(' ') || '',
            email: email,
            is_admin: true
        });

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: { id: userId, email, name } }) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};