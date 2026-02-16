# DrTroy Certificate System Documentation

## Overview
The DrTroy Certificate Management System provides a standardized, professional approach to generating certificates of completion for all continuing education courses.

## System Components

### 1. Certificate Templates
- **Master Template**: `templates/certificate-template.html` - Base template for all courses
- **Course-Specific**: `certificates/[course]-certificate.html` - Customized for each course

### 2. Certificate Manager
- **JavaScript Library**: `js/certificate-manager.js` - Handles generation, storage, and verification
- **Global Access**: Available as `window.DrTroyCertificates`

### 3. Storage System
- **Local Storage**: Certificates saved in participant's browser
- **Verification**: Unique certificate IDs for verification
- **Export**: JSON export for compliance/records

## Creating Certificates for New Courses

### Step 1: Add Course Configuration

Edit `js/certificate-manager.js` and add your course to the `courseConfigs` object:

```javascript
'YOUR-COURSE-CODE': {
    courseTitle: "Your Course Title",
    courseSubtitle: "Course Subtitle or Description",
    courseCode: "YOUR-COURSE-CODE", 
    ceuValue: "2.5", // CEU value as string
    instructor: "Dr. Troy Hounshell, PT, ScD",
    instructorTitle: "Course Director",
    template: "your-course-certificate.html"
}
```

### Step 2: Create Course-Specific Certificate

1. Copy `certificates/msk-certificate.html` to `certificates/your-course-certificate.html`
2. Customize the following elements:

```html
<!-- Update course title -->
<div class="course-title">
    Your Course Title Here
</div>

<!-- Update course subtitle -->
<div class="certificate-text">Your Course Subtitle Here</div>

<!-- Update course code -->
<div class="detail-value">YOUR-COURSE-CODE</div>

<!-- Update CEU value -->
<div class="detail-value">2.5 CCUs</div>

<!-- Update JavaScript configuration -->
<script>
const yourCertificateConfig = {
    courseTitle: "Your Course Title",
    courseSubtitle: "Your Course Subtitle",
    courseCode: "YOUR-COURSE-CODE",
    ceuValue: "2.5",
    // ... rest of config
};
</script>
```

### Step 3: Integrate with Course Page

Add certificate functionality to your course HTML:

```html
<!-- Include certificate manager -->
<script src="../js/certificate-manager.js"></script>

<!-- Certificate generation -->
<script>
function generateCertificate() {
    const name = document.getElementById('nameInput').value.trim();
    const score = localStorage.getItem('courseScore'); // Your scoring system
    
    if (!name) {
        alert('Please enter your name for the certificate.');
        return;
    }
    
    // Generate certificate
    const certificateData = window.CertificateUtils.generateCourseCertificate(
        'YOUR-COURSE-CODE', 
        name, 
        score,
        function(certData) {
            // Success callback
            document.getElementById('certificateActions').innerHTML = 
                window.CertificateUtils.createCertificateButtons(certData);
        }
    );
}
</script>
```

## Certificate Design Guidelines

### Visual Standards
- **Colors**: Primary: #1a365d, Accent: #d69e2e
- **Font**: Georgia serif for elegance
- **Size**: 10" × 7.5" landscape for printing
- **Border**: Professional double-border design
- **Logo**: DrTroy logo in header

### Required Elements
1. **Institution Name**: "DrTroy Continuing Education"
2. **Certificate Title**: "Certificate of Completion"  
3. **Participant Name**: Prominently displayed
4. **Course Title**: Full course name
5. **Course Code**: Unique identifier
6. **Completion Date**: Date of completion
7. **Score**: Percentage achieved
8. **CEU Value**: Continuing education units
9. **Instructor Signature**: Dr. Troy Hounshell, PT, ScD
10. **Certificate ID**: Unique verification ID

### Optional Elements
- Course subtitle/description
- Institutional seal/badge
- Decorative corners
- Additional instructor credentials
- Verification URL

## Using the Certificate System

### Basic Certificate Generation
```javascript
// Generate certificate for course completion
const certificateData = window.DrTroyCertificates.generateCertificate('PT-MSK-001', {
    name: 'John Smith',
    score: '85',
    completionDate: '12/15/2024'
});
```

### Certificate Actions
```javascript
// Print certificate
window.DrTroyCertificates.printCertificate(certificateData);

// Open in new window
window.DrTroyCertificates.openCertificate(certificateData);

// Email certificate
window.DrTroyCertificates.emailCertificate(certificateData);

// Get saved certificates
const myCertificates = window.DrTroyCertificates.getSavedCertificates();
```

### Course-Specific Manager
```javascript
// For MSK course specifically
const mskManager = new MSKCertificateManager();
const mskCert = mskManager.generateMSKCertificate({
    name: 'John Smith',
    score: '85'
});
```

## Certificate Verification

### Certificate ID Format
- **Pattern**: `[COURSE-CODE]-[YYYYMM]-[RANDOM6]`
- **Example**: `PT-MSK-001-202412-A1B2C3`

### Verification Process
```javascript
// Verify certificate by ID
const isValid = window.DrTroyCertificates.verifyCertificate('PT-MSK-001-202412-A1B2C3');
```

### Verification URL
- **Format**: `https://drtroy.com/verify/[CERTIFICATE-ID]`
- **Example**: `https://drtroy.com/verify/PT-MSK-001-202412-A1B2C3`

## Example Course Integration

Here's how the MSK course integrates certificates:

```html
<!-- MSK Course Certificate Section -->
<div id="certificateSection" class="hidden">
    <div style="text-align: center; margin: 20px 0;">
        <input type="text" id="nameInput" placeholder="Enter your name for certificate">
        <button onclick="generateMSKCertificate()">Generate Certificate</button>
    </div>
    <div id="certificateActions"></div>
</div>

<script>
function generateMSKCertificate() {
    const name = document.getElementById('nameInput').value.trim();
    const score = localStorage.getItem('mskCourseScore');
    
    const certificateData = window.CertificateUtils.generateCourseCertificate(
        'PT-MSK-001',
        name,
        score,
        function(certData) {
            document.getElementById('certificateActions').innerHTML = 
                window.CertificateUtils.createCertificateButtons(certData);
        }
    );
}
</script>
```

## Course Code Standards

### Format: `[PROFESSION]-[TOPIC]-[NUMBER]`
- **PT-MSK-001**: Physical Therapy - Musculoskeletal - Course 1
- **PT-NEURO-001**: Physical Therapy - Neurology - Course 1
- **OT-HAND-001**: Occupational Therapy - Hand - Course 1
- **SLP-VOICE-001**: Speech Language Pathology - Voice - Course 1

### Course Code Registry
| Code | Course Title | CEUs | Status |
|------|-------------|------|---------|
| PT-MSK-001 | Comprehensive Musculoskeletal Evaluation | 3.0 | Active |
| PT-NEURO-001 | Neurological Assessment | 2.5 | Development |
| OT-HAND-001 | Hand Therapy Essentials | 2.0 | Planning |

## Compliance & Records

### Data Storage
- Certificates stored in participant's browser localStorage
- Export function for compliance records
- JSON format for easy data management

### HIPAA Compliance
- No personal health information stored
- Only completion records and scores
- Participant controls their own certificate data

### Professional Standards
- Meets continuing education documentation requirements
- Unique certificate IDs prevent fraud
- Professional appearance for license renewal

## Troubleshooting

### Common Issues
1. **Certificate not generating**: Check course code configuration
2. **Missing participant name**: Validate input before generation
3. **Print formatting**: Ensure print CSS is properly configured
4. **Storage issues**: Check localStorage availability

### Testing Certificates
```javascript
// Test certificate generation
const testCert = window.CertificateUtils.generateCourseCertificate(
    'PT-MSK-001',
    'Test User',
    '100'
);
console.log('Test certificate:', testCert);
```

## Future Enhancements

### Planned Features
1. **Backend Integration**: Server-side certificate storage
2. **Digital Signatures**: Cryptographic verification
3. **Batch Generation**: Multiple certificates at once
4. **Custom Branding**: Course-specific styling
5. **API Access**: Integration with LMS systems

### Customization Options
1. **Color Schemes**: Match course branding
2. **Logo Variants**: Specialty credentials
3. **Layout Options**: Portrait vs landscape
4. **Language Support**: Multi-language certificates

---

## Quick Start Checklist

For adding a new course certificate:

- [ ] Add course configuration to `certificate-manager.js`
- [ ] Copy and customize certificate HTML template
- [ ] Update course code, title, and CEU values
- [ ] Integrate certificate generation in course page
- [ ] Test certificate generation and printing
- [ ] Add course code to registry documentation
- [ ] Deploy updated files to production

---

**Need Help?** Contact the development team or refer to existing course implementations for examples.