/**
 * DrTroy Continuing Education - Certificate Management System
 * 
 * This system provides a standardized way to generate, manage, and verify
 * certificates of completion for all DrTroy CE courses.
 */

class CertificateManager {
    constructor() {
        this.baseUrl = window.location.origin;
        this.certificateStorage = 'drtroy_certificates';
    }

    /**
     * Course configurations for different certificates
     */
    static courseConfigs = {
        'PT-MSK-001': {
            courseTitle: "Comprehensive Musculoskeletal Evaluation and Treatment",
            courseSubtitle: "A Systematic Regional Approach to Clinical Assessment",
            courseCode: "PT-MSK-001",
            ceuValue: "3.0",
            instructor: "Dr. Troy Hounshell, PT, ScD",
            instructorTitle: "Course Director",
            template: "msk-certificate.html"
        },
        
        // Template for new courses - copy and modify
        'TEMPLATE': {
            courseTitle: "[Course Title]",
            courseSubtitle: "[Course Subtitle]", 
            courseCode: "[COURSE-CODE]",
            ceuValue: "[CEU-VALUE]",
            instructor: "Dr. Troy Hounshell, PT, ScD",
            instructorTitle: "Course Director",
            template: "certificate-template.html"
        }
    };

    /**
     * Generate a certificate for a specific course and participant
     */
    generateCertificate(courseCode, participantData) {
        const config = CertificateManager.courseConfigs[courseCode];
        if (!config) {
            throw new Error(`Course configuration not found for: ${courseCode}`);
        }

        const certificateData = {
            certificateId: this.generateCertificateId(courseCode),
            courseCode: courseCode,
            participantName: participantData.name,
            completionDate: participantData.completionDate || new Date().toLocaleDateString(),
            scoreAchieved: participantData.score,
            generatedDate: new Date().toISOString(),
            ...config
        };

        // Save certificate to localStorage
        this.saveCertificate(certificateData);

        return certificateData;
    }

    /**
     * Generate unique certificate ID
     */
    generateCertificateId(courseCode) {
        const timestamp = Date.now();
        const randomPart = Math.random().toString(36).substr(2, 6).toUpperCase();
        const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
        
        return `${courseCode}-${yearMonth}-${randomPart}`;
    }

    /**
     * Save certificate to localStorage
     */
    saveCertificate(certificateData) {
        let savedCertificates = this.getSavedCertificates();
        
        // Remove any existing certificate for this course
        savedCertificates = savedCertificates.filter(cert => 
            cert.courseCode !== certificateData.courseCode
        );
        
        // Add new certificate
        savedCertificates.push(certificateData);
        
        localStorage.setItem(this.certificateStorage, JSON.stringify(savedCertificates));
    }

    /**
     * Get all saved certificates
     */
    getSavedCertificates() {
        const saved = localStorage.getItem(this.certificateStorage);
        return saved ? JSON.parse(saved) : [];
    }

    /**
     * Get certificate by course code
     */
    getCertificateByCode(courseCode) {
        const certificates = this.getSavedCertificates();
        return certificates.find(cert => cert.courseCode === courseCode);
    }

    /**
     * Create certificate URL with parameters
     */
    createCertificateUrl(certificateData) {
        const params = new URLSearchParams({
            name: certificateData.participantName,
            date: certificateData.completionDate,
            score: certificateData.scoreAchieved,
            id: certificateData.certificateId
        });

        return `${this.baseUrl}/certificates/${certificateData.template}?${params.toString()}`;
    }

    /**
     * Open certificate in new window
     */
    openCertificate(certificateData) {
        const url = this.createCertificateUrl(certificateData);
        window.open(url, '_blank', 'width=1100,height=850');
    }

    /**
     * Print certificate
     */
    printCertificate(certificateData) {
        const url = this.createCertificateUrl(certificateData);
        const printWindow = window.open(url, '_blank');
        
        printWindow.onload = function() {
            setTimeout(() => {
                printWindow.print();
            }, 1000);
        };
    }

    /**
     * Generate email with certificate details
     */
    emailCertificate(certificateData) {
        const subject = encodeURIComponent(`Course Completion Certificate - ${certificateData.courseCode}`);
        const body = encodeURIComponent(`I have successfully completed the following course:

Course: ${certificateData.courseTitle}
Course Code: ${certificateData.courseCode}
Completion Date: ${certificateData.completionDate}
Score: ${certificateData.scoreAchieved}%
Continuing Education Units: ${certificateData.ceuValue} CCUs
Certificate ID: ${certificateData.certificateId}

Certificate can be verified at: ${this.baseUrl}/verify/${certificateData.certificateId}
Certificate URL: ${this.createCertificateUrl(certificateData)}`);

        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }

    /**
     * Verify certificate (would connect to backend in production)
     */
    verifyCertificate(certificateId) {
        // In production, this would make an API call to verify
        const certificates = this.getSavedCertificates();
        return certificates.find(cert => cert.certificateId === certificateId);
    }

    /**
     * Export certificate data (for compliance/records)
     */
    exportCertificateData(courseCode) {
        const certificate = this.getCertificateByCode(courseCode);
        if (!certificate) return null;

        return {
            ...certificate,
            exportedDate: new Date().toISOString(),
            verificationUrl: `${this.baseUrl}/verify/${certificate.certificateId}`
        };
    }

    /**
     * Create HTML certificate content for embedding
     */
    createCertificateHTML(certificateData) {
        return `
        <div class="certificate-embed">
            <h3>Certificate of Completion</h3>
            <p><strong>Participant:</strong> ${certificateData.participantName}</p>
            <p><strong>Course:</strong> ${certificateData.courseTitle}</p>
            <p><strong>Completion Date:</strong> ${certificateData.completionDate}</p>
            <p><strong>Score:</strong> ${certificateData.scoreAchieved}%</p>
            <p><strong>CEUs:</strong> ${certificateData.ceuValue} CCUs</p>
            <p><strong>Certificate ID:</strong> ${certificateData.certificateId}</p>
        </div>
        `;
    }
}

/**
 * Course-specific certificate generators
 */
class MSKCertificateManager extends CertificateManager {
    constructor() {
        super();
        this.courseCode = 'PT-MSK-001';
    }

    generateMSKCertificate(participantData) {
        return this.generateCertificate(this.courseCode, participantData);
    }

    getMSKCertificate() {
        return this.getCertificateByCode(this.courseCode);
    }
}

/**
 * Global certificate manager instance
 */
window.DrTroyCertificates = new CertificateManager();
window.MSKCertificates = new MSKCertificateManager();

/**
 * Utility functions for course integration
 */
window.CertificateUtils = {
    /**
     * Generate and show certificate for course completion
     */
    generateCourseCertificate(courseCode, name, score, onComplete = null) {
        try {
            const certificateData = window.DrTroyCertificates.generateCertificate(courseCode, {
                name: name,
                score: score,
                completionDate: new Date().toLocaleDateString()
            });

            // Show success notification
            this.showNotification(`Certificate generated successfully for ${name}!`, 'success');

            if (onComplete) {
                onComplete(certificateData);
            }

            return certificateData;
        } catch (error) {
            this.showNotification(`Error generating certificate: ${error.message}`, 'error');
            console.error('Certificate generation error:', error);
            return null;
        }
    },

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `certificate-notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#0ea5e9'};
            color: white;
            padding: 15px 20px;
            border-radius: 6px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 400px;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after 4 seconds
        setTimeout(() => {
            notification.remove();
        }, 4000);
    },

    /**
     * Create certificate action buttons
     */
    createCertificateButtons(certificateData) {
        return `
            <div class="certificate-actions" style="text-align: center; margin: 20px 0;">
                <button onclick="window.DrTroyCertificates.printCertificate(${JSON.stringify(certificateData).replace(/"/g, '&quot;')})" 
                        class="cert-btn cert-btn-print">🖨️ Print Certificate</button>
                <button onclick="window.DrTroyCertificates.openCertificate(${JSON.stringify(certificateData).replace(/"/g, '&quot;')})" 
                        class="cert-btn cert-btn-view">👁️ View Certificate</button>
                <button onclick="window.DrTroyCertificates.emailCertificate(${JSON.stringify(certificateData).replace(/"/g, '&quot;')})" 
                        class="cert-btn cert-btn-email">📧 Email Certificate</button>
            </div>
            <style>
                .cert-btn {
                    background: #1a365d;
                    color: white;
                    border: none;
                    padding: 10px 16px;
                    margin: 5px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.3s;
                }
                .cert-btn:hover {
                    background: #2c5282;
                }
                .cert-btn-print { background: #22c55e; }
                .cert-btn-print:hover { background: #16a34a; }
                .cert-btn-email { background: #0ea5e9; }
                .cert-btn-email:hover { background: #0284c7; }
            </style>
        `;
    }
};

// Export for Node.js environments (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CertificateManager, MSKCertificateManager };
}