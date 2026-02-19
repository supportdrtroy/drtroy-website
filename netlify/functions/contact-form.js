/**
 * DrTroy CE Platform — Netlify Function: contact-form
 * POST /.netlify/functions/contact-form
 * Handles contact form submissions with reCAPTCHA verification
 * Sends to support@drtroy.com with BCC to troy@drtroy.com
 */

const https = require('https');

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

// Verify reCAPTCHA token
function verifyRecaptcha(token, secretKey) {
    return new Promise((resolve, reject) => {
        const data = new URLSearchParams({
            secret: secretKey,
            response: token
        }).toString();

        const req = https.request({
            hostname: 'www.google.com',
            path: '/recaptcha/api/siteverify',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    let formData;
    try {
        // Handle both form-encoded and JSON data
        if (event.headers['content-type']?.includes('application/json')) {
            formData = JSON.parse(event.body || '{}');
        } else {
            // Parse form-encoded data
            const body = event.body || '';
            formData = {};
            body.split('&').forEach(pair => {
                const [key, value] = pair.split('=');
                if (key && value) {
                    formData[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
                }
            });
        }
    } catch (e) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Invalid form data' })
        };
    }

    const { name, email, subject, message } = formData;
    const recaptchaToken = formData['g-recaptcha-response'];

    // Validate required fields
    if (!name || !email || !message) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing required fields: name, email, message' })
        };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid email format' })
        };
    }

    // Verify reCAPTCHA (if token provided)
    if (recaptchaToken && process.env.RECAPTCHA_SECRET_KEY) {
        try {
            const recaptchaResult = await verifyRecaptcha(recaptchaToken, process.env.RECAPTCHA_SECRET_KEY);
            if (!recaptchaResult.success) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'reCAPTCHA verification failed' })
                };
            }
        } catch (e) {
            console.error('reCAPTCHA verification error:', e);
            // Continue without reCAPTCHA if there's an error (fallback)
        }
    }

    // Prepare email content
    const emailSubject = subject ? `[DrTroy Contact] ${subject}` : '[DrTroy Contact] New Message';
    const emailBody = `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #1a365d; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">New Contact Message</h2>
        <p style="margin: 10px 0 0 0; color: #e2e8f0;">DrTroy Continuing Education</p>
    </div>
    
    <div style="background: #f7fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <div style="background: white; padding: 20px; border-radius: 6px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 16px 0; color: #1a365d; border-bottom: 2px solid #059669; padding-bottom: 8px;">Contact Details</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #059669;">${email}</a></p>
            ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
            <p><strong>Submitted:</strong> ${new Date().toLocaleString('en-US', { 
                timeZone: 'America/Chicago',
                year: 'numeric',
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
            })}</p>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 6px;">
            <h3 style="margin: 0 0 16px 0; color: #1a365d; border-bottom: 2px solid #059669; padding-bottom: 8px;">Message</h3>
            <div style="background: #f8f9fa; padding: 16px; border-radius: 4px; border-left: 4px solid #059669; white-space: pre-wrap; font-family: Georgia, serif; line-height: 1.6;">${message}</div>
        </div>
    </div>
    
    <div style="margin-top: 20px; text-align: center; color: #6b7280; font-size: 14px;">
        <p>This message was sent via the DrTroy.com contact form</p>
    </div>
</div>`.trim();

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
        console.error('Missing RESEND_API_KEY environment variable');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Email service configuration error' })
        };
    }

    const emailPayload = {
        from: 'DrTroy Contact Form <no-reply@drtroy.com>',
        to: ['support@drtroy.com'],
        bcc: ['troy@drtroy.com'],
        reply_to: email,
        subject: emailSubject,
        html: emailBody
    };

    try {
        const result = await resendPost(resendApiKey, emailPayload);
        
        if (result.status === 200) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Message sent successfully' 
                })
            };
        } else {
            console.error('Resend API error:', result);
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    error: 'Failed to send message. Please try again.' 
                })
            };
        }
    } catch (error) {
        console.error('Email sending error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to send message. Please try again.' 
            })
        };
    }
};