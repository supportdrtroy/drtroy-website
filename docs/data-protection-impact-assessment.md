# Data Protection Impact Assessment (DPIA)
## DrTroy Continuing Education Platform

**Date:** February 18, 2026
**Assessor:** Technical Security Team
**Status:** Active

---

## 1. Overview

DrTroy Continuing Education is an online platform providing continuing education courses for licensed healthcare professionals (PT, PTA, OT, COTA). This assessment documents the personal data we process, associated risks, and protective measures.

---

## 2. Data Flows

### Data Collection Points
| Source | Data Collected | Method |
|--------|---------------|--------|
| Registration | Name, email, profession, license #, state, phone | Web form → Supabase Auth |
| Course enrollment | Course selection, enrollment date | Platform → Supabase DB |
| Course progress | Module completion, quiz scores, time spent | Platform → Supabase DB |
| Payment | Card details, billing info | Web form → Stripe (direct) |
| Certificate | Completion data, certificate ID, issue date | Platform → Supabase DB |
| Support | Email content, attachments | Email → support@drtroy.com |

### Data Storage Locations
| System | Data Stored | Location | Encryption |
|--------|------------|----------|------------|
| Supabase (PostgreSQL) | User accounts, course data, certificates | AWS US (us-east-1) | At rest + in transit |
| Stripe | Payment methods, transaction history | Stripe infrastructure (PCI DSS) | At rest + in transit |
| Resend/Amazon SES | Email addresses, email content (transient) | AWS US | In transit |
| Netlify | Access logs, IP addresses | Netlify CDN (global) | In transit |

### Data Sharing (Third Parties)
| Recipient | Data Shared | Purpose | Legal Basis |
|-----------|------------|---------|-------------|
| Stripe | Payment details, email | Payment processing | Contract |
| Resend/SES | Email, name | Transactional emails | Contract |
| Licensing boards | Certificate data, license info | CE verification (on request) | Legitimate interest / Consent |

---

## 3. Risk Assessment

### High Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Unauthorized access to user data | Low | High | RLS, auth, rate limiting, MFA on admin |
| Payment fraud | Low | High | Stripe Radar, PCI compliance (Stripe-handled) |
| Certificate fraud | Low | High | Unique IDs, verification system, audit trail |
| Email spoofing | Medium | Medium | SPF, DKIM, DMARC (hardening in progress) |

### Medium Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Data breach via compromised API key | Low | High | Key rotation schedule, env vars, no client-side secrets |
| Account takeover (user) | Low | Medium | Password policy, session management |
| Accidental data exposure | Low | Medium | File blocking rules, security headers, code review |

### Low Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DNS hijacking | Very Low | High | DNSSEC (pending), domain lock |
| DDoS | Low | Medium | Netlify CDN, rate limiting |

---

## 4. Security Measures In Place

### Technical Controls
- TLS/SSL encryption on all connections (HSTS enforced)
- Row-Level Security (RLS) on all Supabase tables
- Content Security Policy (CSP) headers
- Rate limiting on all sensitive API endpoints
- No client-side exposure of service role keys
- Blocked access to internal/development files
- Security headers: X-Frame-Options, X-XSS-Protection, X-Content-Type-Options
- Referrer-Policy and Permissions-Policy headers

### Administrative Controls
- Quarterly API key rotation schedule
- Monthly security review checklist
- Annual full security audit
- Incident response procedures documented
- MFA required on all administrative accounts

### Data Minimization
- We collect only data necessary for CE delivery and compliance
- Payment card data never touches our servers (Stripe handles directly)
- No patient health information collected or stored
- Usage analytics are minimal and first-party only

---

## 5. Data Retention & Deletion

| Data Type | Retention | Deletion Method |
|-----------|-----------|----------------|
| Active accounts | Duration of account | User-requested or inactivity (3 years) |
| Course completions | 7 years minimum | Automated after retention period |
| Certificates | Indefinite | Manual review only (verification purposes) |
| Payment records | 7 years | Automated after retention period |
| Usage logs | 24 months | Automated purge |
| Support emails | 3 years | Manual deletion |

### User Rights
- Users can request data export (JSON format) via support@drtroy.com
- Users can request account deletion (subject to CE retention requirements)
- Deletion requests processed within 30 days
- Retained data (CE records) anonymized where possible

---

## 6. Compliance Status

| Regulation | Status | Notes |
|-----------|--------|-------|
| CCPA/CPRA | ✅ Compliant | Privacy policy updated, no data sales |
| GDPR | ✅ Compliant | Privacy policy updated, rights documented |
| HIPAA | ✅ N/A (not covered entity) | Disclaimer in privacy policy |
| PCI DSS | ✅ Compliant | Payment handled entirely by Stripe |
| CE Board Requirements | ✅ Compliant | 7-year record retention, certificate verification |

---

## 7. Review Schedule

This DPIA will be reviewed:
- Annually (February)
- When new data processing activities are added
- When third-party providers change
- After any security incident

**Next Review Date:** February 2027
