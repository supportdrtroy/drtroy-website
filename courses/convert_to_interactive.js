// JavaScript to convert comprehensive course to interactive
const fs = require('fs');

// Read the comprehensive HTML file
let htmlContent = fs.readFileSync('MSK_Course_Comprehensive.html', 'utf8');

// Add interactive structure around existing content
const interactiveTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive MSK Course - DrTroy CE</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        /* Copy all existing styles from comprehensive course */
        {ORIGINAL_STYLES}

        /* Add interactive navigation styles */
        .course-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            min-height: 100vh;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .course-header {
            background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }

        .progress-bar {
            background: #e2e8f0;
            height: 8px;
            margin: 0;
        }

        .progress-fill {
            background: #d69e2e;
            height: 100%;
            width: 0%;
            transition: width 0.3s ease;
        }

        .course-nav {
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .nav-btn {
            background: #1a365d;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background 0.3s;
        }

        .nav-btn:hover:not(:disabled) {
            background: #2c5282;
        }

        .nav-btn:disabled {
            background: #cbd5e0;
            cursor: not-allowed;
        }

        .module {
            display: none;
            padding: 2rem;
        }

        .module.active {
            display: block;
            animation: fadeIn 0.5s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .certificate {
            background: white;
            padding: 3rem;
            text-align: center;
            border: 3px solid #d69e2e;
            margin: 2rem 0;
        }

        .btn-primary {
            background: #1a365d;
            color: white;
            padding: 1rem 2rem;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            transition: background 0.3s;
        }

        .btn-primary:hover {
            background: #2c5282;
        }
    </style>
</head>
<body>
    <div class="course-container">
        <!-- Course Header -->
        <div class="course-header">
            <img src="images/drtroy_logo.png" alt="DrTroy Continuing Education" style="max-width: 200px; margin-bottom: 1rem;">
            <h1>Comprehensive Musculoskeletal Evaluation and Treatment</h1>
            <div style="color: #d69e2e; font-size: 1.1rem;">A Systematic Regional Approach to Clinical Assessment</div>
            <div style="margin-top: 1rem; font-size: 0.9rem;">
                <strong>DrTroy Continuing Education</strong> • Course #PT-MSK-001 • 3 CCUs
            </div>
        </div>

        <!-- Progress Bar -->
        <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
        </div>

        <!-- Navigation -->
        <div class="course-nav">
            <button class="nav-btn" id="prevBtn" onclick="previousModule()" disabled>Previous</button>
            <span id="moduleCounter">Course Information</span>
            <button class="nav-btn" id="nextBtn" onclick="nextModule()">Begin Course</button>
        </div>

        <!-- Course Content -->
        <div id="courseContent">
            {ORIGINAL_CONTENT}
        </div>
    </div>

    <script>
        // Interactive course functionality
        let currentModule = 0;
        const totalModules = 14; // Course info + 12 modules + quiz + certificate
        let quizPassed = false;

        // Quiz questions
        const quizQuestions = [
            {
                question: "A 45-year-old patient presents with neck pain radiating down the right arm. Which special test is most specific for cervical radiculopathy?",
                options: ["Cervical distraction test", "Spurling's test", "Vertebral artery test", "Upper limb tension test"],
                correct: 1,
                explanation: "Spurling's test (93% specific) for cervical radiculopathy"
            },
            // Add all 20 questions here...
        ];

        function initializeCourse() {
            // Parse existing content into modules
            parseModules();
            updateProgress();
            updateNavigation();
        }

        function parseModules() {
            // Find all module headers and create module sections
            // This would parse the existing HTML structure
        }

        function nextModule() {
            if (currentModule < totalModules - 1) {
                currentModule++;
                showModule(currentModule);
                updateProgress();
                updateNavigation();
            }
        }

        function previousModule() {
            if (currentModule > 0) {
                currentModule--;
                showModule(currentModule);
                updateProgress();
                updateNavigation();
            }
        }

        function showModule(moduleIndex) {
            // Hide all modules
            document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
            
            // Show current module
            const modules = document.querySelectorAll('.module');
            if (modules[moduleIndex]) {
                modules[moduleIndex].classList.add('active');
            }
        }

        function updateProgress() {
            const progress = (currentModule / (totalModules - 1)) * 100;
            document.getElementById('progressFill').style.width = progress + '%';
        }

        function updateNavigation() {
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            const counter = document.getElementById('moduleCounter');
            
            prevBtn.disabled = currentModule === 0;
            
            if (currentModule === 0) {
                counter.textContent = 'Course Information';
                nextBtn.textContent = 'Begin Course';
            } else if (currentModule <= 12) {
                counter.textContent = `Module ${currentModule} of 12`;
                nextBtn.textContent = currentModule === 12 ? 'Take Quiz' : 'Next Module';
            } else if (currentModule === 13) {
                counter.textContent = 'Knowledge Check';
                nextBtn.textContent = 'View Certificate';
                nextBtn.disabled = !quizPassed;
            } else {
                counter.textContent = 'Certificate';
                nextBtn.style.display = 'none';
            }
        }

        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', initializeCourse);
    </script>
</body>
</html>`;

// Extract styles from original
const styleMatch = htmlContent.match(/<style>([\s\S]*?)<\/style>/);
const originalStyles = styleMatch ? styleMatch[1] : '';

// Extract body content from original
const bodyMatch = htmlContent.match(/<body>([\s\S]*?)<\/body>/);
const originalContent = bodyMatch ? bodyMatch[1] : '';

// Replace placeholders
const finalHtml = interactiveTemplate
    .replace('{ORIGINAL_STYLES}', originalStyles)
    .replace('{ORIGINAL_CONTENT}', originalContent);

// Write the new interactive file
fs.writeFileSync('interactive_msk_complete.html', finalHtml);

console.log('Interactive course created successfully!');