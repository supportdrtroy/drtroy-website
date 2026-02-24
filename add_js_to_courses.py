#!/usr/bin/env python3
"""
Add JavaScript functions and exam questions to all course files
"""
import re
import os

COURSES_DIR = '/Users/bane/.openclaw/workspace/supportdrtroy-site/courses'

# Exam questions for each course
EXAM_QUESTIONS = {
    'balance-gait-001': [
        {"q": "Which sensory system provides the most reliable input for balance during quiet standing?", "o": ["Vision", "Vestibular", "Proprioception", "Auditory"], "a": 2},
        {"q": "The Berg Balance Scale has a maximum score of:", "o": ["28 points", "48 points", "56 points", "100 points"], "a": 2},
        {"q": "A score below what on the Tinetti Gait and Balance Assessment indicates high fall risk?", "o": ["15", "19", "24", "28"], "a": 1},
        {"q": "Which condition is characterized by brief, intense episodes of vertigo triggered by specific head positions?", "o": ["Meniere's disease", "Vestibular neuritis", "BPPV", "Labyrinthitis"], "a": 2},
        {"q": "The Dix-Hallpike maneuver is used to diagnose:", "o": ["Meniere's disease", "Vestibular neuritis", "Posterior canal BPPV", "Labyrinthitis"], "a": 2},
        {"q": "Which gait pattern is characterized by a wide base of support?", "o": ["Parkinsonian gait", "Ataxic gait", "Hemiplegic gait", "Steppage gait"], "a": 1},
        {"q": "The Timed Up and Go (TUG) test is abnormal if longer than:", "o": ["10 seconds", "12 seconds", "15 seconds", "20 seconds"], "a": 1},
        {"q": "Which canal is most commonly affected in BPPV?", "o": ["Anterior", "Posterior", "Horizontal", "All equally"], "a": 1},
        {"q": "Meniere's disease is characterized by all EXCEPT:", "o": ["Episodic vertigo", "Fluctuating hearing loss", "Tinnitus", "Constant positional vertigo"], "a": 3},
        {"q": "The Epley maneuver treats:", "o": ["Vestibular neuritis", "Meniere's disease", "Posterior canal BPPV", "Labyrinthitis"], "a": 2},
        {"q": "Which assessment measures dynamic balance during walking?", "o": ["Berg Balance Scale", "Tinetti", "Dynamic Gait Index", "Functional Reach"], "a": 2},
        {"q": "A positive Romberg test indicates loss of:", "o": ["Visual", "Vestibular", "Proprioceptive", "Motor"], "a": 2},
        {"q": "The 6-minute walk test primarily measures:", "o": ["Balance", "Functional endurance", "Gait speed", "Strength"], "a": 1},
        {"q": "Which condition presents with acute, continuous vertigo lasting days?", "o": ["BPPV", "Meniere's", "Vestibular neuritis", "Migraine"], "a": 2},
        {"q": "Tandem stance primarily challenges:", "o": ["Static balance", "Dynamic balance", "Reactive balance", "Anticipatory"], "a": 0},
        {"q": "The Functional Gait Assessment includes how many items?", "o": ["7", "8", "10", "14"], "a": 2},
        {"q": "Canalith repositioning works by:", "o": ["Dissolving crystals", "Moving otoconia", "Reducing inflammation", "Improving blood flow"], "a": 1},
        {"q": "Which medication class treats acute vertigo?", "o": ["Antibiotics", "Vestibular suppressants", "Antidepressants", "Muscle relaxants"], "a": 1},
        {"q": "Fall risk increases with Berg score below:", "o": ["36", "40", "45", "50"], "a": 2},
        {"q": "Vestibular rehab works through:", "o": ["Strengthening eyes", "Central compensation", "Improving hearing", "Reducing inflammation"], "a": 1},
    ],
    'neuro-gait-001': [
        {"q": "Hemiplegic gait is characterized by:", "o": ["Circumduction", "Steppage", "Festination", "Ataxia"], "a": 0},
        {"q": "Parkinsonian gait includes all EXCEPT:", "o": ["Shuffling", "Festination", "Arm swing increase", "Reduced step length"], "a": 2},
        {"q": "Steppage gait results from:", "o": ["Quad weakness", "Foot drop", "Hip flexor weakness", "Cerebellar"], "a": 1},
        {"q": "Which produces scissoring gait?", "o": ["Cerebellar ataxia", "Spastic diplegia", "Parkinson's", "Neuropathy"], "a": 1},
        {"q": "Festination refers to:", "o": ["Decreasing step length, increasing speed", "Wide base", "Irregular stepping", "Dropping foot"], "a": 0},
        {"q": "Cerebellar ataxia gait shows:", "o": ["Narrow base", "Wide base, unsteadiness", "Shuffling", "Circumduction"], "a": 1},
        {"q": "Sensory ataxia is most evident when:", "o": ["Eyes open", "Eyes closed", "Walking fast", "Backward"], "a": 1},
        {"q": "UPDRS assesses:", "o": ["Balance only", "Gait only", "Motor and non-motor", "Cognition only"], "a": 2},
        {"q": "Characteristic of spasticity:", "o": ["Less resistance with fast stretch", "Velocity-dependent resistance", "No resistance", "Flaccidity"], "a": 1},
        {"q": "Freezing of gait is treated with:", "o": ["Visual/auditory cues", "Strength only", "Stretching only", "Stop meds"], "a": 0},
        {"q": "Dysdiadochokinesia is:", "o": ["Can't do rapid alternating movements", "Weakness", "Sensory loss", "Balance problems"], "a": 0},
        {"q": "Modified Ashworth Scale measures:", "o": ["Strength", "Spasticity", "Sensation", "Coordination"], "a": 1},
        {"q": "Lateral corticospinal lesions cause:", "o": ["Ipsilateral weakness", "Contralateral weakness", "Bilateral", "None"], "a": 1},
        {"q": "Baclofen treats:", "o": ["Parkinson's", "Spasticity", "Pain", "Anxiety"], "a": 1},
        {"q": "Dysmetria is tested by:", "o": ["Heel-to-shin", "Finger-to-nose", "Romberg", "Heel walk"], "a": 1},
        {"q": "PNF patterns are based on:", "o": ["Diagonal/rotational", "Straight plane", "Isolated joints", "Static"], "a": 0},
        {"q": "Hoehn and Yahr Scale classifies:", "o": ["Stroke severity", "Parkinson's progression", "SCI level", "TBI"], "a": 1},
        {"q": "Task-specific training should be:", "o": ["Non-functional", "Functional/meaningful", "Sitting only", "Avoided"], "a": 1},
        {"q": "Anterior corticospinal lesions affect:", "o": ["UE fine motor", "Trunk/proximal", "LE only", "Face"], "a": 1},
        {"q": "Wernicke's area lesion affects:", "o": ["Motor speech", "Comprehension", "Reading", "Writing"], "a": 1},
    ],
    'stroke-rehab-001': [
        {"q": "Most common stroke type:", "o": ["Hemorrhagic", "Ischemic", "Embolic", "Cryptogenic"], "a": 1},
        {"q": "Hemiparesis affects which side after left hemisphere stroke?", "o": ["Ipsilateral", "Contralateral", "Bilateral", "No pattern"], "a": 1},
        {"q": "Brunnstrom stages describe:", "o": ["Consciousness", "Motor recovery", "Cognitive stages", "Sensory return"], "a": 1},
        {"q": "Spasticity appears in Brunnstrom Stage:", "o": ["I", "II", "III", "VI"], "a": 1},
        {"q": "Acute phase rehab goal:", "o": ["Return to work", "Prevent complications", "Max independence", "Discharge"], "a": 1},
        {"q": "Shoulder subluxation due to:", "o": ["Atrophy", "Gravity and weakness", "Nerve damage", "Contracture"], "a": 1},
        {"q": "Neglect syndrome with:", "o": ["Left lesions", "Right lesions", "Brainstem", "Cerebellar"], "a": 1},
        {"q": "FIM scores range from:", "o": ["0-50", "18-126", "0-100", "1-10"], "a": 1},
        {"q": "Barthel Index assesses:", "o": ["Cognition", "ADLs", "Strength", "Sensation"], "a": 1},
        {"q": "CIMT appropriate for:", "o": ["Severe hemiplegia", "Learned non-use", "Flaccid", "Ataxia"], "a": 1},
        {"q": "Aphasia is:", "o": ["Intellectual disability", "Acquired language disorder", "Hearing loss", "Articulation"], "a": 1},
        {"q": "Modified Rankin Scale measures:", "o": ["Cognition", "Functional disability", "Motor power", "Sensation"], "a": 1},
        {"q": "Predictor of good recovery:", "o": ["Severe deficit", "Younger age", "Comorbidities", "Long stay"], "a": 1},
        {"q": "Dysphagia management includes:", "o": ["Immediate feeding", "Evaluation first", "PEG for all", "No intervention"], "a": 1},
        {"q": "Mirror therapy used for:", "o": ["Pain", "Motor and pain", "Cognition", "Sensation"], "a": 1},
        {"q": "NIHSS ranges from:", "o": ["0-10", "0-21", "0-42", "0-100"], "a": 2},
        {"q": "Pusher syndrome:", "o": ["Push from hemiplegic", "Push to hemiplegic", "Back pain", "Flexed posture"], "a": 1},
        {"q": "BWSTT used to:", "o": ["Strengthen arms", "Retrain walking", "Improve cognition", "Treat spasticity"], "a": 1},
        {"q": "Secondary prevention EXCEPT:", "o": ["Antiplatelet", "BP control", "Stop smoking", "Bed rest"], "a": 3},
        {"q": "Optimal rehab window:", "o": ["First 3-6 months", "After 1 year", "Only inpatient", "After 2 years"], "a": 0},
    ],
    'vestibular-001': [
        {"q": "Vestibular system detects:", "o": ["Light", "Sound", "Head position/movement", "Temperature"], "a": 2},
        {"q": "Semicircular canals detect:", "o": ["Linear acceleration", "Angular acceleration", "Sound", "Pressure"], "a": 1},
        {"q": "Otoliths detect:", "o": ["Rotation", "Linear acceleration/gravity", "Sound", "Light"], "a": 1},
        {"q": "VOR stands for:", "o": ["Vestibulo-ocular reflex", "Visual ocular response", "Vestibular ocular rotation", "None"], "a": 0},
        {"q": "BPPV is caused by:", "o": ["Infection", "Otolith displacement", "Tumor", "Stroke"], "a": 1},
        {"q": "Posterior canal BPPV nystagmus:", "o": ["Horizontal", "Upbeat-torsional", "Downbeat", "None"], "a": 1},
        {"q": "Epley maneuver is for:", "o": ["Anterior canal", "Posterior canal", "Horizontal canal", "All"], "a": 1},
        {"q": "Horizontal canal BPPV treated with:", "o": ["Epley", "Barbecue roll", "Brandt-Daroff", "Surgery"], "a": 1},
        {"q": "Meniere's triad includes:", "o": ["Vertigo, hearing loss, tinnitus", "Vertigo, headache, nausea", "Dizziness, vision loss, weakness", "None"], "a": 0},
        {"q": "Endolymphatic hydrops is:", "o": ["Bacterial infection", "Fluid buildup in inner ear", "Tumor", "Vascular issue"], "a": 1},
        {"q": "Vestibular neuritis affects:", "o": ["Only cochlea", "Only vestibular nerve", "Both", "Visual system"], "a": 1},
        {"q": "Acute vestibular syndrome includes:", "o": ["Slow onset dizziness", "Sudden severe vertigo", "Gradual hearing loss", "Chronic headache"], "a": 1},
        {"q": "HINTS exam is for:", "o": ["BPPV", "Stroke in AVS", "Meniere's", "Migraine"], "a": 1},
        {"q": "Gaze stabilization exercises target:", "o": ["VOR", "Balance", "Strength", "Coordination"], "a": 0},
        {"q": "X1 and X2 exercises are:", "o": ["Gaze stabilization", "Balance", "Habituation", "Strengthening"], "a": 0},
        {"q": "Brandt-Daroff exercises for:", "o": ["Anterior BPPV", "Posterior BPPV", "Horizontal BPPV", "Neuritis"], "a": 2},
        {"q": "Vestibular rehab aims to:", "o": ["Regenerate hair cells", "Promote compensation", "Cure BPPV", "Stop vertigo instantly"], "a": 1},
        {"q": "Post-concussion vestibular dysfunction:", "o": ["Is rare", "Is common", "Only occurs in athletes", "Requires surgery"], "a": 1},
        {"q": "Persistent postural-perceptual dizziness (PPPD) is:", "o": ["BPPV variant", "Chronic dizziness disorder", "Meniere's type", "Stroke sequela"], "a": 1},
        {"q": "Canal plugging surgery is for:", "o": ["Refractory BPPV", "Meniere's", "Neuritis", "Tumor"], "a": 0},
    ],
    'ortho-sports-001': [
        {"q": "ACL injury most commonly occurs with:", "o": ["Extension with valgus", "Flexion with rotation", "Hyperextension", "Direct blow"], "a": 0},
        {"q": "Rotator cuff tears most commonly involve:", "o": ["Supraspinatus", "Infraspinatus", "Subscapularis", "Teres minor"], "a": 0},
        {"q": "SLAP lesion involves:", "o": ["Labrum", "Rotator cuff", "Biceps tendon", "Capsule"], "a": 0},
        {"q": "Tommy John surgery repairs:", "o": ["Shoulder labrum", "UCL of elbow", "ACL", "Achilles"], "a": 1},
        {"q": "Meniscal tears commonly occur with:", "o": ["Flexion with rotation", "Extension", "Hyperextension", "Valgus"], "a": 0},
        {"q": "AC joint separation grades range from:", "o": ["I-III", "I-VI", "I-IV", "I-V"], "a": 0},
        {"q": "Patellofemoral pain syndrome is associated with:", "o": ["Knee valgus", "Hip abductor weakness", "Ankle stiffness", "All of the above"], "a": 3},
        {"q": "Achilles tendon rupture peak age:", "o": ["20-30", "30-40", "40-50", "50-60"], "a": 1},
        {"q": "Reverse total shoulder arthroplasty is for:", "o": ["RC tear arthropathy", "OA only", "Fracture", "Infection"], "a": 0},
        {"q": "UCL reconstruction graft most commonly from:", "o": ["Patellar tendon", "Hamstring", "Palmaris longus", "Achilles"], "a": 2},
        {"q": "Bankart lesion is:", "o": ["Anterior labral tear", "Posterior labral tear", "Rotator cuff tear", "Biceps tear"], "a": 0},
        {"q": "Hill-Sachs lesion is:", "o": ["Humeral head defect", "Glenoid defect", "Labral tear", "Capsular tear"], "a": 0},
        {"q": "O'Brien's test assesses:", "o": ["SLAP lesion", "AC joint", "Impingement", "Instability"], "a": 0},
        {"q": "Apprehension test assesses:", "o": ["Anterior instability", "Posterior instability", "Rotator cuff", "Labrum"], "a": 0},
        {"q": "Empty can test assesses:", "o": ["Supraspinatus", "Infraspinatus", "Subscapularis", "Teres minor"], "a": 0},
        {"q": "Speed's test assesses:", "o": ["Biceps tendon", "Supraspinatus", "Labrum", "AC joint"], "a": 0},
        {"q": "Lachman test assesses:", "o": ["ACL", "PCL", "MCL", "LCL"], "a": 0},
        {"q": "Pivot shift test assesses:", "o": ["ACL", "PCL", "Meniscus", "MCL"], "a": 0},
        {"q": "McMurray test assesses:", "o": ["Meniscus", "ACL", "MCL", "LCL"], "a": 0},
        {"q": "Apley compression test assesses:", "o": ["Meniscus", "ACL", "Collateral ligaments", "Patellofemoral"], "a": 0},
    ],
}

def add_js_to_course(filename):
    """Add JavaScript functions to a course file"""
    course_id = filename.replace('-progressive.html', '')
    filepath = os.path.join(COURSES_DIR, filename)
    
    if course_id == 'pt-msk-001':
        print(f"Skipping {filename} - already has full JS")
        return
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Check if already has the functions
    if 'function submitFeedback' in content:
        print(f"Already has JS functions: {filename}")
        return
    
    # Find the closing script tag
    script_end = content.rfind('</script>')
    if script_end == -1:
        print(f"No script tag found in {filename}")
        return
    
    # Get exam questions for this course
    questions = EXAM_QUESTIONS.get(course_id, EXAM_QUESTIONS.get('stroke-rehab-001', []))
    
    # Build JavaScript to add
    js_to_add = f'''
// Course-specific exam questions
var courseExamQuestions = {str(questions).replace("'", '"')};

// Rating selection
function rateCourse(rating) {{
    document.getElementById('overall-rating').value = rating;
    var stars = document.querySelectorAll('.star-rating');
    for (var i = 0; i < stars.length; i++) {{
        stars[i].style.opacity = i < rating ? '1' : '0.3';
    }}
}}

// Submit feedback
function submitFeedback() {{
    var form = document.getElementById('course-feedback-form');
    var overallRating = document.getElementById('overall-rating').value;
    
    if (!overallRating) {{
        alert('Please provide an overall course rating');
        return;
    }}
    
    // Save feedback
    var courseId = window.location.pathname.split('/').pop().replace('-progressive.html', '');
    var feedback = {{
        submitted: true,
        timestamp: new Date().toISOString()
    }};
    localStorage.setItem(courseId + '-feedback', JSON.stringify(feedback));
    
    alert('Thank you for your feedback! Final exam is now available.');
    
    // Show final exam
    document.getElementById('final-assessment').style.display = 'block';
    document.getElementById('final-exam-content').style.display = 'block';
    initFinalExam();
    
    document.getElementById('final-assessment').scrollIntoView({{ behavior: 'smooth' }});
}}

// Final exam functions
var currentExam = {{
    questions: [],
    answers: [],
    currentQuestion: 0,
    submitted: false
}};

function initFinalExam() {{
    currentExam.questions = courseExamQuestions;
    currentExam.answers = new Array(currentExam.questions.length).fill(null);
    currentExam.currentQuestion = 0;
    displayExamQuestion(0);
}}

function displayExamQuestion(index) {{
    currentExam.currentQuestion = index;
    var container = document.getElementById('exam-questions-container');
    var question = currentExam.questions[index];
    
    var html = '<div style="background:white;padding:1.5rem;border-radius:8px;margin-bottom:1rem;border:1px solid #e2e8f0;">';
    html += '<div style="font-weight:600;margin-bottom:1rem;color:#1e293b;">Question ' + (index + 1) + ' of ' + currentExam.questions.length + '</div>';
    html += '<div style="margin-bottom:1rem;font-size:1.05rem;">' + question.q + '</div>';
    html += '<div style="display:flex;flex-direction:column;gap:0.5rem;">';
    
    for (var i = 0; i < question.o.length; i++) {{
        var selected = currentExam.answers[index] === i ? 'checked' : '';
        html += '<label style="display:flex;align-items:center;padding:0.75rem;background:#f8fafc;border-radius:6px;cursor:pointer;">';
        html += '<input type="radio" name="exam-q' + index + '" value="' + i + '" ' + selected + ' onchange="recordExamAnswer(' + index + ', ' + i + ')" style="margin-right:0.75rem;">';
        html += '<span>' + String.fromCharCode(65 + i) + ') ' + question.o[i] + '</span>';
        html += '</label>';
    }}
    
    html += '</div></div>';
    
    // Navigation
    html += '<div style="display:flex;justify-content:space-between;margin-top:1.5rem;">';
    if (index > 0) {{
        html += '<button onclick="displayExamQuestion(' + (index - 1) + ')" style="padding:0.75rem 1.5rem;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">Previous</button>';
    }} else {{
        html += '<span></span>';
    }}
    
    if (index < currentExam.questions.length - 1) {{
        html += '<button onclick="displayExamQuestion(' + (index + 1) + ')" style="padding:0.75rem 1.5rem;background:#059669;color:white;border:none;border-radius:6px;cursor:pointer;">Next</button>';
    }} else {{
        html += '<button onclick="submitFinalExam()" style="padding:0.75rem 1.5rem;background:#dc2626;color:white;border:none;border-radius:6px;font-weight:600;cursor:pointer;">Submit Exam</button>';
    }}
    html += '</div>';
    
    // Progress
    var answered = currentExam.answers.filter(function(a) {{ return a !== null; }}).length;
    html += '<div style="text-align:center;margin-top:1rem;color:#64748b;">Progress: ' + answered + '/' + currentExam.questions.length + ' answered</div>';
    
    container.innerHTML = html;
}}

function recordExamAnswer(questionIndex, answerIndex) {{
    currentExam.answers[questionIndex] = answerIndex;
}}

function submitFinalExam() {{
    var correct = 0;
    for (var i = 0; i < currentExam.questions.length; i++) {{
        if (currentExam.answers[i] === currentExam.questions[i].a) {{
            correct++;
        }}
    }}
    
    var percentage = Math.round((correct / currentExam.questions.length) * 100);
    var passed = percentage >= 70;
    
    var resultsDiv = document.getElementById('exam-results');
    resultsDiv.style.display = 'block';
    resultsDiv.style.background = passed ? '#ecfdf5' : '#fef2f2';
    resultsDiv.style.border = passed ? '2px solid #10b981' : '2px solid #ef4444';
    
    var html = '<h3>' + (passed ? 'Congratulations! You Passed!' : 'Did Not Pass') + '</h3>';
    html += '<p>You scored <strong>' + correct + '/' + currentExam.questions.length + '</strong> (' + percentage + '%)</p>';
    
    if (passed) {{
        html += '<p style="color:#059669;font-weight:600;">Your certificate is now available!</p>';
        document.getElementById('certificate-section').style.display = 'block';
        
        var dateStr = new Date().toLocaleDateString('en-US', {{ year: 'numeric', month: 'long', day: 'numeric' }});
        document.getElementById('cert-completion-date').textContent = dateStr;
        
        var courseId = window.location.pathname.split('/').pop().replace('-progressive.html', '');
        localStorage.setItem(courseId + '-completed', 'true');
    }} else {{
        html += '<button onclick="retakeExam()" style="margin-top:1rem;padding:0.75rem 1.5rem;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;">Retake Exam</button>';
    }}
    
    resultsDiv.innerHTML = html;
}}

function retakeExam() {{
    currentExam.answers = new Array(currentExam.questions.length).fill(null);
    currentExam.currentQuestion = 0;
    document.getElementById('exam-results').style.display = 'none';
    displayExamQuestion(0);
}}

function printCertificate() {{
    var certContent = document.getElementById('certificate-content');
    var printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Certificate</title><style>body{{font-family:Arial;margin:20px}}</style></head><body>' + certContent.innerHTML + '</body></html>');
    printWindow.document.close();
    printWindow.print();
}}

function adminResetProgress() {{
    if (!confirm('Reset all progress?')) return;
    var courseId = window.location.pathname.split('/').pop().replace('-progressive.html', '');
    localStorage.removeItem(courseId + '-progress');
    localStorage.removeItem(courseId + '-feedback');
    localStorage.removeItem(courseId + '-completed');
    alert('Progress reset. Reloading...');
    location.reload();
}}

function adminShowAnswers() {{
    var html = '<h3>Exam Answer Key</h3>';
    for (var i = 0; i < courseExamQuestions.length; i++) {{
        var q = courseExamQuestions[i];
        html += '<div style="margin:1rem 0;padding:1rem;background:#f0fdf4;border-radius:6px;">';
        html += '<strong>Q' + (i + 1) + ':</strong> ' + q.q + '<br>';
        html += '<strong>Answer:</strong> ' + String.fromCharCode(65 + q.a) + ') ' + q.o[q.a];
        html += '</div>';
    }}
    
    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = '<div style="background:white;padding:2rem;border-radius:12px;max-width:800px;max-height:80vh;overflow-y:auto;">' + html + '<button onclick="this.parentElement.parentElement.remove()" style="margin-top:1rem;padding:0.75rem 1.5rem;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;">Close</button></div>';
    modal.onclick = function(e) {{ if (e.target === modal) modal.remove(); }};
    document.body.appendChild(modal);
}}
'''
    
    # Insert before closing script tag
    content = content[:script_end] + js_to_add + content[script_end:]
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"✓ Added JS to {filename}")

if __name__ == '__main__':
    for filename in sorted(os.listdir(COURSES_DIR)):
        if filename.endswith('-progressive.html'):
            add_js_to_course(filename)
    print("\nDone! All courses now have JavaScript functions.")
