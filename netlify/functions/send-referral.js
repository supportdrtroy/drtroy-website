/**
 * DrTroy CE Platform — Netlify Function: send-referral
 * POST /.netlify/functions/send-referral
 * Sends a branded colleague invitation email via Resend REST API.
 * FROM: DrTroy Continuing Education <no-reply@drtroy.com>
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

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, body: 'Invalid JSON' };
    }

    const { to, senderName, refLink, refCode } = body;
    if (!to || !refLink) {
        return { statusCode: 400, body: 'Missing required fields' };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { statusCode: 500, body: 'Email service not configured' };

    const senderDisplay = (senderName || '').trim() || 'A colleague';

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:580px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1a365d 0%,#2c5282 100%);padding:32px 40px;text-align:center;">
            <img src="https://drtroy.com/courses/images/drtroy_logo_new.jpg" alt="DrTroy Continuing Education" style="height:56px;object-fit:contain;">
            <p style="color:rgba(255,255,255,.75);margin:10px 0 0;font-size:13px;letter-spacing:.05em;text-transform:uppercase;">Professional Continuing Education</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="font-size:24px;font-weight:700;color:#1a365d;margin:0 0 16px;line-height:1.3;">${senderDisplay} thinks you'll love DrTroy CE</h1>
            <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 20px;">Your colleague thought you'd benefit from <strong>DrTroy Continuing Education</strong> — a platform built by practicing clinicians, for practicing clinicians. All the CCUs you need for your Texas license renewal, in one place, at a fair price.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:12px;margin:24px 0;">
              <tr><td style="padding:24px;text-align:center;">
                <p style="font-size:13px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px;">Exclusive Offer for You</p>
                <p style="font-size:32px;font-weight:800;color:#059669;margin:0 0 8px;line-height:1;">$10 Off</p>
                <p style="font-size:14px;color:#166534;margin:0;">your first CE package when you sign up using this link</p>
              </td></tr>
            </table>
            <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 16px;">DrTroy CE offers discipline-specific CCU packages for <strong>PTs, PTAs, OTs, and COTAs</strong> — covering your required contact hours with content that actually applies to daily clinical practice.</p>
            <ul style="color:#4b5563;font-size:15px;line-height:1.9;padding-left:20px;margin:0 0 28px;">
              <li>Complete your required CCUs online, at your own pace</li>
              <li>Evidence-based content authored by practicing clinicians</li>
              <li>Instant certificate upon completion</li>
              <li>No upsells, no hidden fees</li>
            </ul>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:8px 0 28px;">
                <a href="${refLink}" style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:10px;letter-spacing:.02em;">Claim My $10 Discount →</a>
              </td></tr>
            </table>
            <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;text-align:center;">Or copy this link: <a href="${refLink}" style="color:#059669;word-break:break-all;">${refLink}</a></p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="color:#9ca3af;font-size:12px;margin:0 0 6px;">&copy; 2026 DrTroy Continuing Education &nbsp;&middot;&nbsp; Lubbock, Texas</p>
            <p style="color:#9ca3af;font-size:12px;margin:0;">Questions? <a href="mailto:support@drtroy.com" style="color:#059669;">support@drtroy.com</a> &nbsp;&middot;&nbsp; <a href="https://drtroy.com/terms.html" style="color:#9ca3af;">Terms of Service</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
        const result = await resendPost(apiKey, {
            from:    'DrTroy Continuing Education <no-reply@drtroy.com>',
            to:      [to],
            subject: `${senderDisplay} invited you to DrTroy CE — $10 off your first package`,
            html
        });

        console.log('Referral email sent to:', to, '| Status:', result.status);

        if (result.status >= 400) {
            console.error('Resend error:', result.body);
            return { statusCode: 500, body: JSON.stringify({ error: 'Email send failed' }) };
        }

        return { statusCode: 200, body: JSON.stringify({ sent: true }) };
    } catch (err) {
        console.error('send-referral error:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
