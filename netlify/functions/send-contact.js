/**
 * DrTroy CE Platform — Netlify Function: send-contact
 * POST /.netlify/functions/send-contact
 * Sends contact form submission to support@drtroy.com via Resend.
 */

const https = require('https');

function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function resendPost(apiKey, payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const req = https.request({
            hostname: 'api.resend.com',
            path: '/emails',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

const ALLOWED_ORIGINS = ['https://drtroy.com', 'https://www.drtroy.com'];

function getCorsHeaders(event) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
        'Vary': 'Origin',
    };
}

exports.handler = async (event) => {
    const cors = getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: cors, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { name, email, message } = body;

    if (!name || !email || !message) {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    if (!isValidEmail(email)) {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid email address' }) };
    }

    if (message.length > 5000) {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Message too long' }) };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Email service not configured' }) };

    const safeName    = name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeEmail   = email.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeMessage = message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

    const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px;">
        <div style="background:#1a365d;padding:20px 24px;border-radius:8px 8px 0 0;margin:-32px -24px 24px;">
            <h2 style="color:white;margin:0;font-size:1.2rem;">New Contact Form Message</h2>
            <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:0.85rem;">DrTroy Continuing Education</p>
        </div>
        <p style="margin:0 0 8px;font-size:0.9rem;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">From</p>
        <p style="margin:0 0 20px;font-size:1rem;color:#1a365d;font-weight:600;">${safeName} &lt;${safeEmail}&gt;</p>
        <p style="margin:0 0 8px;font-size:0.9rem;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Message</p>
        <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;color:#374151;font-size:0.95rem;line-height:1.7;">${safeMessage}</div>
        <p style="margin:20px 0 0;font-size:0.8rem;color:#94a3b8;">Reply directly to this email to respond to ${safeName}.</p>
    </div>`;

    try {
        const result = await resendPost(apiKey, {
            from:     'DrTroy CE Contact Form <no-reply@drtroy.com>',
            to:       ['support@drtroy.com'],
            reply_to: email,
            subject:  `New contact message from ${name}`,
            html
        });

        if (result.status >= 400) {
            console.error('Resend error:', result.body);
            return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Email send failed' }) };
        }

        return { statusCode: 200, headers: cors, body: JSON.stringify({ sent: true }) };
    } catch (err) {
        console.error('send-contact error:', err.message);
        return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
    }
};
