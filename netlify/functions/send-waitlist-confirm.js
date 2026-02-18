/**
 * DrTroy CE Platform — Netlify Function: send-waitlist-confirm
 * POST /.netlify/functions/send-waitlist-confirm
 * Sends a branded confirmation email via GoDaddy SMTP (nodemailer).
 * NOTE: Temporary — will switch to Resend once domain verified.
 */

const nodemailer = require('nodemailer');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, body: 'Invalid JSON' };
    }

    const { email, firstName, discipline } = body;
    if (!email) return { statusCode: 400, body: 'Missing email' };

    const name     = (firstName || '').trim() || 'there';
    const discLine = discipline && discipline !== 'prefer_not'
        ? `<p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 20px;">We've noted that you work in <strong>${discipline}</strong> — we'll make sure to highlight relevant courses for your license when we launch.</p>`
        : '';

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
            <div style="text-align:center;margin-bottom:28px;">
              <div style="font-size:52px;line-height:1;margin-bottom:12px;">🎉</div>
              <h1 style="font-size:24px;font-weight:700;color:#1a365d;margin:0;line-height:1.3;">You're on the list, ${name}!</h1>
            </div>
            <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 20px;">Thanks for signing up — you're officially on the early access list for <strong>DrTroy Continuing Education</strong>. When we launch, you'll be the first to know.</p>
            ${discLine}
            <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 24px;">Keep an eye on your inbox. We'll send you a launch alert the moment the platform goes live — along with an exclusive early-access offer reserved just for waitlist members.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:0 0 28px;">
              <tr><td style="padding:24px;">
                <p style="font-size:12px;font-weight:700;color:#1a365d;text-transform:uppercase;letter-spacing:.08em;margin:0 0 14px;">What's coming</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr><td width="24" valign="top" style="padding:0 10px 10px 0;color:#059669;font-size:16px;">✓</td><td style="padding:0 0 10px;color:#374151;font-size:14px;line-height:1.6;">Discipline-specific CCU packages for PTs, PTAs, OTs &amp; COTAs</td></tr>
                  <tr><td width="24" valign="top" style="padding:0 10px 10px 0;color:#059669;font-size:16px;">✓</td><td style="padding:0 0 10px;color:#374151;font-size:14px;line-height:1.6;">Evidence-based content authored by practicing clinicians</td></tr>
                  <tr><td width="24" valign="top" style="padding:0 10px 8px 0;color:#059669;font-size:16px;">✓</td><td style="padding:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">Complete your required hours online, at your own pace</td></tr>
                  <tr><td width="24" valign="top" style="color:#059669;font-size:16px;">✓</td><td style="color:#374151;font-size:14px;line-height:1.6;">Instant certificate upon course completion</td></tr>
                </table>
              </td></tr>
            </table>
            <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0;text-align:center;">Have a question before we launch? Reply to this email or reach us at<br><a href="mailto:support@drtroy.com" style="color:#059669;font-weight:600;">support@drtroy.com</a></p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="color:#9ca3af;font-size:12px;margin:0 0 6px;">&copy; 2026 DrTroy Continuing Education &nbsp;&middot;&nbsp; Lubbock, Texas</p>
            <p style="color:#9ca3af;font-size:12px;margin:0;"><a href="https://drtroy.com/terms.html" style="color:#9ca3af;">Terms of Service</a> &nbsp;&middot;&nbsp; You're receiving this because you signed up at drtroy.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const transporter = nodemailer.createTransport({
        host: 'p3plzcpnl507574.prod.phx3.secureserver.net',
        port: 465,
        secure: true,
        auth: {
            user: 'no-reply@drtroy.com',
            pass: 'DrTroy2026!Mail#Send'
        }
    });

    try {
        // Send confirmation to the user
        await transporter.sendMail({
            from:    '"DrTroy Continuing Education" <no-reply@drtroy.com>',
            to:      email,
            subject: `You're on the list, ${name}! 🎉 DrTroy CE is coming`,
            html
        });

        // Notify Troy
        const disciplineLabel = discipline && discipline !== 'prefer_not' ? discipline : 'not specified';
        await transporter.sendMail({
            from:    '"DrTroy Continuing Education" <no-reply@drtroy.com>',
            to:      'troy@drtroy.com',
            subject: `🎉 Another therapist joined the waitlist!`,
            html: `
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px;">
                    <h2 style="color:#1a365d;margin:0 0 16px;">New Waitlist Signup</h2>
                    <p style="color:#374151;font-size:15px;margin:0 0 8px;"><strong>Name:</strong> ${name}</p>
                    <p style="color:#374151;font-size:15px;margin:0 0 8px;"><strong>Email:</strong> ${email}</p>
                    <p style="color:#374151;font-size:15px;margin:0 0 24px;"><strong>Discipline:</strong> ${disciplineLabel}</p>
                    <p style="color:#6b7280;font-size:13px;margin:0;">DrTroy Continuing Education — drtroy.com</p>
                </div>
            `
        });

        console.log('Waitlist confirmation sent to:', email, '| Owner notified');
        return { statusCode: 200, body: JSON.stringify({ sent: true }) };
    } catch (err) {
        console.error('send-waitlist-confirm error:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
