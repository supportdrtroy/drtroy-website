# Monitoring & Alerting Setup Guide

**Date:** February 18, 2026
**Priority:** MEDIUM — Set up within the first month

---

## 1. Uptime Monitoring (UptimeRobot — Free)

### Setup
1. Go to https://uptimerobot.com and create a free account
2. Add the following monitors:

| Monitor Name | URL | Type | Check Interval |
|-------------|-----|------|----------------|
| DrTroy Homepage | https://drtroy.com | HTTPS | 5 min |
| DrTroy Course Catalog | https://drtroy.com/course-catalog.html | HTTPS | 5 min |
| DrTroy Login Page | https://drtroy.com/my-account.html | HTTPS | 5 min |
| Certificate Verify | https://drtroy.com/verify.html | HTTPS | 5 min |
| Supabase API | https://pnqoxulxdmlmbywcpbyx.supabase.co/rest/v1/ | HTTPS | 5 min |

3. Set alert contacts: Troy's email + technical team email
4. Enable email and/or push notifications for downtime

### What It Tells You
- If any page goes down, you get notified within 5 minutes
- Monthly uptime percentage tracking
- Response time trends

---

## 2. Domain Expiration Monitoring

### Domains to Monitor
| Domain | Registrar | Auto-Renew |
|--------|-----------|------------|
| drtroy.com | GoDaddy | Verify ON |
| drtroy.net | GoDaddy | Verify ON |
| texastherapypros.com | GoDaddy | Verify ON |
| troyhounshell.com | GoDaddy | Verify ON |

### Setup
1. Log in to GoDaddy → My Products → Domains
2. For each domain: verify auto-renewal is ON
3. Ensure payment method on file is current
4. Set calendar reminders 90 days and 30 days before expiration for each domain
5. Add domains to UptimeRobot for DNS monitoring

---

## 3. SSL Certificate Monitoring

Netlify auto-manages SSL certificates via Let's Encrypt. However:

1. Add to UptimeRobot: Set monitors to check for valid SSL (built-in feature)
2. UptimeRobot will alert if SSL expires or has issues
3. If SSL fails: check Netlify dashboard → Domain settings → HTTPS

---

## 4. Supabase Usage Alerts

### Monitor in Supabase Dashboard
- **URL:** https://supabase.com/dashboard/project/pnqoxulxdmlmbywcpbyx/settings/billing/usage
- Check monthly:
  - Database size (free tier: 500MB)
  - Auth users count
  - Storage usage
  - API request count
  - Bandwidth usage

### Set Calendar Reminder
- Monthly check on usage to avoid hitting limits
- If approaching 80% of any limit, consider upgrading plan

---

## 5. Security Monitoring

### Failed Login Monitoring (Supabase)
- Review auth logs periodically in Supabase dashboard
- Look for: unusual number of failed attempts, attempts from unexpected locations
- Supabase Auth has built-in rate limiting

### Stripe Fraud Monitoring
- Enable Stripe Radar (built-in fraud detection)
- Review flagged payments in Stripe dashboard weekly
- Set up Stripe email notifications for disputes/chargebacks

### DMARC Report Monitoring
- Monthly review of DMARC aggregate reports
- Reports sent to: dmarc_rua@onsecureserver.net
- Look for unauthorized senders using drtroy.com

---

## Monthly Monitoring Checklist

- [ ] Check UptimeRobot dashboard — all monitors green
- [ ] Review Supabase usage — under 80% of limits
- [ ] Check Stripe dashboard — no unusual activity
- [ ] Review DMARC reports — no unauthorized senders
- [ ] Verify domain auto-renewal status
- [ ] Check SSL certificate status in UptimeRobot
- [ ] Review any security notifications from service providers
