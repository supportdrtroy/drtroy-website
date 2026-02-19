/**
 * DrTroy Continuing Education - Certificate Management System
 * SECURITY: Client-side certificate generation has been DISABLED.
 * All certificates are issued server-side via /.netlify/functions/complete-course
 * and /.netlify/functions/issue-certificate only.
 * 
 * This file is retained for backward compatibility but all generation
 * methods are no-ops that redirect to the server-side flow.
 */

class CertificateManager {
    constructor() {
        this.baseUrl = window.location.origin;
        console.warn('[CertificateManager] Client-side certificate generation is disabled. Certificates are issued server-side only.');
    }

    // DISABLED - certificates are server-side only
    generateCertificate() {
        console.error('Client-side certificate generation is disabled for security. Certificates are issued automatically upon course completion.');
        return null;
    }

    generateCertificateId() { return null; }
    saveCertificate() { }
    getSavedCertificates() { return []; }
    getCertificateByCode() { return null; }

    createCertificateUrl(certificateData) {
        if (certificateData?.certificate_number) {
            return `${this.baseUrl}/verify.html?number=${encodeURIComponent(certificateData.certificate_number)}`;
        }
        return `${this.baseUrl}/verify.html`;
    }

    openCertificate(certificateData) {
        window.open(this.createCertificateUrl(certificateData), '_blank');
    }

    verifyCertificate(certificateId) {
        window.open(`${this.baseUrl}/verify.html?number=${encodeURIComponent(certificateId)}`, '_blank');
        return null;
    }
}

class MSKCertificateManager extends CertificateManager {
    constructor() { super(); }
    generateMSKCertificate() { return this.generateCertificate(); }
    getMSKCertificate() { return null; }
}

window.DrTroyCertificates = new CertificateManager();
window.MSKCertificates = new MSKCertificateManager();
window.CertificateUtils = {
    generateCourseCertificate() {
        console.error('Client-side certificate generation is disabled. Certificates are issued server-side upon course completion.');
        return null;
    },
    showNotification(msg, type) {
        console.log(`[Certificate] ${type}: ${msg}`);
    },
    createCertificateButtons() { return ''; }
};
