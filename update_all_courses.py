#!/usr/bin/env python3
"""
Add full course structure to all course files
Adds: admin controls, feedback form, final exam, certificate
"""
import re
import os

COURSES_DIR = '/Users/bane/.openclaw/workspace/supportdrtroy-site/courses'

# Course-specific data
COURSE_DATA = {
    'balance-gait-001': {
        'title': 'Balance, Gait, and Vestibular Management',
        'hours': '3.0',
        'modules': 12,
    },
    'neuro-gait-001': {
        'title': 'Neurological Gait Disorders',
        'hours': '2.5',
        'modules': 10,
    },
    'stroke-rehab-001': {
        'title': 'Stroke Rehabilitation Essentials',
        'hours': '2.0',
        'modules': 10,
    },
    'vestibular-001': {
        'title': 'Vestibular Rehabilitation',
        'hours': '2.5',
        'modules': 10,
    },
    'ortho-sports-001': {
        'title': 'Orthopedic Sports Rehabilitation',
        'hours': '2.0',
        'modules': 10,
    },
    'amputee-rehab-001': {
        'title': 'Amputee Rehabilitation',
        'hours': '1.5',
        'modules': 8,
    },
    'wound-care-001': {
        'title': 'Wound Care for Physical Therapists',
        'hours': '1.5',
        'modules': 8,
    },
    'cardiac-rehab-001': {
        'title': 'Cardiac Rehabilitation',
        'hours': '2.0',
        'modules': 10,
    },
    'pelvic-floor-001': {
        'title': 'Pelvic Floor Rehabilitation',
        'hours': '1.5',
        'modules': 8,
    },
    'pediatric-pt-001': {
        'title': 'Pediatric Physical Therapy',
        'hours': '2.0',
        'modules': 10,
    },
    'geriatric-pt-001': {
        'title': 'Geriatric Physical Therapy',
        'hours': '2.0',
        'modules': 10,
    },
    'manual-therapy-001': {
        'title': 'Manual Therapy Techniques',
        'hours': '2.5',
        'modules': 10,
    },
}

# Admin controls panel HTML
ADMIN_PANEL_HTML = '''<!-- Admin Controls Panel -->
<div id="adminControls" style="display:none;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;padding:1.5rem;border-radius:12px;margin:2rem 0;box-shadow:0 10px 30px rgba(124,58,237,0.3);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h3 style="margin:0;font-size:1.2rem;">🛡️ Admin Controls</h3>
        <span style="font-size:.85rem;opacity:.8;">Administrator Access</span>
    </div>
    <div style="display:flex;gap:1rem;flex-wrap:wrap;">
        <button onclick="adminUnlockAll()" style="background:white;color:#7c3aed;border:none;padding:.75rem 1.5rem;border-radius:8px;font-weight:600;cursor:pointer;">🔓 Unlock All Modules</button>
        <button onclick="adminResetProgress()" style="background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.4);padding:.75rem 1.5rem;border-radius:8px;font-weight:600;cursor:pointer;">🔄 Reset Progress</button>
        <button onclick="adminShowAnswers()" style="background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.4);padding:.75rem 1.5rem;border-radius:8px;font-weight:600;cursor:pointer;">👁️ Show Exam Answers</button>
    </div>
</div>
'''

def get_feedback_html(course_title):
    return f'''<!-- Course Feedback Section -->
<div id="course-feedback" class="module" style="display:none;margin-top:2rem;">
    <div class="module-header completed">
        <h2 class="module-title">⭐ Course Feedback</h2>
    </div>
    <div class="module-content active">
        <div style="background:#fef3c7;border-left:4px solid #d97706;padding:1rem;margin-bottom:1.5rem;border-radius:0 8px 8px 0;">
            <p style="margin:0;"><strong>Your feedback helps us improve!</strong> Please complete this brief evaluation before accessing your certificate.</p>
        </div>
        <form id="course-feedback-form">
            <div style="margin:20px 0;">
                <label style="display:block;font-weight:bold;margin-bottom:10px;">Overall Course Rating:</label>
                <div style="font-size:2rem;cursor:pointer;">
                    <span onclick="rateCourse(1)" class="star-rating" style="opacity:0.3;">⭐</span>
                    <span onclick="rateCourse(2)" class="star-rating" style="opacity:0.3;">⭐</span>
                    <span onclick="rateCourse(3)" class="star-rating" style="opacity:0.3;">⭐</span>
                    <span onclick="rateCourse(4)" class="star-rating" style="opacity:0.3;">⭐</span>
                    <span onclick="rateCourse(5)" class="star-rating" style="opacity:0.3;">⭐</span>
                </div>
                <input type="hidden" name="overall-rating" id="overall-rating" required>
            </div>

            <div style="margin:20px 0;">
                <label style="display:block;font-weight:bold;margin-bottom:5px;">Content Quality:</label>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;">
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="content-quality" value="5"> Excellent</label>
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="content-quality" value="4"> Good</label>
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="content-quality" value="3"> Average</label>
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="content-quality" value="2"> Poor</label>
                </div>
            </div>

            <div style="margin:20px 0;">
                <label style="display:block;font-weight:bold;margin-bottom:5px;">Learning Format (Progressive Modules):</label>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;">
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="format-rating" value="5"> Excellent</label>
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="format-rating" value="4"> Good</label>
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="format-rating" value="3"> Average</label>
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="format-rating" value="2"> Poor</label>
                </div>
            </div>

            <div style="margin:20px 0;">
                <label style="display:block;font-weight:bold;margin-bottom:5px;">Learning Objectives Were Met:</label>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;">
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="objectives-met" value="5"> Strongly Agree</label>
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="objectives-met" value="4"> Agree</label>
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="objectives-met" value="3"> Neutral</label>
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="objectives-met" value="2"> Disagree</label>
                </div>
            </div>

            <div style="margin:20px 0;">
                <label style="display:block;font-weight:bold;margin-bottom:5px;">Relevance to My Practice:</label>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;">
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="practice-relevance" value="5"> Highly Relevant</label>
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="practice-relevance" value="4"> Relevant</label>
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="practice-relevance" value="3"> Somewhat Relevant</label>
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="practice-relevance" value="2"> Minimally Relevant</label>
                </div>
            </div>

            <div style="margin:20px 0;">
                <label for="improvements" style="display:block;font-weight:bold;margin-bottom:5px;">What could be improved?</label>
                <textarea name="improvements" id="improvements" rows="4" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;"></textarea>
            </div>

            <div style="margin:20px 0;">
                <label style="display:block;font-weight:bold;margin-bottom:10px;">Would you recommend this course to colleagues?</label>
                <div style="display:flex;gap:15px;flex-wrap:wrap;">
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="recommend" value="yes" required> Yes, definitely</label>
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="recommend" value="maybe"> Maybe</label>
                    <label style="display:flex;align-items:center;gap:5px;"><input type="radio" name="recommend" value="no"> No</label>
                </div>
            </div>

            <div style="margin-top:30px;">
                <button type="button" onclick="submitFeedback()" style="background:#f59e0b;color:white;border:none;padding:1rem 2rem;border-radius:8px;font-weight:600;font-size:1.1rem;cursor:pointer;">Submit Feedback</button>
            </div>
        </form>
    </div>
</div>
'''

def get_exam_html():
    return '''<!-- Final Exam Section -->
<div id="final-assessment" class="module" style="display:none;margin-top:2rem;">
    <div class="module-header completed">
        <h2 class="module-title">📝 Final Assessment</h2>
    </div>
    <div class="module-content active">
        <div id="final-exam-content">
            <div style="background:#fef3c7;border-left:4px solid #d97706;padding:1rem;margin-bottom:2rem;border-radius:0 8px 8px 0;">
                <p style="margin:0;"><strong>Instructions:</strong> This is a 20-question multiple-choice exam. You must score at least 70% (14/20) to pass and receive your certificate. You can retake the exam if needed.</p>
            </div>
            <div id="exam-questions-container"></div>
            <div id="exam-results" style="display:none;margin-top:2rem;padding:1.5rem;border-radius:8px;"></div>
        </div>
    </div>
</div>
'''

def get_certificate_html(course_title, course_hours):
    return f'''<!-- Certificate Section -->
<div id="certificate-section" style="display:none;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);color:white;text-align:center;padding:3rem;border-radius:12px;margin:3rem 0;">
    <h2 style="font-size:2rem;margin-bottom:1rem;">🎉 Congratulations!</h2>
    <p style="font-size:1.1rem;margin-bottom:1rem;">You have successfully completed the course and passed the final exam.</p>
    <div id="certificate-content" style="background:white;color:#333;padding:2rem;border-radius:8px;margin:2rem auto;text-align:left;max-width:700px;">
        <div style="text-align:center;border:3px solid #1e3a5f;padding:2rem;background:#fff;">
            <h1 style="color:#1e3a5f;font-size:2rem;margin-bottom:1rem;">CERTIFICATE OF COMPLETION</h1>
            <p style="font-size:1.1rem;">This certifies that</p>
            <h2 style="color:#333;font-size:1.8rem;margin:1rem 0;border-bottom:2px solid #1e3a5f;padding-bottom:0.5rem;">[Participant Name]</h2>
            <p>has successfully completed the continuing education course</p>
            <h3 style="color:#059669;margin:1rem 0;">{course_title}</h3>
            <p>consisting of <strong>{course_hours} contact hours</strong> of instruction</p>
            <p style="margin-top:1.5rem;font-size:0.9rem;">DrTroy.com Continuing Education | Texas</p>
            <div style="margin-top:2rem;display:flex;justify-content:space-around;">
                <div style="text-align:center;">
                    <div style="border-top:2px solid #333;width:150px;margin:0 auto;padding-top:0.5rem;">
                        <small>Dr. Troy Hounshell, PT, ScD<br>Course Director</small>
                    </div>
                </div>
                <div style="text-align:center;">
                    <div style="border-top:2px solid #333;width:150px;margin:0 auto;padding-top:0.5rem;">
                        <small>Date Completed<br><span id="cert-completion-date"></span></small>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <button onclick="printCertificate()" style="background:#f59e0b;color:white;border:none;padding:1rem 2rem;border-radius:8px;font-size:1.1rem;font-weight:600;cursor:pointer;">📄 Print / Save Certificate</button>
</div>
'''

def process_course_file(filename):
    """Process a single course file and add full structure"""
    course_id = filename.replace('-progressive.html', '')
    filepath = os.path.join(COURSES_DIR, filename)
    
    # Skip MSK course (already has full structure)
    if course_id == 'pt-msk-001':
        print(f"Skipping {filename} - already has full structure")
        return
    
    # Get course data
    data = COURSE_DATA.get(course_id, {
        'title': course_id.replace('-', ' ').title(),
        'hours': '2.0',
        'modules': 10,
    })
    
    print(f"Processing {filename}...")
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Check if already has feedback section
    if 'course-feedback' in content:
        print(f"  Already has feedback section, skipping")
        return
    
    # Find where to insert admin panel (after body tag or progress section)
    # Insert after opening body tag or after progress section
    progress_end = content.find('<!-- Progress -->')
    if progress_end == -1:
        progress_end = content.find('<div class="progress-container">')
    if progress_end == -1:
        progress_end = content.find('<body>')
        if progress_end != -1:
            progress_end = content.find('>', progress_end) + 1
    
    if progress_end != -1:
        # Insert admin panel after progress section
        content = content[:progress_end] + '\n' + ADMIN_PANEL_HTML + '\n' + content[progress_end:]
    
    # Find where to insert feedback, exam, and certificate (before closing container or before script)
    script_start = content.find('<script>')
    if script_start == -1:
        script_start = content.find('</body>')
    
    if script_start != -1:
        # Build additions
        additions = get_feedback_html(data['title'])
        additions += get_exam_html()
        additions += get_certificate_html(data['title'], data['hours'])
        
        content = content[:script_start] + additions + '\n' + content[script_start:]
    
    # Write updated content
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"  ✓ Added full structure to {filename}")

if __name__ == '__main__':
    for filename in sorted(os.listdir(COURSES_DIR)):
        if filename.endswith('-progressive.html'):
            process_course_file(filename)
    print("\nDone! All courses now have full structure.")
