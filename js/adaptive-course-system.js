/**
 * DrTroy Adaptive Course System
 * 
 * Manages unified PT/PTA courses with profession-specific content
 * and shared learning objectives.
 */

class AdaptiveCourseManager {
    constructor() {
        this.currentProfession = null;
        this.courseData = null;
        this.progressData = {
            modulesCompleted: 0,
            totalModules: 0,
            timeSpent: 0,
            startTime: null
        };
    }

    /**
     * Initialize adaptive course system
     */
    init(courseConfig) {
        this.courseData = courseConfig;
        this.progressData.totalModules = courseConfig.modules.length;
        this.progressData.startTime = new Date();
        
        this.setupProfessionSelector();
        this.setupProgressTracking();
        this.setupCourseNavigation();
        
        // Check for stored profession preference
        const savedProfession = localStorage.getItem('drTroy_profession');
        if (savedProfession && ['PT', 'PTA'].includes(savedProfession)) {
            this.setProfession(savedProfession);
        }
    }

    /**
     * Set user profession and adapt course content
     */
    setProfession(profession) {
        if (!['PT', 'PTA'].includes(profession)) {
            console.error('Invalid profession:', profession);
            return;
        }

        this.currentProfession = profession;
        localStorage.setItem('drTroy_profession', profession);

        // Update UI
        this.updateProfessionUI(profession);
        this.showProfessionContent(profession);
        this.updateLearningObjectives(profession);
        this.showCourseContent();
        this.updateProgress();

        // Track profession selection
        this.trackEvent('profession_selected', { profession: profession });
    }

    /**
     * Update profession selector UI
     */
    updateProfessionUI(profession) {
        // Update button states
        document.querySelectorAll('.profession-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.getElementById(profession.toLowerCase() + 'Btn');
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    /**
     * Show profession-specific content sections
     */
    showProfessionContent(profession) {
        // Hide all profession-specific content
        document.querySelectorAll('.scope-content').forEach(content => {
            content.classList.remove('active');
        });

        // Show selected profession content
        document.querySelectorAll(`.${profession.toLowerCase()}-content`).forEach(content => {
            content.classList.add('active');
        });

        // Handle profession-only elements
        document.querySelectorAll('.pt-only, .pta-only').forEach(item => {
            item.style.display = 'none';
        });
        
        document.querySelectorAll(`.${profession.toLowerCase()}-only`).forEach(item => {
            item.style.display = item.tagName === 'LI' ? 'list-item' : 'block';
        });
    }

    /**
     * Update learning objectives based on profession
     */
    updateLearningObjectives(profession) {
        if (!this.courseData || !this.courseData.objectives) return;

        const objectivesList = document.querySelector('#learningObjectives ol, #courseObjectives ol');
        if (!objectivesList) return;

        // Clear existing objectives
        objectivesList.innerHTML = '';

        // Add shared objectives
        this.courseData.objectives.shared.forEach(objective => {
            const li = document.createElement('li');
            li.textContent = objective;
            objectivesList.appendChild(li);
        });

        // Add profession-specific objectives
        const professionObjectives = this.courseData.objectives[profession.toLowerCase()];
        if (professionObjectives) {
            professionObjectives.forEach(objective => {
                const li = document.createElement('li');
                li.textContent = objective;
                li.classList.add(`${profession.toLowerCase()}-specific`);
                objectivesList.appendChild(li);
            });
        }
    }

    /**
     * Show main course content
     */
    showCourseContent() {
        const courseContent = document.getElementById('courseContent');
        const progressSection = document.getElementById('progressSection');
        
        if (courseContent) courseContent.style.display = 'block';
        if (progressSection) progressSection.style.display = 'block';
    }

    /**
     * Setup profession selector interface
     */
    setupProfessionSelector() {
        // Create profession selector if it doesn't exist
        if (!document.querySelector('.profession-selector')) {
            this.createProfessionSelector();
        }

        // Add click handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('profession-btn')) {
                const profession = e.target.textContent.includes('PT') && !e.target.textContent.includes('Assistant') ? 'PT' : 'PTA';
                this.setProfession(profession);
            }
        });
    }

    /**
     * Create profession selector HTML
     */
    createProfessionSelector() {
        const selector = document.createElement('div');
        selector.className = 'profession-selector';
        selector.innerHTML = `
            <h3 style="margin-top: 0;">Select Your Profession</h3>
            <p>This course adapts content based on your professional role and scope of practice.</p>
            <div class="profession-buttons">
                <button class="profession-btn" id="ptBtn">
                    Physical Therapist (PT)
                </button>
                <button class="profession-btn" id="ptaBtn">
                    Physical Therapist Assistant (PTA)
                </button>
            </div>
        `;

        // Insert after cover page or at beginning of content
        const coverPage = document.querySelector('.cover-page');
        if (coverPage) {
            coverPage.insertAdjacentElement('afterend', selector);
        } else {
            document.querySelector('.content-wrapper').prepend(selector);
        }
    }

    /**
     * Setup progress tracking
     */
    setupProgressTracking() {
        // Create progress indicator if it doesn't exist
        if (!document.getElementById('progressSection')) {
            this.createProgressIndicator();
        }

        // Setup intersection observer for module tracking
        this.setupModuleObserver();
    }

    /**
     * Create progress indicator HTML
     */
    createProgressIndicator() {
        const progressHTML = `
            <div class="progress-indicator" id="progressSection" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span><strong>Course Progress</strong></span>
                    <span id="progressText">0% Complete</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" id="progressFill" style="width: 0%"></div>
                </div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    <span id="timeSpent">Time: 0 min</span> | 
                    <span id="moduleCount">Modules: 0/${this.progressData.totalModules}</span>
                </div>
            </div>
        `;

        const professionSelector = document.querySelector('.profession-selector');
        if (professionSelector) {
            professionSelector.insertAdjacentHTML('afterend', progressHTML);
        }
    }

    /**
     * Setup intersection observer for automatic progress tracking
     */
    setupModuleObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting && entry.target.classList.contains('module-header')) {
                    const moduleId = entry.target.id || entry.target.textContent;
                    this.markModuleViewed(moduleId);
                }
            });
        }, {
            threshold: 0.5,
            rootMargin: '-50px'
        });

        // Observe all module headers
        document.querySelectorAll('.module-header').forEach((module) => {
            observer.observe(module);
        });
    }

    /**
     * Mark a module as viewed
     */
    markModuleViewed(moduleId) {
        if (!this.viewedModules) this.viewedModules = new Set();
        
        if (!this.viewedModules.has(moduleId)) {
            this.viewedModules.add(moduleId);
            this.progressData.modulesCompleted = this.viewedModules.size;
            this.updateProgress();
            
            this.trackEvent('module_viewed', { 
                moduleId: moduleId,
                profession: this.currentProfession,
                progress: this.getProgressPercentage()
            });
        }
    }

    /**
     * Update progress display
     */
    updateProgress() {
        const progressPercent = this.getProgressPercentage();
        const timeSpent = this.getTimeSpent();

        // Update progress bar
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const timeSpentElement = document.getElementById('timeSpent');
        const moduleCountElement = document.getElementById('moduleCount');

        if (progressFill) progressFill.style.width = progressPercent + '%';
        if (progressText) progressText.textContent = progressPercent + '% Complete';
        if (timeSpentElement) timeSpentElement.textContent = `Time: ${timeSpent} min`;
        if (moduleCountElement) {
            moduleCountElement.textContent = `Modules: ${this.progressData.modulesCompleted}/${this.progressData.totalModules}`;
        }
    }

    /**
     * Get progress percentage
     */
    getProgressPercentage() {
        if (this.progressData.totalModules === 0) return 0;
        return Math.round((this.progressData.modulesCompleted / this.progressData.totalModules) * 100);
    }

    /**
     * Get time spent in minutes
     */
    getTimeSpent() {
        if (!this.progressData.startTime) return 0;
        const now = new Date();
        const diffMs = now - this.progressData.startTime;
        return Math.floor(diffMs / (1000 * 60));
    }

    /**
     * Setup course navigation
     */
    setupCourseNavigation() {
        this.createNavigationButtons();
    }

    /**
     * Create next/previous navigation
     */
    createNavigationButtons() {
        const modules = document.querySelectorAll('.module-header');
        
        modules.forEach((module, index) => {
            const navDiv = document.createElement('div');
            navDiv.className = 'module-navigation';
            navDiv.style.cssText = 'text-align: center; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 8px;';
            
            let navHTML = '';
            
            if (index > 0) {
                navHTML += `<button class="nav-btn" onclick="window.adaptiveCourse.navigateToModule(${index - 1})">← Previous Module</button>`;
            }
            
            if (index < modules.length - 1) {
                navHTML += `<button class="nav-btn" onclick="window.adaptiveCourse.navigateToModule(${index + 1})">Next Module →</button>`;
            }
            
            if (index === modules.length - 1) {
                navHTML += `<button class="nav-btn nav-btn-primary" onclick="window.adaptiveCourse.completeModule()">Complete Module</button>`;
            }
            
            navDiv.innerHTML = navHTML;
            
            // Find the next module or end of content to insert navigation
            const nextModule = modules[index + 1];
            if (nextModule) {
                nextModule.parentNode.insertBefore(navDiv, nextModule);
            } else {
                // Insert at end of course content
                const courseContent = document.getElementById('courseContent') || document.querySelector('.content-wrapper');
                courseContent.appendChild(navDiv);
            }
        });
    }

    /**
     * Navigate to specific module
     */
    navigateToModule(moduleIndex) {
        const modules = document.querySelectorAll('.module-header');
        if (modules[moduleIndex]) {
            modules[moduleIndex].scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
            
            this.trackEvent('module_navigation', {
                targetModule: moduleIndex,
                profession: this.currentProfession
            });
        }
    }

    /**
     * Complete current module
     */
    completeModule() {
        // Mark all modules as viewed
        this.progressData.modulesCompleted = this.progressData.totalModules;
        this.updateProgress();
        
        // Show completion message or redirect to quiz
        this.showCourseCompletion();
        
        this.trackEvent('course_completed', {
            profession: this.currentProfession,
            timeSpent: this.getTimeSpent(),
            modulesCompleted: this.progressData.modulesCompleted
        });
    }

    /**
     * Show course completion
     */
    showCourseCompletion() {
        const completionDiv = document.createElement('div');
        completionDiv.className = 'course-completion';
        completionDiv.style.cssText = `
            background: linear-gradient(135deg, #22c55e, #16a34a);
            color: white;
            padding: 40px;
            border-radius: 12px;
            text-align: center;
            margin: 30px 0;
        `;
        
        completionDiv.innerHTML = `
            <h2 style="margin-top: 0; font-size: 28px;">🎉 Course Complete!</h2>
            <p style="font-size: 18px; margin: 20px 0;">Congratulations on completing the course content!</p>
            <p style="margin: 15px 0;">Time spent: ${this.getTimeSpent()} minutes</p>
            <p style="margin: 15px 0;">Profession: ${this.currentProfession}</p>
            <div style="margin-top: 30px;">
                <button class="btn btn-light" onclick="window.adaptiveCourse.startKnowledgeCheck()" style="background: white; color: #1a365d; padding: 15px 30px; border: none; border-radius: 6px; font-weight: 600; font-size: 16px; cursor: pointer;">
                    Take Knowledge Check →
                </button>
            </div>
        `;
        
        document.querySelector('.content-wrapper').appendChild(completionDiv);
        completionDiv.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Start knowledge check
     */
    startKnowledgeCheck() {
        // Redirect to knowledge check or show inline quiz
        if (this.courseData && this.courseData.quizUrl) {
            window.location.href = this.courseData.quizUrl + '?profession=' + this.currentProfession;
        } else {
            alert('Knowledge check not yet available for this course.');
        }
    }

    /**
     * Track analytics events
     */
    trackEvent(eventName, properties = {}) {
        // Store in localStorage for now, could integrate with analytics service
        const events = JSON.parse(localStorage.getItem('drTroy_courseEvents') || '[]');
        events.push({
            event: eventName,
            properties: {
                ...properties,
                timestamp: new Date().toISOString(),
                courseId: this.courseData?.courseId,
                userAgent: navigator.userAgent.substring(0, 200)
            }
        });
        localStorage.setItem('drTroy_courseEvents', JSON.stringify(events));
        
        // Console log for debugging
        console.log('Course Event:', eventName, properties);
    }

    /**
     * Get course analytics data
     */
    getAnalyticsData() {
        return {
            profession: this.currentProfession,
            progress: this.getProgressPercentage(),
            timeSpent: this.getTimeSpent(),
            modulesCompleted: this.progressData.modulesCompleted,
            totalModules: this.progressData.totalModules,
            events: JSON.parse(localStorage.getItem('drTroy_courseEvents') || '[]')
        };
    }

    /**
     * Export course completion data
     */
    exportCompletionData() {
        return {
            courseId: this.courseData?.courseId,
            profession: this.currentProfession,
            completedAt: new Date().toISOString(),
            timeSpent: this.getTimeSpent(),
            progress: this.getProgressPercentage(),
            modulesCompleted: this.progressData.modulesCompleted,
            totalModules: this.progressData.totalModules
        };
    }
}

/**
 * Course configuration templates
 */
const AdaptiveCourseTemplates = {
    /**
     * Standard PT/PTA course configuration
     */
    createStandardConfig(courseId, title, objectives, modules) {
        return {
            courseId: courseId,
            title: title,
            version: '1.0',
            professions: ['PT', 'PTA'],
            objectives: objectives,
            modules: modules,
            estimatedTime: {
                PT: modules.reduce((sum, m) => sum + (m.ptTime || m.sharedTime || 0), 0),
                PTA: modules.reduce((sum, m) => sum + (m.ptaTime || m.sharedTime || 0), 0)
            }
        };
    },

    /**
     * Mobility and Fall Prevention course config
     */
    getMobilityFallPreventionConfig() {
        return this.createStandardConfig(
            'MOBILITY-001',
            'Comprehensive Mobility and Fall Prevention',
            {
                shared: [
                    'Identify fall risk factors and implement evidence-based prevention strategies',
                    'Demonstrate safe transfer and mobility techniques appropriate to professional scope',
                    'Apply environmental modification principles to reduce fall risk',
                    'Document mobility interventions and progress according to professional standards'
                ],
                pt: [
                    'Conduct comprehensive mobility assessments and develop treatment plans',
                    'Interpret diagnostic findings and establish differential diagnoses',
                    'Train other healthcare providers in transfer techniques and safety protocols'
                ],
                pta: [
                    'Implement mobility interventions under PT supervision and direction',
                    'Recognize when to modify interventions or seek PT consultation',
                    'Provide skilled assistance and monitor patient response to treatment'
                ]
            },
            [
                { id: 'falls', title: 'Fall Prevention Fundamentals', sharedTime: 45 },
                { id: 'assessment', title: 'Assessment and Evaluation', ptTime: 30, ptaTime: 30 },
                { id: 'transfers', title: 'Transfer and Mobility Techniques', sharedTime: 60 },
                { id: 'environment', title: 'Environmental Modifications', sharedTime: 30 },
                { id: 'documentation', title: 'Documentation and Communication', ptTime: 15, ptaTime: 15 },
                { id: 'cases', title: 'Case Studies and Applications', ptTime: 20, ptaTime: 20 }
            ]
        );
    }
};

// Global instance
window.adaptiveCourse = new AdaptiveCourseManager();
window.AdaptiveCourseTemplates = AdaptiveCourseTemplates;

// Auto-initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
    // Check for course configuration in page data
    const courseDataElement = document.getElementById('courseData');
    if (courseDataElement) {
        const courseConfig = JSON.parse(courseDataElement.textContent);
        window.adaptiveCourse.init(courseConfig);
    }
});

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdaptiveCourseManager, AdaptiveCourseTemplates };
}