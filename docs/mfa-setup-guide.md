# Multi-Factor Authentication (MFA) Setup Guide

**Date:** February 18, 2026
**Priority:** HIGH — Set up within the first week

MFA adds a second layer of protection to your accounts. Even if someone gets your password, they can't log in without your phone.

---

## Recommended Authenticator App

Download **Google Authenticator** or **Microsoft Authenticator** on your phone before starting. Both are free.

---

## Accounts to Secure (in priority order)

### 1. GoDaddy (Domain Management) — CRITICAL
- **Why:** Controls your domain. If compromised, attackers can redirect your website.
- **How:** Log in → Account Settings → Security → Two-Step Verification → Enable
- **URL:** https://sso.godaddy.com/security
- **Choose:** Authenticator app (recommended over SMS)

### 2. Stripe (Payments) — CRITICAL
- **Why:** Controls your payment processing and has access to customer payment data.
- **How:** Log in → Settings → Team & Security → Two-step authentication → Enable
- **URL:** https://dashboard.stripe.com/settings/user
- **Choose:** Authenticator app

### 3. Netlify (Website Hosting) — HIGH
- **Why:** Controls your website deployments and environment variables (API keys).
- **How:** Log in → User Settings → Security → Two-factor authentication → Enable
- **URL:** https://app.netlify.com/user/security
- **Choose:** Authenticator app

### 4. GitHub (Code Repository) — HIGH
- **Why:** Contains your website source code.
- **How:** Log in → Settings → Password and authentication → Two-factor authentication → Enable
- **URL:** https://github.com/settings/security
- **Choose:** Authenticator app
- **Save recovery codes** in a secure location

### 5. Supabase (Database) — HIGH
- **Why:** Contains all user data, course records, and certificates.
- **How:** Log in → Account → Security → Enable MFA
- **URL:** https://supabase.com/dashboard/account/security
- **Choose:** Authenticator app

### 6. Resend (Email Service) — MEDIUM
- **Why:** Can send emails on behalf of your domain.
- **How:** Log in → Settings → Security → Enable 2FA
- **URL:** https://resend.com/settings
- **Choose:** Authenticator app

---

## Important Notes

1. **Save backup/recovery codes** for every account in a secure location (printed and stored safely, NOT on your computer)
2. **Do NOT use SMS** as your only MFA method — authenticator apps are more secure
3. If you lose your phone, recovery codes are the only way back in
4. Set up MFA on your **email account** (the one used for all these services) FIRST — it's the master key to everything

---

## Checklist

- [ ] Email account (Gmail/etc.) — MFA enabled
- [ ] GoDaddy — MFA enabled
- [ ] Stripe — MFA enabled
- [ ] Netlify — MFA enabled
- [ ] GitHub — MFA enabled
- [ ] Supabase — MFA enabled
- [ ] Resend — MFA enabled
- [ ] Recovery codes saved securely for all accounts
