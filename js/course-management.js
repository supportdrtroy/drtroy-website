/**
 * DrTroy CE Platform: Advanced Course Management System
 * Professional-grade content management for continuing education
 */

// Global course management state
let courseData = [];
let currentCourse = null;
let currentModule = null;
let currentLesson = null;

// Maps Supabase course IDs to actual HTML file names
var COURSE_FILE_MAP = {
    'core-balance-001':    'balance-gait-001',
    'core-mobility-001':   'mobility-fall-001',
    'core-joint-001':      'joint-replacement-001',
    'core-geriatric-001':  'geriatric-care-001',
    'core-tech-001':       'healthcare-technology-001',
    'core-infection-001':  'infection-control-001',
    'core-neuro-001':      'pt-neuro-001',
    'core-education-001':  'patient-education-001',
    'core-agents-001':     'physical-agents-001',
    'core-postsurg-001':   'post-surgical-001',
    'core-doc-001':        'documentation-001',
    'ot-adl-001':          'ot-adl-001',
    'pt-msk-001':          'pt-msk-001'
};

// Helper: call admin-course-management Netlify function (bypasses RLS)
async function courseApi(method, body) {
    var session = window.DrTroySupabase ? await window.DrTroySupabase.getSession() : null;
    var headers = { 'Content-Type': 'application/json' };
    if (session && session.access_token) {
        headers['Authorization'] = 'Bearer ' + session.access_token;
    }
    var opts = { method: method, headers: headers };
    if (body && (method === 'POST' || method === 'PATCH' || method === 'DELETE')) {
        opts.body = JSON.stringify(body);
    }
    var resp = await fetch('/.netlify/functions/admin-course-management', opts);
    var json = await resp.json();
    if (!resp.ok) throw new Error(json.error || ('HTTP ' + resp.status));
    return json.data;
}

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

    var client = window.DrTroySupabase.getClient();
    if (!client) {
        throw new Error('Supabase client not initialized');
    }

    // Try query with module/lesson join first
    var result = await client
        .from('courses')
        .select('*, course_modules(*, course_lessons(*))')
        .order('created_at', { ascending: false });

    // Fallback: If join fails (tables may not exist), query courses only
    if (result.error) {
        console.warn('Module/lesson join failed, loading courses only:', result.error.message);
        result = await client
            .from('courses')
            .select('*')
            .order('created_at', { ascending: false });
    }

    if (result.error) {
        console.error('Database error:', result.error);
        return null;
    }

    // Sort modules and lessons by order_index
    if (result.data) {
        result.data.forEach(function(course) {
            if (course.course_modules) {
                course.course_modules.sort(function(a, b) { return (a.order_index || 0) - (b.order_index || 0); });
                course.course_modules.forEach(function(mod) {
                    if (mod.course_lessons) {
                        mod.course_lessons.sort(function(a, b) { return (a.order_index || 0) - (b.order_index || 0); });
                    }
                });
            }
        });
    }

    return result.data;
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
    var container = document.getElementById('courseListContainer');

    if (!courses || courses.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#64748b;padding:3rem;">' +
            '<div style="font-size:3rem;margin-bottom:1rem;">📚</div>' +
            '<h3 style="margin:0 0 1rem;color:#374151;">No courses yet</h3>' +
            '<p style="margin:0 0 2rem;">Get started by creating your first course</p>' +
            '<button onclick="showCreateCourseModal()" class="btn btn-primary">Create Your First Course</button>' +
            '</div>';
        return;
    }

    container.innerHTML = courses.map(function(course) { return renderCourseCard(course); }).join('');
}

function renderCourseCard(course) {
    var statusClass = course.status || 'draft';
    var price = course.price_cents ? (course.price_cents / 100).toFixed(2) : '0.00';
    var moduleCount = course.course_modules ? course.course_modules.length : 0;
    var lessonCount = course.course_modules ?
        course.course_modules.reduce(function(total, mod) { return total + (mod.course_lessons ? mod.course_lessons.length : 0); }, 0) : 0;

    var targetAudience = Array.isArray(course.target_audience) ?
        course.target_audience.join(', ') : (course.target_audience || '');

    var learningObjectives = '';
    if (Array.isArray(course.learning_objectives) && course.learning_objectives.length > 0) {
        learningObjectives = '<div class="learning-objectives"><h5>Learning Objectives:</h5><ul>' +
            course.learning_objectives.slice(0, 3).map(function(obj) { return '<li>' + escapeHtml(obj) + '</li>'; }).join('') +
            (course.learning_objectives.length > 3 ? '<li><em>+ more...</em></li>' : '') +
            '</ul></div>';
    }

    var publishBtn = course.status === 'published' ?
        '<button onclick="previewCourse(\'' + course.id + '\')" class="btn btn-secondary">👁️ Preview</button>' :
        '<button onclick="publishCourse(\'' + course.id + '\')" class="btn btn-primary">🚀 Publish</button>';

    return '<div class="course-card" data-course-id="' + course.id + '">' +
        '<div class="course-card-header">' +
            '<div style="flex: 1;">' +
                '<h3 class="course-title">' + escapeHtml(course.title) + '</h3>' +
                (course.subtitle ? '<p class="course-subtitle">' + escapeHtml(course.subtitle) + '</p>' : '') +
            '</div>' +
            '<span class="course-status ' + statusClass + '">' + statusClass + '</span>' +
        '</div>' +
        (course.description ? '<p class="course-description">' + escapeHtml(course.description) + '</p>' : '') +
        learningObjectives +
        '<div class="course-meta">' +
            '<div class="course-meta-item"><span>🎓</span><span>' + course.ceu_hours + ' CEU Hours</span></div>' +
            '<div class="course-meta-item"><span>👥</span><span>' + targetAudience + '</span></div>' +
            '<div class="course-meta-item"><span>💰</span><span>$' + price + '</span></div>' +
            '<div class="course-meta-item"><span>📋</span><span>' + moduleCount + ' modules, ' + lessonCount + ' lessons</span></div>' +
            (course.category ? '<div class="course-meta-item"><span>🏷️</span><span>' + escapeHtml(course.category) + '</span></div>' : '') +
        '</div>' +
        '<div class="course-actions">' +
            '<button onclick="editCourse(\'' + course.id + '\')" class="btn btn-secondary">✏️ Edit</button>' +
            '<button onclick="editCourseContent(\'' + course.id + '\')" class="btn btn-secondary">📝 Content</button>' +
            publishBtn +
            '<button onclick="duplicateCourse(\'' + course.id + '\')" class="btn btn-secondary">📋 Duplicate</button>' +
            '<button onclick="deleteCourse(\'' + course.id + '\')" class="btn btn-danger" style="margin-left:auto;">🗑️ Delete</button>' +
        '</div>' +
    '</div>';
}

function updateCourseStats(courses) {
    var stats = {
        total: courses.length,
        published: courses.filter(function(c) { return c.status === 'published'; }).length,
        drafts: courses.filter(function(c) { return c.status === 'draft'; }).length,
        ceuHours: courses.reduce(function(sum, c) { return sum + (c.ceu_hours || 0); }, 0),
        revenue: courses.reduce(function(sum, c) { return sum + (c.price_cents || 0); }, 0) / 100,
        completions: 0
    };

    var el = function(id) { return document.getElementById(id); };
    if (el('courseStatTotal'))       el('courseStatTotal').textContent = stats.total;
    if (el('courseStatPublished'))   el('courseStatPublished').textContent = stats.published;
    if (el('courseStatDrafts'))      el('courseStatDrafts').textContent = stats.drafts;
    if (el('courseStatCeuHours'))    el('courseStatCeuHours').textContent = stats.ceuHours.toFixed(1);
    if (el('courseStatRevenue'))     el('courseStatRevenue').textContent = '$' + stats.revenue.toFixed(2);
    if (el('courseStatCompletions')) el('courseStatCompletions').textContent = stats.completions;
}

// ============================================================================
// COURSE FILTERING AND SEARCHING
// ============================================================================

function searchCourses() {
    var query = document.getElementById('courseSearch').value.toLowerCase();
    var filtered = courseData.filter(function(course) {
        return course.title.toLowerCase().includes(query) ||
            (course.description && course.description.toLowerCase().includes(query)) ||
            (course.tags && course.tags.some(function(tag) { return tag.toLowerCase().includes(query); }));
    });
    renderCourseList(filtered);
}

function filterCourses() {
    var statusFilter = document.getElementById('courseStatusFilter').value;
    var categoryFilter = document.getElementById('courseCategoryFilter').value;
    var professionFilter = document.getElementById('courseProfessionFilter').value;

    var filtered = courseData;

    if (statusFilter && statusFilter !== 'all') {
        filtered = filtered.filter(function(course) { return course.status === statusFilter; });
    }

    if (categoryFilter) {
        filtered = filtered.filter(function(course) { return course.category === categoryFilter; });
    }

    if (professionFilter) {
        filtered = filtered.filter(function(course) {
            return Array.isArray(course.target_audience) && course.target_audience.includes(professionFilter);
        });
    }

    renderCourseList(filtered);
}

async function refreshCourses() {
    document.getElementById('courseListContainer').innerHTML =
        '<div class="loading-state" style="text-align:center;color:#64748b;padding:3rem;">' +
        '<div style="font-size:3rem;margin-bottom:1rem;">🔄</div>' +
        '<p>Refreshing courses...</p></div>';
    await loadCourses();
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
            var slug = this.value.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
            document.getElementById('courseSlug').value = slug;
        }
    });

    showModal('courseModal');
}

function editCourse(courseId) {
    var course = courseData.find(function(c) { return c.id === courseId; });
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
    var audiences = Array.isArray(course.target_audience) ? course.target_audience : [];
    document.getElementById('targetPT').checked = audiences.includes('PT');
    document.getElementById('targetPTA').checked = audiences.includes('PTA');
    document.getElementById('targetOT').checked = audiences.includes('OT');
    document.getElementById('targetCOTA').checked = audiences.includes('COTA');

    // Load learning objectives
    loadLearningObjectives(course.learning_objectives || []);

    showModal('courseModal');
}

function loadLearningObjectives(objectives) {
    var container = document.getElementById('learningObjectivesContainer');
    container.innerHTML = '';

    if (objectives.length === 0) {
        addLearningObjective();
        return;
    }

    objectives.forEach(function(objective) {
        addLearningObjective(objective);
    });
}

function addLearningObjective(text) {
    text = text || '';
    var container = document.getElementById('learningObjectivesContainer');

    var objectiveHtml = '<div class="form-group" style="display:flex;gap:0.5rem;align-items:center;">' +
        '<input type="text" class="form-input learning-objective-input" ' +
        'placeholder="Students will be able to..." value="' + escapeHtml(text) + '" style="flex:1;">' +
        '<button type="button" onclick="removeLearningObjective(this)" class="btn btn-small btn-danger">×</button>' +
        '</div>';

    container.insertAdjacentHTML('beforeend', objectiveHtml);
}

function removeLearningObjective(button) {
    button.parentElement.remove();
}

async function saveCourse(event) {
    event.preventDefault();

    try {
        var formData = gatherCourseFormData();

        if (document.getElementById('courseId').value) {
            await updateCourse(formData);
        } else {
            await createCourse(formData);
        }

        closeCourseModal();
        refreshCourses();
        if (typeof showAdminToast === 'function') showAdminToast('Course saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving course:', error);
        if (typeof showAdminToast === 'function') showAdminToast('Error saving course: ' + error.message, 'error');
    }
}

function gatherCourseFormData() {
    var targetAudience = [];
    if (document.getElementById('targetPT').checked) targetAudience.push('PT');
    if (document.getElementById('targetPTA').checked) targetAudience.push('PTA');
    if (document.getElementById('targetOT').checked) targetAudience.push('OT');
    if (document.getElementById('targetCOTA').checked) targetAudience.push('COTA');

    var learningObjectives = Array.from(document.querySelectorAll('.learning-objective-input'))
        .map(function(input) { return input.value.trim(); })
        .filter(function(text) { return text.length > 0; });

    var tags = document.getElementById('courseTags').value
        .split(',')
        .map(function(tag) { return tag.trim(); })
        .filter(function(tag) { return tag.length > 0; });

    var priceValue = document.getElementById('coursePrice').value;
    var price_cents = priceValue ? Math.round(parseFloat(priceValue) * 100) : 0;

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

async function createCourse(data) {
    if (!window.DrTroySupabase) {
        throw new Error('Database connection not available');
    }

    var result = await window.DrTroySupabase.getClient()
        .from('courses')
        .insert([data])
        .select()
        .single();

    if (result.error) {
        throw new Error('Database error: ' + result.error.message);
    }

    return result.data;
}

async function updateCourse(data) {
    if (!window.DrTroySupabase) {
        throw new Error('Database connection not available');
    }

    var id = data.id;
    var updateData = {};
    Object.keys(data).forEach(function(k) { if (k !== 'id') updateData[k] = data[k]; });

    var result = await window.DrTroySupabase.getClient()
        .from('courses')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (result.error) {
        throw new Error('Database error: ' + result.error.message);
    }

    return result.data;
}

// ============================================================================
// COURSE CARD ACTIONS (Delete, Duplicate, Publish, Preview)
// ============================================================================

async function deleteCourse(courseId) {
    var course = courseData.find(function(c) { return c.id === courseId; });
    if (!course) return;

    var msg = course.status === 'published'
        ? 'Delete "' + course.title + '"? This course is PUBLISHED and may have enrollments.'
        : 'Delete "' + course.title + '"? This cannot be undone.';

    if (!confirm(msg)) return;

    try {
        var client = window.DrTroySupabase.getClient();
        var result = await client.from('courses').delete().eq('id', courseId);

        if (result.error) throw new Error(result.error.message);

        if (typeof showAdminToast === 'function') showAdminToast('Course deleted', 'success');
        await refreshCourses();
    } catch (err) {
        console.error('Delete course error:', err);
        if (typeof showAdminToast === 'function') showAdminToast('Error deleting course: ' + err.message, 'error');
    }
}

async function duplicateCourse(courseId) {
    var course = courseData.find(function(c) { return c.id === courseId; });
    if (!course) return;

    if (!confirm('Duplicate "' + course.title + '"?')) return;

    try {
        var newCourse = {};
        // Copy only safe fields
        var copyFields = ['title','subtitle','description','ceu_hours','ce_category','category',
            'difficulty_level','price_cents','package_only','featured','sort_order','target_audience',
            'learning_objectives','thumbnail_url','preview_video_url','meta_title','meta_description','tags'];
        copyFields.forEach(function(f) { if (course[f] !== undefined) newCourse[f] = course[f]; });

        newCourse.title = course.title + ' (Copy)';
        newCourse.slug = (course.slug || 'course') + '-copy-' + Date.now();
        newCourse.status = 'draft';

        var client = window.DrTroySupabase.getClient();
        var result = await client.from('courses').insert([newCourse]).select().single();

        if (result.error) throw new Error(result.error.message);

        if (typeof showAdminToast === 'function') showAdminToast('Course duplicated as draft', 'success');
        await refreshCourses();
    } catch (err) {
        console.error('Duplicate course error:', err);
        if (typeof showAdminToast === 'function') showAdminToast('Error duplicating course: ' + err.message, 'error');
    }
}

async function publishCourse(courseId) {
    var course = courseData.find(function(c) { return c.id === courseId; });
    if (!course) return;

    if (!confirm('Publish "' + course.title + '"? This will make it visible to students.')) return;

    try {
        var client = window.DrTroySupabase.getClient();
        var result = await client.from('courses')
            .update({ status: 'published', published_at: new Date().toISOString() })
            .eq('id', courseId);

        if (result.error) throw new Error(result.error.message);

        if (typeof showAdminToast === 'function') showAdminToast('Course published!', 'success');
        await refreshCourses();
    } catch (err) {
        console.error('Publish course error:', err);
        if (typeof showAdminToast === 'function') showAdminToast('Error publishing course: ' + err.message, 'error');
    }
}

function previewCourse(courseId) {
    var course;
    if (courseId) {
        course = courseData.find(function(c) { return c.id === courseId; });
    } else {
        course = currentCourse;
    }
    if (!course) return;

    // Check COURSE_FILE_MAP for legacy static HTML courses
    var fileId = COURSE_FILE_MAP[courseId] || COURSE_FILE_MAP[course.slug];
    if (fileId) {
        window.open('/courses/' + fileId + '-progressive.html', '_blank');
        return;
    }

    // Try slug-based lookup
    if (course.slug) {
        window.open('/courses/' + course.slug + '-progressive.html', '_blank');
        return;
    }

    if (typeof showAdminToast === 'function') showAdminToast('No preview available for this course yet', 'error');
}

// ============================================================================
// COURSE CONTENT EDITING
// ============================================================================

function editCourseContent(courseId) {
    var course = courseData.find(function(c) { return c.id === courseId; });
    if (!course) return;

    currentCourse = course;
    currentModule = null;
    currentLesson = null;
    document.getElementById('courseContentModalTitle').textContent = 'Content: ' + course.title;

    loadCourseStructure(course);
    resetContentEditor();
    showModal('courseContentModal');
}

function resetContentEditor() {
    document.getElementById('contentEditorTitle').textContent = 'Select content to edit';
    document.getElementById('contentEditor').innerHTML =
        '<div style="text-align:center;color:#64748b;padding:3rem;">' +
        '<div style="font-size:3rem;margin-bottom:1rem;">📝</div>' +
        '<p>Select a module or lesson from the left to edit its content</p></div>';
}

function loadCourseStructure(course) {
    var treeContainer = document.getElementById('moduleTree');

    if (!course.course_modules || course.course_modules.length === 0) {
        treeContainer.innerHTML =
            '<div style="text-align:center;color:#64748b;padding:2rem;">' +
            '<p>No modules yet</p>' +
            '<button onclick="addModule()" class="btn btn-small btn-primary">Add First Module</button></div>';
        return;
    }

    var modules = course.course_modules.sort(function(a, b) { return (a.order_index || 0) - (b.order_index || 0); });

    treeContainer.innerHTML = modules.map(function(module) {
        var lessonCount = module.course_lessons ? module.course_lessons.length : 0;
        var lessonsHtml = '';
        if (module.course_lessons) {
            lessonsHtml = module.course_lessons.map(function(lesson) {
                var activeClass = (currentLesson && currentLesson.id === lesson.id) ? ' active' : '';
                return '<div class="lesson-item' + activeClass + '" data-lesson-id="' + lesson.id + '" ' +
                    'onclick="event.stopPropagation(); selectLesson(\'' + lesson.id + '\')">' +
                    escapeHtml(lesson.title) + ' <span style="opacity:0.6;">(' + (lesson.lesson_type || 'content') + ')</span></div>';
            }).join('');
        }
        var activeClass = (currentModule && currentModule.id === module.id && !currentLesson) ? ' active' : '';
        return '<div class="module-item' + activeClass + '" data-module-id="' + module.id + '" ' +
            'onclick="selectModule(\'' + module.id + '\')">' +
            '<strong>' + escapeHtml(module.title) + '</strong>' +
            '<div style="font-size:0.8rem;color:#64748b;">' + lessonCount + ' lessons</div>' +
            lessonsHtml + '</div>';
    }).join('');
}

// ============================================================================
// MODULE CRUD
// ============================================================================

async function addModule() {
    if (!currentCourse) return;

    var title = prompt('Module title:');
    if (!title || !title.trim()) return;

    try {
        var modules = currentCourse.course_modules || [];
        var nextOrder = modules.length > 0
            ? Math.max.apply(null, modules.map(function(m) { return m.order_index || 0; })) + 1
            : 1;

        var data = await courseApi('POST', {
            resource: 'module',
            course_id: currentCourse.id,
            title: title.trim(),
            order_index: nextOrder
        });

        // Update local state
        if (!currentCourse.course_modules) currentCourse.course_modules = [];
        if (data) { data.course_lessons = []; }
        currentCourse.course_modules.push(data || { id: 'temp-' + Date.now(), title: title.trim(), order_index: nextOrder, course_lessons: [] });

        loadCourseStructure(currentCourse);
        if (typeof showAdminToast === 'function') showAdminToast('Module added', 'success');
    } catch (err) {
        console.error('Add module error:', err);
        if (typeof showAdminToast === 'function') showAdminToast('Error adding module: ' + err.message, 'error');
    }
}

function selectModule(moduleId) {
    if (!currentCourse || !currentCourse.course_modules) return;

    var module = currentCourse.course_modules.find(function(m) { return m.id === moduleId; });
    if (!module) return;

    currentModule = module;
    currentLesson = null;

    // Re-render tree to update active states
    loadCourseStructure(currentCourse);

    // Render module editor in right panel
    document.getElementById('contentEditorTitle').textContent = 'Edit Module';
    document.getElementById('contentEditor').innerHTML =
        '<div style="padding:0.5rem;">' +
            '<div class="form-group" style="margin-bottom:1rem;">' +
                '<label class="form-label" style="font-weight:600;margin-bottom:0.4rem;display:block;">Module Title</label>' +
                '<input type="text" id="editModuleTitle" class="form-input" value="' + escapeHtml(module.title) + '">' +
            '</div>' +
            '<div class="form-group" style="margin-bottom:1rem;">' +
                '<label class="form-label" style="font-weight:600;margin-bottom:0.4rem;display:block;">Description</label>' +
                '<textarea id="editModuleDescription" class="form-input" rows="3" ' +
                'placeholder="Optional module description">' + escapeHtml(module.description || '') + '</textarea>' +
            '</div>' +
            '<div class="form-group" style="margin-bottom:1.5rem;">' +
                '<label class="form-label" style="font-weight:600;margin-bottom:0.4rem;display:block;">Estimated Duration (minutes)</label>' +
                '<input type="number" id="editModuleDuration" class="form-input" ' +
                'value="' + (module.estimated_duration || '') + '" placeholder="e.g., 45">' +
            '</div>' +
            '<div style="display:flex;gap:0.75rem;flex-wrap:wrap;">' +
                '<button onclick="deleteModule(\'' + module.id + '\')" class="btn btn-danger">🗑️ Delete Module</button>' +
                '<button onclick="addLesson(\'' + module.id + '\')" class="btn btn-secondary">+ Add Lesson</button>' +
                '<button onclick="saveModule(\'' + module.id + '\')" class="btn btn-primary" style="margin-left:auto;">💾 Save Module</button>' +
            '</div>' +
        '</div>';
}

async function saveModule(moduleId) {
    try {
        var title = document.getElementById('editModuleTitle').value.trim();
        var description = document.getElementById('editModuleDescription').value.trim() || null;
        var estimated_duration = parseInt(document.getElementById('editModuleDuration').value) || null;

        if (!title) {
            if (typeof showAdminToast === 'function') showAdminToast('Module title is required', 'error');
            return;
        }

        await courseApi('PATCH', {
            resource: 'module',
            id: moduleId,
            title: title,
            description: description,
            estimated_duration: estimated_duration
        });

        // Update local state
        var mod = currentCourse.course_modules.find(function(m) { return m.id === moduleId; });
        if (mod) {
            mod.title = title;
            mod.description = description;
            mod.estimated_duration = estimated_duration;
        }

        loadCourseStructure(currentCourse);
        if (typeof showAdminToast === 'function') showAdminToast('Module saved', 'success');
    } catch (err) {
        console.error('Save module error:', err);
        if (typeof showAdminToast === 'function') showAdminToast('Error saving module: ' + err.message, 'error');
    }
}

async function deleteModule(moduleId) {
    if (!confirm('Delete this module and ALL its lessons? This cannot be undone.')) return;

    try {
        await courseApi('DELETE', { resource: 'module', id: moduleId });

        // Update local state
        currentCourse.course_modules = currentCourse.course_modules.filter(function(m) { return m.id !== moduleId; });
        currentModule = null;

        loadCourseStructure(currentCourse);
        resetContentEditor();
        if (typeof showAdminToast === 'function') showAdminToast('Module deleted', 'success');
    } catch (err) {
        console.error('Delete module error:', err);
        if (typeof showAdminToast === 'function') showAdminToast('Error deleting module: ' + err.message, 'error');
    }
}

// ============================================================================
// LESSON CRUD
// ============================================================================

async function addLesson(moduleId) {
    var title = prompt('Lesson title:');
    if (!title || !title.trim()) return;

    try {
        var mod = currentCourse.course_modules.find(function(m) { return m.id === moduleId; });
        var lessons = (mod && mod.course_lessons) ? mod.course_lessons : [];
        var nextOrder = lessons.length > 0
            ? Math.max.apply(null, lessons.map(function(l) { return l.order_index || 0; })) + 1
            : 1;

        var data = await courseApi('POST', {
            resource: 'lesson',
            module_id: moduleId,
            title: title.trim(),
            lesson_type: 'content',
            order_index: nextOrder
        });

        // Update local state
        if (!mod.course_lessons) mod.course_lessons = [];
        mod.course_lessons.push(data || { id: 'temp-' + Date.now(), title: title.trim(), lesson_type: 'content', order_index: nextOrder });

        loadCourseStructure(currentCourse);
        if (typeof showAdminToast === 'function') showAdminToast('Lesson added', 'success');
    } catch (err) {
        console.error('Add lesson error:', err);
        if (typeof showAdminToast === 'function') showAdminToast('Error adding lesson: ' + err.message, 'error');
    }
}

function selectLesson(lessonId) {
    if (!currentCourse || !currentCourse.course_modules) return;

    var foundLesson = null;
    var parentModule = null;

    for (var i = 0; i < currentCourse.course_modules.length; i++) {
        var mod = currentCourse.course_modules[i];
        if (!mod.course_lessons) continue;
        var lesson = mod.course_lessons.find(function(l) { return l.id === lessonId; });
        if (lesson) {
            foundLesson = lesson;
            parentModule = mod;
            break;
        }
    }

    if (!foundLesson) return;

    currentModule = parentModule;
    currentLesson = foundLesson;

    // Re-render tree to update active states
    loadCourseStructure(currentCourse);

    // Render lesson editor in right panel
    document.getElementById('contentEditorTitle').textContent = 'Edit Lesson';
    document.getElementById('contentEditor').innerHTML =
        '<div style="padding:0.5rem;">' +
            '<div class="form-group" style="margin-bottom:1rem;">' +
                '<label class="form-label" style="font-weight:600;margin-bottom:0.4rem;display:block;">Lesson Title</label>' +
                '<input type="text" id="editLessonTitle" class="form-input" value="' + escapeHtml(foundLesson.title) + '">' +
            '</div>' +
            '<div class="form-group" style="margin-bottom:1rem;">' +
                '<label class="form-label" style="font-weight:600;margin-bottom:0.4rem;display:block;">Lesson Type</label>' +
                '<select id="editLessonType" class="form-input">' +
                    '<option value="content"' + (foundLesson.lesson_type === 'content' ? ' selected' : '') + '>Content (HTML)</option>' +
                    '<option value="video"' + (foundLesson.lesson_type === 'video' ? ' selected' : '') + '>Video</option>' +
                    '<option value="assessment"' + (foundLesson.lesson_type === 'assessment' ? ' selected' : '') + '>Assessment</option>' +
                    '<option value="resource"' + (foundLesson.lesson_type === 'resource' ? ' selected' : '') + '>Resource</option>' +
                '</select>' +
            '</div>' +
            '<div class="form-group" style="margin-bottom:1rem;">' +
                '<label class="form-label" style="font-weight:600;margin-bottom:0.4rem;display:block;">Video URL</label>' +
                '<input type="url" id="editLessonVideoUrl" class="form-input" ' +
                'value="' + escapeHtml(foundLesson.video_url || '') + '" placeholder="https://vimeo.com/...">' +
            '</div>' +
            '<div class="form-group" style="margin-bottom:1rem;">' +
                '<label class="form-label" style="font-weight:600;margin-bottom:0.4rem;display:block;">Content (HTML)</label>' +
                '<textarea id="editLessonContent" class="form-input" rows="10" ' +
                'style="font-family:monospace;font-size:0.85rem;" ' +
                'placeholder="Enter lesson HTML content...">' + escapeHtml(foundLesson.content || '') + '</textarea>' +
            '</div>' +
            '<div class="form-group" style="margin-bottom:1.5rem;">' +
                '<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">' +
                '<input type="checkbox" id="editLessonRequired"' + (foundLesson.required !== false ? ' checked' : '') + '>' +
                ' Required for completion</label>' +
            '</div>' +
            '<div style="display:flex;gap:0.75rem;flex-wrap:wrap;">' +
                '<button onclick="deleteLesson(\'' + foundLesson.id + '\')" class="btn btn-danger">🗑️ Delete Lesson</button>' +
                '<button onclick="saveLesson(\'' + foundLesson.id + '\')" class="btn btn-primary" style="margin-left:auto;">💾 Save Lesson</button>' +
            '</div>' +
        '</div>';
}

async function saveLesson(lessonId) {
    try {
        var title = document.getElementById('editLessonTitle').value.trim();
        var lesson_type = document.getElementById('editLessonType').value;
        var video_url = document.getElementById('editLessonVideoUrl').value.trim() || null;
        var content = document.getElementById('editLessonContent').value || null;
        var required = document.getElementById('editLessonRequired').checked;

        if (!title) {
            if (typeof showAdminToast === 'function') showAdminToast('Lesson title is required', 'error');
            return;
        }

        await courseApi('PATCH', {
            resource: 'lesson',
            id: lessonId,
            title: title,
            lesson_type: lesson_type,
            video_url: video_url,
            content: content,
            required: required
        });

        // Update local state
        for (var i = 0; i < currentCourse.course_modules.length; i++) {
            var mod = currentCourse.course_modules[i];
            if (!mod.course_lessons) continue;
            var lesson = mod.course_lessons.find(function(l) { return l.id === lessonId; });
            if (lesson) {
                lesson.title = title;
                lesson.lesson_type = lesson_type;
                lesson.video_url = video_url;
                lesson.content = content;
                lesson.required = required;
                break;
            }
        }

        loadCourseStructure(currentCourse);
        if (typeof showAdminToast === 'function') showAdminToast('Lesson saved', 'success');
    } catch (err) {
        console.error('Save lesson error:', err);
        if (typeof showAdminToast === 'function') showAdminToast('Error saving lesson: ' + err.message, 'error');
    }
}

async function deleteLesson(lessonId) {
    if (!confirm('Delete this lesson? This cannot be undone.')) return;

    try {
        await courseApi('DELETE', { resource: 'lesson', id: lessonId });

        // Update local state
        for (var i = 0; i < currentCourse.course_modules.length; i++) {
            var mod = currentCourse.course_modules[i];
            if (!mod.course_lessons) continue;
            mod.course_lessons = mod.course_lessons.filter(function(l) { return l.id !== lessonId; });
        }
        currentLesson = null;

        loadCourseStructure(currentCourse);
        resetContentEditor();
        if (typeof showAdminToast === 'function') showAdminToast('Lesson deleted', 'success');
    } catch (err) {
        console.error('Delete lesson error:', err);
        if (typeof showAdminToast === 'function') showAdminToast('Error deleting lesson: ' + err.message, 'error');
    }
}

function saveAllContent() {
    if (typeof showAdminToast === 'function') {
        showAdminToast('Content saves automatically when you click Save on each item', 'success');
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

function showModal(modalId) {
    var el = document.getElementById(modalId);
    el.classList.add('active');
    el.style.display = ''; // Clear any leftover inline display
}

function hideModal(modalId) {
    var el = document.getElementById(modalId);
    el.classList.remove('active');
    el.style.display = '';
}

function closeCourseModal() {
    hideModal('courseModal');
}

function closeCourseContentModal() {
    hideModal('courseContentModal');
}

function showCourseError(message) {
    document.getElementById('courseListContainer').innerHTML =
        '<div style="text-align:center;color:#ef4444;padding:3rem;">' +
        '<div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>' +
        '<h3 style="margin:0 0 1rem;color:#dc2626;">Error Loading Courses</h3>' +
        '<p style="margin:0 0 2rem;">' + escapeHtml(message) + '</p>' +
        '<button onclick="refreshCourses()" class="btn btn-primary">Try Again</button></div>';
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.hash === '#courses' || document.querySelector('.main-tab[onclick*="courses"]')?.classList.contains('active')) {
        loadCourses();
    }
});

// Export functions for global access
window.CourseManagement = {
    getCourseData: function() { return courseData; },
    loadCourses: loadCourses,
    showCreateCourseModal: showCreateCourseModal,
    editCourse: editCourse,
    editCourseContent: editCourseContent,
    refreshCourses: refreshCourses,
    searchCourses: searchCourses,
    filterCourses: filterCourses,
    closeCourseModal: closeCourseModal,
    closeCourseContentModal: closeCourseContentModal,
    deleteCourse: deleteCourse,
    duplicateCourse: duplicateCourse,
    publishCourse: publishCourse,
    previewCourse: previewCourse,
    addModule: addModule,
    selectModule: selectModule,
    saveModule: saveModule,
    deleteModule: deleteModule,
    addLesson: addLesson,
    selectLesson: selectLesson,
    saveLesson: saveLesson,
    deleteLesson: deleteLesson,
    saveAllContent: saveAllContent
};
