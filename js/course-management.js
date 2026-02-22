/**
 * DrTroy CE Platform: Advanced Course Management System
 * Professional-grade content management for continuing education
 */

// Global course management state
let courseData = [];
let currentCourse = null;
let currentModule = null;
let currentLesson = null;

// ============================================================================
// COURSE LOADING AND DISPLAY
// ============================================================================

async function loadCourses() {
    try {
        // First load from Supabase database
        const courses = await loadCoursesFromDatabase();
        
        if (courses && courses.length > 0) {
            courseData = courses;
            renderCourseList(courseData);
            updateCourseStats(courseData);
            return;
        }
        
        // Fallback: Load sample data for development
        courseData = await loadSampleCourseData();
        renderCourseList(courseData);
        updateCourseStats(courseData);
    } catch (error) {
        console.error('Error loading courses:', error);
        showCourseError('Failed to load courses. Please try again.');
    }
}

async function loadCoursesFromDatabase() {
    if (!window.DrTroySupabase) {
        throw new Error('Database connection not available');
    }
    
    const { data, error } = await window.DrTroySupabase.getClient()
        .from('courses')
        .select(`
            *,
            course_modules (
                id, title, description, order_index,
                course_lessons (
                    id, title, lesson_type, content, video_url, order_index
                )
            ),
            course_assessments (
                id, title, description, assessment_type, passing_score
            )
        `)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Database error:', error);
        return null;
    }
    
    return data;
}

async function loadSampleCourseData() {
    return [
        {
            id: 'sample-1',
            title: 'Advanced Musculoskeletal Assessment',
            subtitle: 'Evidence-based evaluation techniques for complex orthopedic conditions',
            description: 'Comprehensive course covering advanced assessment techniques for musculoskeletal conditions commonly seen in outpatient physical therapy practice.',
            learning_objectives: [
                'Perform advanced orthopedic special tests with proper technique',
                'Interpret imaging findings relevant to physical therapy practice',
                'Develop evidence-based differential diagnoses',
                'Create comprehensive treatment plans based on assessment findings'
            ],
            target_audience: ['PT', 'PTA'],
            category: 'musculoskeletal',
            difficulty_level: 'advanced',
            ceu_hours: 3.0,
            ce_category: 'general',
            price_cents: 4900,
            status: 'published',
            featured: true,
            thumbnail_url: '/courses/images/msk-assessment-thumb.jpg',
            slug: 'advanced-msk-assessment',
            meta_title: 'Advanced MSK Assessment CE Course',
            meta_description: 'Learn advanced musculoskeletal assessment techniques in this 3.0 CEU course for PTs and PTAs.',
            tags: ['orthopedic', 'assessment', 'manual therapy', 'differential diagnosis'],
            created_at: '2026-02-20T10:00:00Z',
            updated_at: '2026-02-22T15:30:00Z',
            published_at: '2026-02-22T16:00:00Z',
            course_modules: [
                {
                    id: 'module-1',
                    title: 'Introduction to Advanced Assessment',
                    order_index: 1,
                    course_lessons: [
                        { id: 'lesson-1', title: 'Course Overview', lesson_type: 'content', order_index: 1 },
                        { id: 'lesson-2', title: 'Assessment Principles', lesson_type: 'video', order_index: 2 }
                    ]
                }
            ]
        },
        {
            id: 'sample-2',
            title: 'Ethics in Physical Therapy Practice',
            subtitle: 'Professional decision-making and ethical considerations',
            description: 'Essential ethics course covering APTA Code of Ethics, professional boundaries, and ethical decision-making frameworks.',
            learning_objectives: [
                'Apply APTA Code of Ethics to clinical scenarios',
                'Identify ethical dilemmas in practice',
                'Use ethical decision-making frameworks'
            ],
            target_audience: ['PT', 'PTA', 'OT', 'COTA'],
            category: 'ethics',
            difficulty_level: 'intermediate',
            ceu_hours: 2.0,
            ce_category: 'ethics',
            price_cents: 2900,
            status: 'draft',
            featured: false,
            slug: 'ethics-pt-practice',
            created_at: '2026-02-18T14:00:00Z',
            course_modules: []
        }
    ];
}

function renderCourseList(courses) {
    const container = document.getElementById('courseListContainer');
    
    if (!courses || courses.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;color:#64748b;padding:3rem;">
                <div style="font-size:3rem;margin-bottom:1rem;">📚</div>
                <h3 style="margin:0 0 1rem;color:#374151;">No courses yet</h3>
                <p style="margin:0 0 2rem;">Get started by creating your first course</p>
                <button onclick="showCreateCourseModal()" class="btn btn-primary">Create Your First Course</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = courses.map(course => renderCourseCard(course)).join('');
}

function renderCourseCard(course) {
    const statusClass = course.status || 'draft';
    const price = course.price_cents ? (course.price_cents / 100).toFixed(2) : '0.00';
    const moduleCount = course.course_modules ? course.course_modules.length : 0;
    const lessonCount = course.course_modules ? 
        course.course_modules.reduce((total, module) => total + (module.course_lessons ? module.course_lessons.length : 0), 0) : 0;
    
    const targetAudience = Array.isArray(course.target_audience) ? 
        course.target_audience.join(', ') : (course.target_audience || '');
    
    const learningObjectives = Array.isArray(course.learning_objectives) && course.learning_objectives.length > 0 ? `
        <div class="learning-objectives">
            <h5>Learning Objectives:</h5>
            <ul>
                ${course.learning_objectives.slice(0, 3).map(obj => `<li>${escapeHtml(obj)}</li>`).join('')}
                ${course.learning_objectives.length > 3 ? '<li><em>+ more...</em></li>' : ''}
            </ul>
        </div>
    ` : '';
    
    return `
        <div class="course-card" data-course-id="${course.id}">
            <div class="course-card-header">
                <div style="flex: 1;">
                    <h3 class="course-title">${escapeHtml(course.title)}</h3>
                    ${course.subtitle ? `<p class="course-subtitle">${escapeHtml(course.subtitle)}</p>` : ''}
                </div>
                <span class="course-status ${statusClass}">${statusClass}</span>
            </div>
            
            ${course.description ? `<p class="course-description">${escapeHtml(course.description)}</p>` : ''}
            
            ${learningObjectives}
            
            <div class="course-meta">
                <div class="course-meta-item">
                    <span>🎓</span>
                    <span>${course.ceu_hours} CEU Hours</span>
                </div>
                <div class="course-meta-item">
                    <span>👥</span>
                    <span>${targetAudience}</span>
                </div>
                <div class="course-meta-item">
                    <span>💰</span>
                    <span>$${price}</span>
                </div>
                <div class="course-meta-item">
                    <span>📋</span>
                    <span>${moduleCount} modules, ${lessonCount} lessons</span>
                </div>
                ${course.category ? `
                <div class="course-meta-item">
                    <span>🏷️</span>
                    <span>${escapeHtml(course.category)}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="course-actions">
                <button onclick="editCourse('${course.id}')" class="btn btn-secondary">✏️ Edit</button>
                <button onclick="editCourseContent('${course.id}')" class="btn btn-secondary">📝 Content</button>
                ${course.status === 'published' ? 
                    `<button onclick="previewCourse('${course.id}')" class="btn btn-secondary">👁️ Preview</button>` : 
                    `<button onclick="publishCourse('${course.id}')" class="btn btn-primary">🚀 Publish</button>`
                }
                <button onclick="duplicateCourse('${course.id}')" class="btn btn-secondary">📋 Duplicate</button>
                <button onclick="deleteCourse('${course.id}')" class="btn btn-danger" style="margin-left:auto;">🗑️ Delete</button>
            </div>
        </div>
    `;
}

function updateCourseStats(courses) {
    const stats = {
        total: courses.length,
        published: courses.filter(c => c.status === 'published').length,
        drafts: courses.filter(c => c.status === 'draft').length,
        ceuHours: courses.reduce((sum, c) => sum + (c.ceu_hours || 0), 0),
        revenue: courses.reduce((sum, c) => sum + (c.price_cents || 0), 0) / 100,
        completions: 0 // TODO: Implement from user progress data
    };
    
    document.getElementById('courseStatTotal').textContent = stats.total;
    document.getElementById('courseStatPublished').textContent = stats.published;
    document.getElementById('courseStatDrafts').textContent = stats.drafts;
    document.getElementById('courseStatCeuHours').textContent = stats.ceuHours.toFixed(1);
    document.getElementById('courseStatRevenue').textContent = `$${stats.revenue.toFixed(2)}`;
    document.getElementById('courseStatCompletions').textContent = stats.completions;
}

// ============================================================================
// COURSE FILTERING AND SEARCHING
// ============================================================================

function searchCourses() {
    const query = document.getElementById('courseSearch').value.toLowerCase();
    const filtered = courseData.filter(course => 
        course.title.toLowerCase().includes(query) ||
        (course.description && course.description.toLowerCase().includes(query)) ||
        (course.tags && course.tags.some(tag => tag.toLowerCase().includes(query)))
    );
    renderCourseList(filtered);
}

function filterCourses() {
    const statusFilter = document.getElementById('courseStatusFilter').value;
    const categoryFilter = document.getElementById('courseCategoryFilter').value;
    const professionFilter = document.getElementById('courseProfessionFilter').value;
    
    let filtered = courseData;
    
    if (statusFilter && statusFilter !== 'all') {
        filtered = filtered.filter(course => course.status === statusFilter);
    }
    
    if (categoryFilter) {
        filtered = filtered.filter(course => course.category === categoryFilter);
    }
    
    if (professionFilter) {
        filtered = filtered.filter(course => 
            Array.isArray(course.target_audience) && course.target_audience.includes(professionFilter)
        );
    }
    
    renderCourseList(filtered);
}

function refreshCourses() {
    document.getElementById('courseListContainer').innerHTML = `
        <div class="loading-state" style="text-align:center;color:#64748b;padding:3rem;">
            <div style="font-size:3rem;margin-bottom:1rem;">🔄</div>
            <p>Refreshing courses...</p>
        </div>
    `;
    loadCourses();
}

// ============================================================================
// COURSE CREATION AND EDITING
// ============================================================================

function showCreateCourseModal() {
    document.getElementById('courseModalTitle').textContent = 'Create New Course';
    document.getElementById('courseForm').reset();
    document.getElementById('courseId').value = '';
    
    // Set defaults
    document.getElementById('courseStatus').value = 'draft';
    document.getElementById('courseDifficulty').value = 'intermediate';
    document.getElementById('courseCeCategory').value = 'general';
    document.getElementById('coursePackageOnly').value = 'false';
    document.getElementById('courseFeatured').value = 'false';
    
    // Clear learning objectives
    document.getElementById('learningObjectivesContainer').innerHTML = '';
    addLearningObjective(); // Add one blank objective
    
    // Auto-generate slug from title
    document.getElementById('courseTitle').addEventListener('input', function() {
        if (!document.getElementById('courseSlug').value) {
            const slug = this.value.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
            document.getElementById('courseSlug').value = slug;
        }
    });
    
    showModal('courseModal');
}

function editCourse(courseId) {
    const course = courseData.find(c => c.id === courseId);
    if (!course) return;
    
    currentCourse = course;
    
    document.getElementById('courseModalTitle').textContent = 'Edit Course';
    document.getElementById('courseId').value = course.id;
    document.getElementById('courseTitle').value = course.title || '';
    document.getElementById('courseSubtitle').value = course.subtitle || '';
    document.getElementById('courseSlug').value = course.slug || '';
    document.getElementById('courseStatus').value = course.status || 'draft';
    document.getElementById('courseDescription').value = course.description || '';
    document.getElementById('courseCeuHours').value = course.ceu_hours || '';
    document.getElementById('courseCeCategory').value = course.ce_category || 'general';
    document.getElementById('courseCategory').value = course.category || '';
    document.getElementById('courseDifficulty').value = course.difficulty_level || 'intermediate';
    document.getElementById('coursePrice').value = course.price_cents ? (course.price_cents / 100) : '';
    document.getElementById('coursePackageOnly').value = course.package_only ? 'true' : 'false';
    document.getElementById('courseFeatured').value = course.featured ? 'true' : 'false';
    document.getElementById('courseSortOrder').value = course.sort_order || 0;
    document.getElementById('courseThumbnail').value = course.thumbnail_url || '';
    document.getElementById('coursePreviewVideo').value = course.preview_video_url || '';
    document.getElementById('courseMetaTitle').value = course.meta_title || '';
    document.getElementById('courseMetaDescription').value = course.meta_description || '';
    document.getElementById('courseTags').value = Array.isArray(course.tags) ? course.tags.join(', ') : '';
    
    // Set target audience checkboxes
    const audiences = Array.isArray(course.target_audience) ? course.target_audience : [];
    document.getElementById('targetPT').checked = audiences.includes('PT');
    document.getElementById('targetPTA').checked = audiences.includes('PTA');
    document.getElementById('targetOT').checked = audiences.includes('OT');
    document.getElementById('targetCOTA').checked = audiences.includes('COTA');
    
    // Load learning objectives
    loadLearningObjectives(course.learning_objectives || []);
    
    showModal('courseModal');
}

function loadLearningObjectives(objectives) {
    const container = document.getElementById('learningObjectivesContainer');
    container.innerHTML = '';
    
    if (objectives.length === 0) {
        addLearningObjective();
        return;
    }
    
    objectives.forEach(objective => {
        addLearningObjective(objective);
    });
}

function addLearningObjective(text = '') {
    const container = document.getElementById('learningObjectivesContainer');
    const index = container.children.length;
    
    const objectiveHtml = `
        <div class="form-group" style="display:flex;gap:0.5rem;align-items:center;">
            <input type="text" class="form-input learning-objective-input" 
                   placeholder="Students will be able to..." value="${escapeHtml(text)}" style="flex:1;">
            <button type="button" onclick="removeLearningObjective(this)" class="btn btn-small btn-danger">×</button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', objectiveHtml);
}

function removeLearningObjective(button) {
    button.parentElement.remove();
}

async function saveCourse(event) {
    event.preventDefault();
    
    try {
        const courseData = gatherCourseFormData();
        
        if (document.getElementById('courseId').value) {
            // Update existing course
            await updateCourse(courseData);
        } else {
            // Create new course
            await createCourse(courseData);
        }
        
        closeCourseModal();
        refreshCourses();
        showAdminToast('Course saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving course:', error);
        showAdminToast('Error saving course: ' + error.message, 'error');
    }
}

function gatherCourseFormData() {
    // Get target audience
    const targetAudience = [];
    if (document.getElementById('targetPT').checked) targetAudience.push('PT');
    if (document.getElementById('targetPTA').checked) targetAudience.push('PTA');
    if (document.getElementById('targetOT').checked) targetAudience.push('OT');
    if (document.getElementById('targetCOTA').checked) targetAudience.push('COTA');
    
    // Get learning objectives
    const learningObjectives = Array.from(document.querySelectorAll('.learning-objective-input'))
        .map(input => input.value.trim())
        .filter(text => text.length > 0);
    
    // Get tags
    const tags = document.getElementById('courseTags').value
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    
    const priceValue = document.getElementById('coursePrice').value;
    const price_cents = priceValue ? Math.round(parseFloat(priceValue) * 100) : 0;
    
    return {
        id: document.getElementById('courseId').value || undefined,
        title: document.getElementById('courseTitle').value.trim(),
        subtitle: document.getElementById('courseSubtitle').value.trim() || null,
        slug: document.getElementById('courseSlug').value.trim(),
        status: document.getElementById('courseStatus').value,
        description: document.getElementById('courseDescription').value.trim() || null,
        ceu_hours: parseFloat(document.getElementById('courseCeuHours').value),
        ce_category: document.getElementById('courseCeCategory').value,
        category: document.getElementById('courseCategory').value || null,
        difficulty_level: document.getElementById('courseDifficulty').value,
        price_cents: price_cents,
        package_only: document.getElementById('coursePackageOnly').value === 'true',
        featured: document.getElementById('courseFeatured').value === 'true',
        sort_order: parseInt(document.getElementById('courseSortOrder').value) || 0,
        target_audience: targetAudience,
        learning_objectives: learningObjectives,
        thumbnail_url: document.getElementById('courseThumbnail').value.trim() || null,
        preview_video_url: document.getElementById('coursePreviewVideo').value.trim() || null,
        meta_title: document.getElementById('courseMetaTitle').value.trim() || null,
        meta_description: document.getElementById('courseMetaDescription').value.trim() || null,
        tags: tags
    };
}

async function createCourse(courseData) {
    if (!window.DrTroySupabase) {
        throw new Error('Database connection not available');
    }
    
    const { data, error } = await window.DrTroySupabase.getClient()
        .from('courses')
        .insert([courseData])
        .select()
        .single();
    
    if (error) {
        throw new Error('Database error: ' + error.message);
    }
    
    return data;
}

async function updateCourse(courseData) {
    if (!window.DrTroySupabase) {
        throw new Error('Database connection not available');
    }
    
    const { data, error } = await window.DrTroySupabase.getClient()
        .from('courses')
        .update(courseData)
        .eq('id', courseData.id)
        .select()
        .single();
    
    if (error) {
        throw new Error('Database error: ' + error.message);
    }
    
    return data;
}

// ============================================================================
// COURSE CONTENT EDITING
// ============================================================================

function editCourseContent(courseId) {
    const course = courseData.find(c => c.id === courseId);
    if (!course) return;
    
    currentCourse = course;
    document.getElementById('courseContentModalTitle').textContent = `Content: ${course.title}`;
    
    loadCourseStructure(course);
    showModal('courseContentModal');
}

function loadCourseStructure(course) {
    const treeContainer = document.getElementById('moduleTree');
    
    if (!course.course_modules || course.course_modules.length === 0) {
        treeContainer.innerHTML = `
            <div style="text-align:center;color:#64748b;padding:2rem;">
                <p>No modules yet</p>
                <button onclick="addModule()" class="btn btn-small btn-primary">Add First Module</button>
            </div>
        `;
        return;
    }
    
    const modules = course.course_modules.sort((a, b) => a.order_index - b.order_index);
    
    treeContainer.innerHTML = modules.map(module => `
        <div class="module-item" data-module-id="${module.id}" onclick="selectModule('${module.id}')">
            <strong>${escapeHtml(module.title)}</strong>
            <div style="font-size:0.8rem;color:#64748b;">${module.course_lessons ? module.course_lessons.length : 0} lessons</div>
            ${module.course_lessons ? module.course_lessons.map(lesson => `
                <div class="lesson-item" data-lesson-id="${lesson.id}" onclick="event.stopPropagation(); selectLesson('${lesson.id}')">
                    ${escapeHtml(lesson.title)} (${lesson.lesson_type})
                </div>
            `).join('') : ''}
        </div>
    `).join('');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function closeCourseModal() {
    hideModal('courseModal');
}

function closeCourseContentModal() {
    hideModal('courseContentModal');
}

function showCourseError(message) {
    document.getElementById('courseListContainer').innerHTML = `
        <div style="text-align:center;color:#ef4444;padding:3rem;">
            <div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>
            <h3 style="margin:0 0 1rem;color:#dc2626;">Error Loading Courses</h3>
            <p style="margin:0 0 2rem;">${escapeHtml(message)}</p>
            <button onclick="refreshCourses()" class="btn btn-primary">Try Again</button>
        </div>
    `;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Auto-load courses when the courses tab is activated
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the courses tab and load data
    if (window.location.hash === '#courses' || document.querySelector('.main-tab[onclick*="courses"]')?.classList.contains('active')) {
        loadCourses();
    }
});

// Export functions for global access
window.CourseManagement = {
    loadCourses,
    showCreateCourseModal,
    editCourse,
    editCourseContent,
    refreshCourses,
    searchCourses,
    filterCourses,
    closeCourseModal,
    closeCourseContentModal
};