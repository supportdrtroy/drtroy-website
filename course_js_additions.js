// Rating selection
function rateCourse(rating) {
    document.getElementById('overall-rating').value = rating;
    const stars = document.querySelectorAll('.star-rating');
    stars.forEach((star, index) => {
        star.style.opacity = index < rating ? '1' : '0.3';
    });
}

// Course feedback state
let courseFeedbackSubmitted = false;

// Submit feedback
async function submitFeedback() {
    const form = document.getElementById('course-feedback-form');
    const formData = new FormData(form);
    
    if (!formData.get('overall-rating')) {
        showNotification('Please provide an overall course rating');
        return;
    }
    
    // Get course ID from URL or page
    const courseId = window.location.pathname.split('/').pop().replace('-progressive.html', '');
    
    const feedback = {
        course_id: courseId,
        overall_rating: parseInt(formData.get('overall-rating')),
        content_quality: parseInt(formData.get('content-quality')),
        format_rating: parseInt(formData.get('format-rating')),
        objectives_met: parseInt(formData.get('objectives-met')),
        practice_relevance: parseInt(formData.get('practice-relevance')),
        improvements: formData.get('improvements'),
        recommend: formData.get('recommend'),
        submitted_at: new Date().toISOString()
    };
    
    // Save to localStorage for now (will be synced to database)
    localStorage.setItem(courseId + '-feedback', JSON.stringify(feedback));
    courseFeedbackSubmitted = true;
    
    showNotification('Thank you for your feedback! Final exam is now available.');
    
    // Show final exam
    document.getElementById('final-assessment').style.display = 'block';
    document.getElementById('final-exam-content').style.display = 'block';
    initFinalExam();
    
    // Scroll to exam
    setTimeout(() => {
        document.getElementById('final-assessment').scrollIntoView({ behavior: 'smooth' });
    }, 500);
}

// Final exam state
let currentExam = {
    questions: [],
    answers: [],
    currentQuestion: 0,
    submitted: false
};

// Initialize final exam
function initFinalExam() {
    const courseId = window.location.pathname.split('/').pop().replace('-progressive.html', '');
    currentExam.questions = getExamQuestions(courseId);
    currentExam.answers = new Array(currentExam.questions.length).fill(null);
    currentExam.currentQuestion = 0;
    currentExam.submitted = false;
    
    displayExamQuestion(0);
}

// Get exam questions based on course
function getExamQuestions(courseId) {
    const examQuestions = {
        'balance-gait-001': [
            {"question": "Which sensory system provides the most reliable input for balance during quiet standing?", "options": ["Vision", "Vestibular", "Proprioception", "Auditory"], "correct": 2},
            {"question": "The Berg Balance Scale has a maximum score of:", "options": ["28 points", "48 points", "56 points", "100 points"], "correct": 2},
            {"question": "A score below what on the Tinetti Gait and Balance Assessment indicates high fall risk?", "options": ["15", "19", "24", "28"], "correct": 1},
            {"question": "Which condition is characterized by brief, intense episodes of vertigo triggered by specific head positions?", "options": ["Meniere's disease", "Vestibular neuritis", "Benign Paroxysmal Positional Vertigo (BPPV)", "Labyrinthitis"], "correct": 2},
            {"question": "The Dix-Hallpike maneuver is used to diagnose:", "options": ["Meniere's disease", "Vestibular neuritis", "BPPV affecting the posterior canal", "Labyrinthitis"], "correct": 2},
            {"question": "Which gait pattern is characterized by a wide base of support and difficulty with tandem walking?", "options": ["Parkinsonian gait", "Ataxic gait", "Hemiplegic gait", "Steppage gait"], "correct": 1},
            {"question": "The Timed Up and Go (TUG) test is considered abnormal if it takes longer than:", "options": ["10 seconds", "12 seconds", "15 seconds", "20 seconds"], "correct": 1},
            {"question": "Which canal is most commonly affected in BPPV?", "options": ["Anterior", "Posterior", "Horizontal", "All equally"], "correct": 1},
            {"question": "Meniere's disease is characterized by all EXCEPT:", "options": ["Episodic vertigo", "Fluctuating hearing loss", "Tinnitus", "Constant positional vertigo"], "correct": 3},
            {"question": "The Epley maneuver is used to treat:", "options": ["Vestibular neuritis", "Meniere's disease", "Posterior canal BPPV", "Labyrinthitis"], "correct": 2},
            {"question": "Which assessment tool specifically measures dynamic balance during walking?", "options": ["Berg Balance Scale", "Tinetti Assessment", "Dynamic Gait Index (DGI)", "Functional Reach Test"], "correct": 2},
            {"question": "A positive Romberg test indicates loss of:", "options": ["Visual input", "Vestibular input", "Proprioceptive input", "Motor function"], "correct": 2},
            {"question": "The 6-minute walk test primarily measures:", "options": ["Balance", "Functional endurance", "Gait speed", "Lower extremity strength"], "correct": 1},
            {"question": "Which condition typically presents with acute, continuous vertigo lasting days?", "options": ["BPPV", "Meniere's disease", "Vestibular neuritis", "Migraine-associated vertigo"], "correct": 2},
            {"question": "Tandem stance primarily challenges which aspect of balance?", "options": ["Static balance", "Dynamic balance", "Reactive balance", "Anticipatory balance"], "correct": 0},
            {"question": "The Functional Gait Assessment (FGA) includes how many items?", "options": ["7 items", "8 items", "10 items", "14 items"], "correct": 2},
            {"question": "Canalith repositioning maneuvers work by:", "options": ["Dissolving calcium crystals", "Moving otoconia out of semicircular canals", "Reducing inflammation", "Improving blood flow"], "correct": 1},
            {"question": "Which medication class is commonly used for acute vertigo management?", "options": ["Antibiotics", "Vestibular suppressants (antihistamines)", "Antidepressants", "Muscle relaxants"], "correct": 1},
            {"question": "Fall risk is significantly increased with a Berg Balance Scale score below:", "options": ["36 points", "40 points", "45 points", "50 points"], "correct": 2},
            {"question": "Vestibular rehabilitation exercises primarily work through:", "options": ["Strengthening eye muscles", "Central compensation and habituation", "Improving hearing", "Reducing inflammation"], "correct": 1}
        ],
        'neuro-gait-001': [
            {"question": "Hemiplegic gait is characterized by:", "options": ["Circumduction of the affected leg", "Steppage pattern", "Festination", "Ataxic pattern"], "correct": 0},
            {"question": "Parkinsonian gait typically includes all EXCEPT:", "options": ["Shuffling steps", "Festination", "Arm swing increase", "Reduced step length"], "correct": 2},
            {"question": "Steppage gait results from:", "options": ["Quadriceps weakness", "Foot drop", "Hip flexor weakness", "Cerebellar dysfunction"], "correct": 1},
            {"question": "Which condition produces scissoring gait?", "options": ["Cerebellar ataxia", "Spastic diplegia", "Parkinson's disease", "Peripheral neuropathy"], "correct": 1},
            {"question": "Festination refers to:", "options": ["Decreasing step length and increasing speed", "Wide-based gait", "Irregular stepping", "Dropping foot"], "correct": 0},
            {"question": "Cerebellar ataxia gait is characterized by:", "options": ["Narrow base", "Wide base and unsteadiness", "Shuffling", "Circumduction"], "correct": 1},
            {"question": "Sensory ataxia is most evident when:", "options": ["Eyes are open", "Eyes are closed", "Walking fast", "Walking backward"], "correct": 1},
            {"question": "The Unified Parkinson's Disease Rating Scale (UPDRS) assesses:", "options": ["Balance only", "Gait only", "Multiple motor and non-motor symptoms", "Cognitive function only"], "correct": 2},
            {"question": "Which is a characteristic of spasticity?", "options": ["Lower resistance with faster stretch", "Velocity-dependent increased resistance", "No resistance to movement", "Flaccidity"], "correct": 1},
            {"question": "Freezing of gait in Parkinson's is best treated with:", "options": ["Visual cues and rhythmic auditory cues", "Strength training only", "Stretching only", "Medication discontinuation"], "correct": 0},
            {"question": "Dysdiadochokinesia refers to:", "options": ["Inability to perform rapid alternating movements", "Muscle weakness", "Sensory loss", "Balance problems"], "correct": 0},
            {"question": "The Modified Ashworth Scale measures:", "options": ["Strength", "Spasticity", "Sensation", "Coordination"], "correct": 1},
            {"question": "Lateral corticospinal tract lesions result in:", "options": ["Ipsilateral weakness", "Contralateral weakness", "Bilateral weakness", "No weakness"], "correct": 1},
            {"question": "Which medication is commonly used for spasticity management?", "options": ["Levodopa", "Baclofen", "Aspirin", "Antibiotics"], "correct": 1},
            {"question": "Dysmetria is tested by:", "options": ["Heel-to-shin test", "Finger-to-nose test", "Romberg test", "Heel walking"], "correct": 1},
            {"question": "Proprioceptive neuromuscular facilitation (PNF) patterns are based on:", "options": ["Diagonal and rotational movements", "Straight plane movements only", "Isolated joint movements", "Static positioning only"], "correct": 0},
            {"question": "The Hoehn and Yahr Scale classifies:", "options": ["Stroke severity", "Parkinson's disease progression", "Spinal cord injury level", "TBI severity"], "correct": 1},
            {"question": "Task-specific training for neurological conditions should be:", "options": ["Non-functional and repetitive", "Functional and meaningful to the patient", "Done only in sitting", "Avoided entirely"], "correct": 1},
            {"question": "Anterior corticospinal tract lesions primarily affect:", "options": ["Upper extremity fine motor control", "Trunk and proximal limb control", "Only lower extremities", "Only facial muscles"], "correct": 1},
            {"question": "Wernicke's area lesion affects:", "options": ["Motor speech", "Language comprehension", "Reading", "Writing"], "correct": 1}
        ],
        'stroke-rehab-001': [
            {"question": "The most common type of stroke is:", "options": ["Hemorrhagic", "Ischemic", "Embolic", "Cryptogenic"], "correct": 1},
            {"question": "Hemiparesis typically affects which side after a left hemisphere stroke?", "options": ["Ipsilateral", "Contralateral", "Bilateral", "No pattern"], "correct": 1},
            {"question": "The Brunnstrom stages describe:", "options": ["Levels of consciousness", "Motor recovery patterns", "Cognitive stages", "Sensory return"], "correct": 1},
            {"question": "Spasticity typically appears in Brunnstrom Stage:", "options": ["Stage I", "Stage II", "Stage III", "Stage VI"], "correct": 1},
            {"question": "The primary goal of stroke rehabilitation in the acute phase is:", "options": ["Return to work", "Prevent secondary complications", "Maximize independence", "Discharge home"], "correct": 1},
            {"question": "Shoulder subluxation in hemiplegia is primarily due to:", "options": ["Muscle atrophy", "Gravity and muscle weakness", "Nerve damage", "Joint contracture"], "correct": 1},
            {"question": "Neglect syndrome most commonly occurs with:", "options": ["Left hemisphere lesions", "Right hemisphere lesions", "Brainstem strokes", "Cerebellar strokes"], "correct": 1},
            {"question": "Functional Independence Measure (FIM) scores range from:", "options": ["0-50", "18-126", "0-100", "1-10"], "correct": 1},
            {"question": "The Barthel Index assesses:", "options": ["Cognitive function", "Activities of daily living", "Motor strength", "Sensory function"], "correct": 1},
            {"question": "Constraint-Induced Movement Therapy (CIMT) is most appropriate for:", "options": ["Severe hemiplegia", "Learned non-use with some active movement", "Flaccid paralysis", "Ataxia"], "correct": 1},
            {"question": "Aphasia is BEST defined as:", "options": ["Intellectual disability", "Acquired language disorder", "Hearing loss", "Articulation problem"], "correct": 1},
            {"question": "The Modified Rankin Scale measures:", "options": ["Cognitive status", "Functional disability/dependence", "Motor power", "Sensory loss"], "correct": 1},
            {"question": "Which of the following is a predictor of good stroke recovery?", "options": ["Severe initial deficit", "Younger age", "Multiple comorbidities", "Long hospital stay"], "correct": 1},
            {"question": "Dysphagia management in acute stroke typically includes:", "options": ["Immediate oral feeding", "Swallowing evaluation before oral intake", "PEG tube for all patients", "No intervention needed"], "correct": 1},
            {"question": "Mirror therapy is primarily used for:", "options": ["Pain management", "Motor recovery and pain", "Cognitive training", "Sensory restoration"], "correct": 1},
            {"question": "The National Institutes of Health Stroke Scale (NIHSS) ranges from:", "options": ["0-10", "0-21", "0-42", "0-100"], "correct": 2},
            {"question": "Pusher syndrome is characterized by:", "options": ["Pushing away from the hemiplegic side", "Active pushing toward the hemiplegic side", "Back pain", "Forward flexed posture"], "correct": 1},
            {"question": "Locomotor training with body weight support is primarily used to:", "options": ["Strengthen arms", "Retrain walking pattern", "Improve cognition", "Treat spasticity"], "correct": 1},
            {"question": "Secondary stroke prevention includes all EXCEPT:", "options": ["Antiplatelet therapy", "Blood pressure control", "Smoking cessation", "Prolonged bed rest"], "correct": 3},
            {"question": "The optimal window for intensive stroke rehabilitation is:", "options": ["Within first 3-6 months", "After 1 year", "Only during hospitalization", "After 2 years"], "correct": 0}
        ]
    };
    
    // Default to stroke questions if course not found
    return examQuestions[courseId] || examQuestions['stroke-rehab-001'];
}

// Display exam question
function displayExamQuestion(index) {
    currentExam.currentQuestion = index;
    const container = document.getElementById('exam-questions-container');
    const question = currentExam.questions[index];
    
    let html = '<div class="exam-question" style="background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e2e8f0;">';
    html += '<div style="font-weight: 600; margin-bottom: 1rem; color: #1e293b;">Question ' + (index + 1) + ' of ' + currentExam.questions.length + '</div>';
    html += '<div style="margin-bottom: 1rem; font-size: 1.05rem;">' + question.question + '</div>';
    html += '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
    
    question.options.forEach((option, optIndex) => {
        const selected = currentExam.answers[index] === optIndex ? 'checked' : '';
        html += '<label style="display: flex; align-items: center; padding: 0.75rem; background: #f8fafc; border-radius: 6px; cursor: pointer; transition: background 0.2s;">';
        html += '<input type="radio" name="exam-q' + index + '" value="' + optIndex + '" ' + selected + ' onchange="recordExamAnswer(' + index + ', ' + optIndex + ')" style="margin-right: 0.75rem;">';
        html += '<span>' + String.fromCharCode(65 + optIndex) + ') ' + option + '</span>';
        html += '</label>';
    });
    
    html += '</div>';
    html += '</div>';
    
    // Navigation
    html += '<div style="display: flex; justify-content: space-between; margin-top: 1.5rem;">';
    if (index > 0) {
        html += '<button onclick="displayExamQuestion(' + (index - 1) + ')" style="padding: 0.75rem 1.5rem; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer;">← Previous</button>';
    } else {
        html += '<span></span>';
    }
    
    if (index < currentExam.questions.length - 1) {
        html += '<button onclick="displayExamQuestion(' + (index + 1) + ')" style="padding: 0.75rem 1.5rem; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer;">Next →</button>';
    } else {
        html += '<button onclick="submitFinalExam()" style="padding: 0.75rem 1.5rem; background: #dc2626; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">Submit Exam</button>';
    }
    html += '</div>';
    
    // Progress
    const answered = currentExam.answers.filter(a => a !== null).length;
    html += '<div style="text-align: center; margin-top: 1rem; color: #64748b;">Progress: ' + answered + '/' + currentExam.questions.length + ' answered</div>';
    
    container.innerHTML = html;
}

// Record exam answer
function recordExamAnswer(questionIndex, answerIndex) {
    currentExam.answers[questionIndex] = answerIndex;
}

// Submit final exam
function submitFinalExam() {
    const answered = currentExam.answers.filter(a => a !== null).length;
    if (answered < currentExam.questions.length) {
        if (!confirm('You have answered ' + answered + ' of ' + currentExam.questions.length + ' questions. Submit anyway?')) {
            return;
        }
    }
    
    let correct = 0;
    currentExam.questions.forEach((q, i) => {
        if (currentExam.answers[i] === q.correct) {
            correct++;
        }
    });
    
    const percentage = Math.round((correct / currentExam.questions.length) * 100);
    const passed = percentage >= 70;
    
    currentExam.submitted = true;
    
    // Show results
    const resultsDiv = document.getElementById('exam-results');
    resultsDiv.style.display = 'block';
    resultsDiv.style.background = passed ? '#ecfdf5' : '#fef2f2';
    resultsDiv.style.border = passed ? '2px solid #10b981' : '2px solid #ef4444';
    
    let html = '<h3 style="margin-top: 0;">' + (passed ? '✅ Congratulations! You Passed!' : '❌ Did Not Pass') + '</h3>';
    html += '<p style="font-size: 1.1rem;">You scored <strong>' + correct + '/' + currentExam.questions.length + '</strong> (' + percentage + '%)</p>';
    html += '<p>Passing score: 70% (14/20)</p>';
    
    if (passed) {
        html += '<p style="color: #059669; font-weight: 600;">Your certificate is now available below!</p>';
        document.getElementById('certificate-section').style.display = 'block';
        
        // Set completion date
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('cert-completion-date').textContent = dateStr;
        
        // Save completion
        const courseId = window.location.pathname.split('/').pop().replace('-progressive.html', '');
        localStorage.setItem(courseId + '-completed', 'true');
        localStorage.setItem(courseId + '-completion-date', new Date().toISOString());
        localStorage.setItem(courseId + '-exam-score', percentage);
    } else {
        html += '<button onclick="retakeExam()" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer;">Retake Exam</button>';
    }
    
    // Show question review
    html += '<div style="margin-top: 2rem; text-align: left;">';
    html += '<h4>Question Review:</h4>';
    currentExam.questions.forEach((q, i) => {
        const userAnswer = currentExam.answers[i];
        const isCorrect = userAnswer === q.correct;
        html += '<div style="margin-bottom: 1rem; padding: 0.75rem; background: white; border-radius: 6px; border-left: 4px solid ' + (isCorrect ? '#10b981' : '#ef4444') + '">';
        html += '<div><strong>Q' + (i + 1) + ':</strong> ' + q.question + '</div>';
        html += '<div style="margin-top: 0.5rem; font-size: 0.9rem;">';
        html += 'Your answer: ' + (userAnswer !== null ? String.fromCharCode(65 + userAnswer) : 'Not answered') + ' ';
        html += isCorrect ? '✓' : '✗ (Correct: ' + String.fromCharCode(65 + q.correct) + ')';
        html += '</div>';
        html += '</div>';
    });
    html += '</div>';
    
    resultsDiv.innerHTML = html;
}

// Retake exam
function retakeExam() {
    currentExam.answers = new Array(currentExam.questions.length).fill(null);
    currentExam.currentQuestion = 0;
    currentExam.submitted = false;
    document.getElementById('exam-results').style.display = 'none';
    displayExamQuestion(0);
}

// Print certificate
function printCertificate() {
    const certContent = document.getElementById('certificate-content');
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Course Certificate</title><style>body{font-family:Arial,sans-serif;margin:20px}@media print{body{margin:0}}</style></head><body>' + certContent.innerHTML + '</body></html>');
    printWindow.document.close();
    printWindow.print();
}

// Admin reset progress
async function adminResetProgress() {
    if (!await isAdmin()) return;
    
    if (!confirm('Reset all course progress? This cannot be undone.')) return;
    
    const courseId = window.location.pathname.split('/').pop().replace('-progressive.html', '');
    localStorage.removeItem(courseId + '-progress');
    localStorage.removeItem(courseId + '-feedback');
    localStorage.removeItem(courseId + '-completed');
    localStorage.removeItem(courseId + '-completion-date');
    localStorage.removeItem(courseId + '-exam-score');
    
    showNotification('✓ Progress reset. Reloading...');
    setTimeout(() => location.reload(), 1000);
}

// Admin show answers
async function adminShowAnswers() {
    if (!await isAdmin()) return;
    
    const courseId = window.location.pathname.split('/').pop().replace('-progressive.html', '');
    const questions = getExamQuestions(courseId);
    
    let html = '<h3>Exam Answer Key</h3>';
    questions.forEach((q, i) => {
        html += '<div style="margin: 1rem 0; padding: 1rem; background: #f0fdf4; border-radius: 6px;">';
        html += '<strong>Q' + (i + 1) + ':</strong> ' + q.question + '<br>';
        html += '<strong>Answer:</strong> ' + String.fromCharCode(65 + q.correct) + ') ' + q.options[q.correct];
        html += '</div>';
    });
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = '<div style="background:white;padding:2rem;border-radius:12px;max-width:800px;max-height:80vh;overflow-y:auto;">' + html + '<button onclick="this.closest(\'.fixed\').remove()" style="margin-top:1rem;padding:0.75rem 1.5rem;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;">Close</button></div>';
    modal.className = 'fixed';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
}

// Show notification
function showNotification(message) {
    if (typeof window.showNotification === 'function' && window.showNotification !== showNotification) {
        window.showNotification(message);
    } else {
        alert(message);
    }
}
