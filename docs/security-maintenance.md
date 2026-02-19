# DrTroy CE — Security Maintenance Schedule & Procedures

**Last Updated:** February 18, 2026
**Owner:** Dr. Troy Hounshell / Technical Team

---

## 1. Quarterly Tasks (Every 3 Months)

### API Key Rotation
- [ ] Rotate Stripe API keys (secret key and webhook signing secret)
- [ ] Rotate Supabase service role key (if compromised or as precaution)
- [ ] Rotate Resend API key
- [ ] Rotate GitHub personal access tokens
- [ ] Update all keys in Netlify environment variables after rotation
- [ ] Test all integrations after rotation (payments, email, database, deploy)

### Security Review
- [ ] Review Netlify deploy logs for anomalies
- [ ] Review Supabase auth logs for failed login attempts
- [ ] Review Stripe dashboard for suspicious transactions
- [ ] Check for any new exposed files or paths (run security scan)
- [ ] Verify all redirect/block rules still functioning

**Schedule:** March, June, September, December (first week)

---

## 2. Monthly Tasks

### DMARC Report Review
- [ ] Check DMARC aggregate reports (rua email)
- [ ] Look for unauthorized senders using drtroy.com domain
- [ ] Verify SPF/DKIM pass rates are above 98%
- [ ] Investigate any failed authentication from legitimate senders
- [ ] Document findings and actions taken

### Platform Health Check
- [ ] Verify SSL certificate is valid (auto-renewed by Netlify)
- [ ] Check domain expiration dates (drtroy.com, drtroy.net)
- [ ] Review Supabase usage (storage, bandwidth, auth requests)
- [ ] Test certificate generation and verification flow
- [ ] Test payment flow (use Stripe test mode)

**Schedule:** First Monday of each month

---

## 3. Annual Tasks

### Full Security Audit
- [ ] Comprehensive review of all security headers
- [ ] Penetration testing or vulnerability scan
- [ ] Review all third-party integrations and data sharing
- [ ] Update Privacy Policy and Terms of Service if needed
- [ ] Review and update Data Protection Impact Assessment
- [ ] Verify compliance with CCPA/GDPR/HIPAA requirements
- [ ] Review and update incident response procedures
- [ ] Update this maintenance document

### Domain & DNS Review
- [ ] Verify DNSSEC is enabled and functioning
- [ ] Review all DNS records for accuracy
- [ ] Check domain auto-renewal status
- [ ] Verify DMARC/SPF/DKIM records are current
- [ ] Review domain registrar account security (MFA, recovery email)

**Schedule:** February (anniversary of initial security hardening)

---

## 4. Incident Response Procedures

### Suspected Data Breach
1. **Contain:** Immediately disable affected accounts/API keys
2. **Assess:** Determine scope — what data was accessed, how many users affected
3. **Notify:** Contact technical team immediately
4. **Remediate:** Rotate all affected credentials, patch vulnerability
5. **Notify Users:** If personal data was compromised, notify affected users within 72 hours (GDPR requirement)
6. **Document:** Create incident report with timeline, impact, and remediation steps
7. **Review:** Update security measures to prevent recurrence

### Suspected Email Spoofing
1. Check DMARC reports for unauthorized sender
2. Verify SPF/DKIM records are correct
3. If active spoofing: escalate DMARC policy to p=reject
4. Notify users if fraudulent emails were sent appearing to be from drtroy.com
5. Report to email service provider

### Compromised Account (Admin)
1. Immediately revoke all admin sessions
2. Rotate admin password and all API keys
3. Review audit logs for unauthorized actions
4. Check for unauthorized data exports or modifications
5. Re-enable with new credentials and MFA verified

### Compromised Account (User)
1. Lock the affected user account
2. Notify the user via alternative contact method
3. Review account activity for unauthorized changes
4. Reset password and require MFA setup
5. Check if any certificates were fraudulently issued

---

## 5. Key Contacts

| Role | Contact | For |
|------|---------|-----|
| Platform Owner | Dr. Troy Hounshell | Business decisions, compliance |
| Technical Lead | Technical Team | Infrastructure, code, deployments |
| Payment Support | Stripe Support | Payment issues, disputes |
| Email Support | Resend Support | Delivery issues |
| Domain Registrar | GoDaddy Support | DNS, domain issues |
| Hosting | Netlify Support | Deploy, SSL, CDN issues |

---

## 6. Emergency Procedures

### If the site goes down:
1. Check Netlify status page (netlifystatus.com)
2. Check DNS resolution (`dig drtroy.com`)
3. Review recent deploys in Netlify dashboard
4. Roll back to last known good deploy if needed

### If payments fail:
1. Check Stripe dashboard for system issues
2. Verify API keys are valid
3. Test with Stripe test mode
4. Check Netlify function logs for errors

### If email stops working:
1. Check Resend dashboard for delivery issues
2. Verify SPF/DKIM/DMARC DNS records
3. Check if sending limits have been reached
4. Review bounce/complaint rates
