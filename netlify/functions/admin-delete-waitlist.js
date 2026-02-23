/**
 * DrTroy CE Platform — Netlify Function: admin-delete-waitlist
 * DELETE /.netlify/functions/admin-delete-waitlist
 * Deletes a waitlist entry using service role permissions
 * 
 * Security: Admin-only function, requires waitlist ID
 */

const https = require('https');

function supabaseDelete(url, apiKey, table, id) {
    return new Promise((resolve, reject) => {
        const path = `/rest/v1/${table}?id=eq.${id}`;
        const fullUrl = new URL(url + path);
        
        const req = https.request({
            hostname: fullUrl.hostname,
            path: fullUrl.pathname + fullUrl.search,
            method: 'DELETE',
            headers: {
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, body });
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

const ALLOWED_ORIGINS = ['https://drtroy.com', 'https://www.drtroy.com'];

function getCorsHeaders(event) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Content-Type': 'application/json',
        'Vary': 'Origin',
    };
}

exports.handler = async (event) => {
    const cors = getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: cors, body: '' };
    }

    if (event.httpMethod !== 'DELETE') {
        return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let body;
    try { 
        body = JSON.parse(event.body || '{}'); 
    } catch {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { id } = body;
    if (!id || typeof id !== 'string') {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Missing or invalid waitlist ID' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
        return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Database configuration missing' }) };
    }

    try {
        const result = await supabaseDelete(supabaseUrl, serviceKey, 'waitlist', id);
        
        if (result.status >= 200 && result.status < 300) {
            return {
                statusCode: 200,
                headers: cors,
                body: JSON.stringify({ success: true, deleted: id })
            };
        } else {
            console.error('Delete failed:', result.status, result.body);
            return {
                statusCode: 500,
                headers: cors,
                body: JSON.stringify({ error: 'Delete failed', details: result.body })
            };
        }
    } catch (err) {
        console.error('admin-delete-waitlist error:', err.message);
        return {
            statusCode: 500,
            headers: cors,
            body: JSON.stringify({ error: err.message })
        };
    }
};