# Individual Course Sales Setup Guide

## Current Status: HIDDEN (Bundle Sales Only)

Individual course sales framework is fully built but hidden until you're ready to enable it.

## What's Ready:

### ✅ Course Database with Approval Numbers
- All 11 courses have approval numbers (DRTROY-[COURSE]-001-2024 format)
- Individual pricing set at $15 per CCU ($45 for 3-CCU courses, $30 for 2-CCU course)
- Approval numbers displayed on all course pages
- Professional course catalog page created

### ✅ Individual Purchase System
- Complete checkout flow for individual courses
- Automatic course enrollment after purchase
- Purchase history tracking
- Integration with existing user accounts

### ✅ Course Template System
- `course-template.html` - Template for creating new courses quickly
- Pre-built with approval number display
- Access control system included
- Just replace placeholders and add content

### ✅ Professional Course Catalog
- `course-catalog.html` - Beautiful catalog showing all courses
- Organized by PT-specific, OT-specific, and Core courses
- Shows approval numbers and individual pricing
- Individual purchase buttons hidden until enabled

## To Enable Individual Sales:

### Step 1: Update Configuration
In these files, change `enabled: false` to `enabled: true`:

**Files to update:**
- `my-account.html` (line ~112): `INDIVIDUAL_SALES_CONFIG.enabled = true`
- `course-catalog.html` (line ~294): `INDIVIDUAL_SALES_CONFIG.enabled = true`
- `checkout.html` (line ~96): `INDIVIDUAL_SALES_ENABLED = true`

### Step 2: Update Course Status
As you complete courses, change their status from 'coming-soon' to 'available' in:
- `my-account.html` (COURSE_DATABASE)
- `course-catalog.html` (COURSE_CATALOG)

### Step 3: Add Course URLs
Update the `url` field from '#' to the actual course file path (e.g., 'courses/mobility-001.html')

## Course Creation Workflow:

### For Each New Course:
1. **Copy the template:** `course-template.html` → `courses/[course-id].html`
2. **Replace placeholders:**
   - `[COURSE_ID]` → Actual course ID (e.g., MOBILITY-001)
   - `[COURSE_TITLE]` → Full course title
   - `[COURSE_SUBTITLE]` → Course subtitle
   - `[COURSE_CREDITS]` → Number of CCUs
   - `[APPROVAL_NUMBER]` → Approval number
   - `[COURSE_DESCRIPTION]` → Full description
   - `[COURSE_CONTENT_MODULES]` → All course modules
3. **Update course status** in databases to 'available'
4. **Test access control** with emergency function if needed

## Pricing Structure:
- **Standard:** $15 per CCU
- **New accounts:** $10 discount on individual courses
- **Bulk discount:** 15% off when buying 3+ individual courses (future feature)

## Emergency Access (Testing):
Each course page includes `grantEmergencyAccess()` function for testing:
```javascript
// In browser console:
grantEmergencyAccess();
```

## Current Course List:
1. **PT-MSK-001** - Available (3 CCUs, $45)
2. **OT-ADL-001** - Coming soon (3 CCUs, $45)
3. **MOBILITY-001** - Coming soon (3 CCUs, $45)
4. **BALANCE-001** - Coming soon (3 CCUs, $45)
5. **EXERCISE-001** - Coming soon (3 CCUs, $45)
6. **GERIATRIC-001** - Coming soon (3 CCUs, $45)
7. **DOCUMENTATION-001** - Coming soon (3 CCUs, $45)
8. **MODALITIES-001** - Coming soon (3 CCUs, $45)
9. **NEURO-001** - Coming soon (3 CCUs, $45)
10. **INFECTION-001** - Coming soon (3 CCUs, $45)
11. **EDUCATION-001** - Coming soon (2 CCUs, $30)

## When You're Ready:
Just let me know and I'll flip the switches to enable individual sales across the entire platform!