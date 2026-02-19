# DNS & Email Security Changes — Instructions for Troy

**Date:** February 18, 2026
**Priority:** HIGH — Complete this week

---

## What This Fixes

Your email domain (drtroy.com) currently has relaxed email security settings that could allow someone to send fake emails pretending to be from your domain. These changes harden your email authentication to protect your brand and your students.

---

## Step-by-Step Instructions (GoDaddy DNS)

### Login to GoDaddy
1. Go to https://dcc.godaddy.com/manage/drtroy.com/dns
2. Log in with your GoDaddy account (use MFA if enabled)

---

### Change 1: Update SPF Record (Prevents Email Spoofing)

**Find this existing TXT record:**
- Type: TXT
- Name: @ (or blank)
- Value contains: `v=spf1`

**Change the value to exactly:**
```
v=spf1 include:_spf-usg2.ppe-hosted.com include:secureserver.net include:amazonses.com -all
```

**What changed:** Added `include:amazonses.com` (needed for Resend email service) and changed `~all` to `-all` (hard fail instead of soft fail — tells email servers to reject unauthorized senders).

---

### Change 2: Update DMARC Record (Email Authentication Policy)

**Find this existing TXT record:**
- Type: TXT
- Name: _dmarc
- Value contains: `v=DMARC1`

**Change the value to exactly:**
```
v=DMARC1; p=quarantine; rua=mailto:dmarc_rua@onsecureserver.net
```

**What changed:** Changed `p=none` (monitor only) to `p=quarantine` (suspicious emails go to spam). This actively protects against spoofing.

---

### Change 3: Enable DNSSEC (Domain Security)

1. In GoDaddy DNS management, look for "DNSSEC" section
2. Click "Enable" or "Add DNSSEC"
3. GoDaddy will auto-generate the DS records
4. Save changes

**What this does:** Prevents DNS hijacking attacks that could redirect your domain to a malicious server.

---

## After Making Changes

### Verification (wait 1-2 hours for DNS propagation):

**Test SPF:**
- Go to https://mxtoolbox.com/spf.aspx
- Enter: drtroy.com
- Should show `v=spf1 include:_spf-usg2.ppe-hosted.com include:secureserver.net include:amazonses.com -all`
- All includes should resolve successfully

**Test DMARC:**
- Go to https://mxtoolbox.com/dmarc.aspx
- Enter: drtroy.com
- Should show policy = quarantine

**Test DNSSEC:**
- Go to https://dnsviz.net/d/drtroy.com/dnssec/
- Should show DNSSEC enabled with valid signatures

### Test Email Delivery:
After changes propagate, send a test email from the platform (e.g., a test certificate or welcome email) and verify it arrives in your inbox (not spam).

---

## Future Upgrade Path

After 2-4 weeks of monitoring DMARC reports with `p=quarantine`, if no legitimate emails are being flagged:
- Upgrade DMARC to `p=reject` for maximum protection
- Change the record to: `v=DMARC1; p=reject; rua=mailto:dmarc_rua@onsecureserver.net`

---

## Timeline

| Step | When | Who |
|------|------|-----|
| Update SPF record | This week | Troy (GoDaddy) |
| Update DMARC record | This week | Troy (GoDaddy) |
| Enable DNSSEC | This week | Troy (GoDaddy) |
| Verify changes | 1-2 hours after | Technical team |
| Test email delivery | Same day | Technical team |
| Upgrade to p=reject | 2-4 weeks later | Troy (GoDaddy) |
