// DrTroy CE Platform - Database Abstraction Layer
// Handles local storage until Supabase integration

class DrTroyDatabase {
    constructor() {
        this.dbName = 'DrTroyeCE';
        this.version = 1;
        this.db = null;
        this.initialized = false;
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                console.error('Database failed to open');
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.initialized = true;
                console.log('Database opened successfully');
                resolve();
            };
            
            request.onupgradeneeded = (e) => {
                this.db = e.target.result;
                
                // Users store
                if (!this.db.objectStoreNames.contains('users')) {
                    const userStore = this.db.createObjectStore('users', { keyPath: 'id' });
                    userStore.createIndex('email', 'email', { unique: true });
                    userStore.createIndex('license_number', 'license_number', { unique: false });
                }
                
                // Courses store
                if (!this.db.objectStoreNames.contains('courses')) {
                    const courseStore = this.db.createObjectStore('courses', { keyPath: 'id' });
                    courseStore.createIndex('course_code', 'course_code', { unique: true });
                    courseStore.createIndex('category', 'category', { unique: false });
                }
                
                // Course enrollments store
                if (!this.db.objectStoreNames.contains('course_enrollments')) {
                    const enrollmentStore = this.db.createObjectStore('course_enrollments', { keyPath: 'id' });
                    enrollmentStore.createIndex('user_id', 'user_id', { unique: false });
                    enrollmentStore.createIndex('course_id', 'course_id', { unique: false });
                    enrollmentStore.createIndex('user_course', ['user_id', 'course_id'], { unique: true });
                }
                
                // Module progress store
                if (!this.db.objectStoreNames.contains('module_progress')) {
                    const moduleStore = this.db.createObjectStore('module_progress', { keyPath: 'id' });
                    moduleStore.createIndex('enrollment_id', 'enrollment_id', { unique: false });
                    moduleStore.createIndex('enrollment_module', ['enrollment_id', 'module_number'], { unique: true });
                }
                
                // Certificates store
                if (!this.db.objectStoreNames.contains('certificates')) {
                    const certStore = this.db.createObjectStore('certificates', { keyPath: 'id' });
                    certStore.createIndex('certificate_id', 'certificate_id', { unique: true });
                    certStore.createIndex('user_id', 'user_id', { unique: false });
                }
                
                // Activity log store
                if (!this.db.objectStoreNames.contains('activity_log')) {
                    this.db.createObjectStore('activity_log', { keyPath: 'id' });
                }
                
                console.log('Database setup complete');
            };
        });
    }

    generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async waitForInit() {
        if (this.initialized) return;
        
        let attempts = 0;
        while (!this.initialized && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!this.initialized) {
            throw new Error('Database initialization timeout');
        }
    }

    // User Management
    async createUser(userData) {
        await this.waitForInit();
        
        const user = {
            id: this.generateId(),
            ...userData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_active: true,
            email_verified: false,
            last_login: null
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            
            // Check if email already exists
            const emailIndex = store.index('email');
            const emailCheck = emailIndex.get(userData.email);
            
            emailCheck.onsuccess = () => {
                if (emailCheck.result) {
                    reject(new Error('Email already exists'));
                    return;
                }
                
                const request = store.add(user);
                request.onsuccess = () => {
                    this.logActivity(user.id, null, 'user_registered', { email: user.email });
                    resolve(user);
                };
                request.onerror = () => reject(request.error);
            };
        });
    }

    async authenticateUser(email, password) {
        await this.waitForInit();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const index = store.index('email');
            
            const request = index.get(email);
            request.onsuccess = () => {
                const user = request.result;
                if (user && user.password_hash === this.hashPassword(password)) {
                    // Update last login
                    user.last_login = new Date().toISOString();
                    const updateTransaction = this.db.transaction(['users'], 'readwrite');
                    updateTransaction.objectStore('users').put(user);
                    
                    this.logActivity(user.id, null, 'login', { email });
                    resolve(user);
                } else {
                    reject(new Error('Invalid credentials'));
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getUserById(userId) {
        await this.waitForInit();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            
            const request = store.get(userId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateUser(userId, updateData) {
        await this.waitForInit();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            
            const request = store.get(userId);
            request.onsuccess = () => {
                const user = request.result;
                if (user) {
                    Object.assign(user, updateData, { updated_at: new Date().toISOString() });
                    const updateRequest = store.put(user);
                    updateRequest.onsuccess = () => resolve(user);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('User not found'));
                }
            };
        });
    }

    // Course Management
    async getCourses() {
        await this.waitForInit();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['courses'], 'readonly');
            const store = transaction.objectStore('courses');
            
            const request = store.getAll();
            request.onsuccess = () => {
                // Filter published courses
                const courses = request.result.filter(course => course.is_published);
                resolve(courses);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getCourse(courseId) {
        await this.waitForInit();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['courses'], 'readonly');
            const store = transaction.objectStore('courses');
            
            const request = store.get(courseId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async enrollUserInCourse(userId, courseId) {
        await this.waitForInit();
        
        const enrollment = {
            id: this.generateId(),
            user_id: userId,
            course_id: courseId,
            enrolled_at: new Date().toISOString(),
            status: 'enrolled',
            progress_percentage: 0,
            total_time_spent: 0,
            current_module: 1,
            quiz_attempts: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['course_enrollments'], 'readwrite');
            const store = transaction.objectStore('course_enrollments');
            
            // Check if already enrolled
            const index = store.index('user_course');
            const checkRequest = index.get([userId, courseId]);
            
            checkRequest.onsuccess = () => {
                if (checkRequest.result) {
                    resolve(checkRequest.result); // Already enrolled
                    return;
                }
                
                const request = store.add(enrollment);
                request.onsuccess = () => {
                    this.logActivity(userId, enrollment.id, 'course_enrolled', { courseId });
                    resolve(enrollment);
                };
                request.onerror = () => reject(request.error);
            };
        });
    }

    async getUserEnrollments(userId) {
        await this.waitForInit();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['course_enrollments', 'courses'], 'readonly');
            const enrollmentStore = transaction.objectStore('course_enrollments');
            const courseStore = transaction.objectStore('courses');
            const index = enrollmentStore.index('user_id');
            
            const request = index.getAll(userId);
            request.onsuccess = async () => {
                const enrollments = request.result;
                const enrichedEnrollments = [];
                
                for (const enrollment of enrollments) {
                    const courseRequest = courseStore.get(enrollment.course_id);
                    await new Promise((courseResolve) => {
                        courseRequest.onsuccess = () => {
                            enrollment.course = courseRequest.result;
                            enrichedEnrollments.push(enrollment);
                            courseResolve();
                        };
                    });
                }
                
                resolve(enrichedEnrollments);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async updateProgress(enrollmentId, moduleNumber, progressData) {
        await this.waitForInit();
        
        const moduleProgress = {
            id: this.generateId(),
            enrollment_id: enrollmentId,
            module_number: moduleNumber,
            ...progressData,
            updated_at: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['module_progress', 'course_enrollments'], 'readwrite');
            const moduleStore = transaction.objectStore('module_progress');
            const enrollmentStore = transaction.objectStore('course_enrollments');
            
            // Update module progress
            const index = moduleStore.index('enrollment_module');
            const existingRequest = index.get([enrollmentId, moduleNumber]);
            
            existingRequest.onsuccess = () => {
                const existingProgress = existingRequest.result;
                let request;
                
                if (existingProgress) {
                    Object.assign(existingProgress, progressData, { updated_at: new Date().toISOString() });
                    request = moduleStore.put(existingProgress);
                } else {
                    request = moduleStore.add(moduleProgress);
                }
                
                request.onsuccess = () => {
                    // Update overall enrollment progress
                    this.calculateOverallProgress(enrollmentId).then(() => {
                        resolve(existingProgress || moduleProgress);
                    });
                };
                request.onerror = () => reject(request.error);
            };
        });
    }

    async calculateOverallProgress(enrollmentId) {
        await this.waitForInit();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['module_progress', 'course_enrollments'], 'readwrite');
            const moduleStore = transaction.objectStore('module_progress');
            const enrollmentStore = transaction.objectStore('course_enrollments');
            
            const index = moduleStore.index('enrollment_id');
            const request = index.getAll(enrollmentId);
            
            request.onsuccess = () => {
                const modules = request.result;
                const completedModules = modules.filter(m => m.is_completed).length;
                const totalModules = modules.length || 1; // Avoid division by zero
                const progressPercentage = (completedModules / totalModules) * 100;
                
                // Update enrollment
                const enrollmentRequest = enrollmentStore.get(enrollmentId);
                enrollmentRequest.onsuccess = () => {
                    const enrollment = enrollmentRequest.result;
                    if (enrollment) {
                        enrollment.progress_percentage = progressPercentage;
                        enrollment.updated_at = new Date().toISOString();
                        
                        if (progressPercentage >= 100 && enrollment.status !== 'completed') {
                            enrollment.status = 'completed';
                            enrollment.completed_at = new Date().toISOString();
                            
                            // Generate certificate
                            this.generateCertificate(enrollment.user_id, enrollment.course_id, enrollmentId);
                        }
                        
                        enrollmentStore.put(enrollment);
                    }
                    resolve();
                };
            };
        });
    }

    async generateCertificate(userId, courseId, enrollmentId) {
        await this.waitForInit();
        
        const certificate = {
            id: this.generateId(),
            certificate_id: `DRTROY-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
            user_id: userId,
            course_id: courseId,
            enrollment_id: enrollmentId,
            issued_at: new Date().toISOString(),
            created_at: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['certificates'], 'readwrite');
            const store = transaction.objectStore('certificates');
            
            const request = store.add(certificate);
            request.onsuccess = () => {
                this.logActivity(userId, enrollmentId, 'certificate_issued', { 
                    certificateId: certificate.certificate_id,
                    courseId 
                });
                resolve(certificate);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getUserCertificates(userId) {
        await this.waitForInit();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['certificates', 'courses'], 'readonly');
            const certStore = transaction.objectStore('certificates');
            const courseStore = transaction.objectStore('courses');
            const index = certStore.index('user_id');
            
            const request = index.getAll(userId);
            request.onsuccess = async () => {
                const certificates = request.result;
                const enrichedCertificates = [];
                
                for (const cert of certificates) {
                    const courseRequest = courseStore.get(cert.course_id);
                    await new Promise((courseResolve) => {
                        courseRequest.onsuccess = () => {
                            cert.course = courseRequest.result;
                            enrichedCertificates.push(cert);
                            courseResolve();
                        };
                    });
                }
                
                resolve(enrichedCertificates);
            };
        });
    }

    async logActivity(userId, enrollmentId, activityType, activityData) {
        await this.waitForInit();
        
        const activity = {
            id: this.generateId(),
            user_id: userId,
            enrollment_id: enrollmentId,
            activity_type: activityType,
            activity_data: activityData,
            created_at: new Date().toISOString()
        };

        const transaction = this.db.transaction(['activity_log'], 'readwrite');
        const store = transaction.objectStore('activity_log');
        store.add(activity);
    }

    // Admin functions
    async getAllUsers() {
        await this.waitForInit();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllEnrollments() {
        await this.waitForInit();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['course_enrollments', 'users', 'courses'], 'readonly');
            const enrollmentStore = transaction.objectStore('course_enrollments');
            const userStore = transaction.objectStore('users');
            const courseStore = transaction.objectStore('courses');
            
            const request = enrollmentStore.getAll();
            request.onsuccess = async () => {
                const enrollments = request.result;
                const enrichedEnrollments = [];
                
                for (const enrollment of enrollments) {
                    const userRequest = userStore.get(enrollment.user_id);
                    const courseRequest = courseStore.get(enrollment.course_id);
                    
                    await Promise.all([
                        new Promise(resolve => {
                            userRequest.onsuccess = () => {
                                enrollment.user = userRequest.result;
                                resolve();
                            };
                        }),
                        new Promise(resolve => {
                            courseRequest.onsuccess = () => {
                                enrollment.course = courseRequest.result;
                                resolve();
                            };
                        })
                    ]);
                    
                    enrichedEnrollments.push(enrollment);
                }
                
                resolve(enrichedEnrollments);
            };
        });
    }

    async getDashboardStats() {
        await this.waitForInit();
        
        const [users, enrollments, certificates] = await Promise.all([
            this.getAllUsers(),
            this.getAllEnrollments(),
            new Promise((resolve) => {
                const transaction = this.db.transaction(['certificates'], 'readonly');
                const store = transaction.objectStore('certificates');
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
            })
        ]);

        const activeUsers = users.filter(u => u.is_active).length;
        const completedEnrollments = enrollments.filter(e => e.status === 'completed').length;
        const inProgressEnrollments = enrollments.filter(e => e.status === 'in_progress').length;
        
        return {
            totalUsers: users.length,
            activeUsers,
            totalEnrollments: enrollments.length,
            completedEnrollments,
            inProgressEnrollments,
            totalCertificates: certificates.length,
            courses: await this.getCourses()
        };
    }

    // Utility functions
    hashPassword(password) {
        // Simple hash for demo - in production, use bcrypt
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }

    // Seed initial data
    async seedInitialData() {
        const courses = await this.getCourses();
        if (courses.length > 0) return; // Already seeded

        const initialCourses = [
            {
                id: 'course-pt-msk-001',
                title: 'Musculoskeletal Physical Therapy Assessment and Treatment',
                description: 'Comprehensive course covering MSK examination, treatment planning, and outcome measures.',
                course_code: 'pt-msk-001',
                category: 'Musculoskeletal',
                credit_hours: 3.0,
                difficulty_level: 'Intermediate',
                learning_objectives: [
                    'Perform comprehensive MSK examinations',
                    'Develop evidence-based treatment plans',
                    'Apply appropriate outcome measures'
                ],
                target_audience: 'Physical Therapists, Physical Therapist Assistants',
                instructor_name: 'Dr. Troy Hounshell, PT, ScD',
                instructor_credentials: 'Physical Therapist, Doctor of Science',
                content_url: '/courses/pt-msk-001-progressive.html',
                estimated_duration_minutes: 180,
                is_published: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: 'course-patient-ed-001',
                title: 'Patient Education and Health Promotion',
                description: 'Evidence-based strategies for effective patient education and health behavior change.',
                course_code: 'patient-ed-001',
                category: 'Professional Development',
                credit_hours: 2.0,
                difficulty_level: 'Beginner',
                learning_objectives: [
                    'Apply adult learning principles',
                    'Assess patient learning needs',
                    'Implement effective teaching strategies'
                ],
                target_audience: 'All rehabilitation professionals',
                instructor_name: 'Dr. Troy Hounshell, PT, ScD',
                instructor_credentials: 'Physical Therapist, Doctor of Science',
                content_url: '/courses/patient-education-001-progressive.html',
                estimated_duration_minutes: 120,
                is_published: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: 'course-healthcare-tech-001',
                title: 'Healthcare Technology and Electronic Records',
                description: 'Modern healthcare technology including EHR systems, telehealth, and digital workflows.',
                course_code: 'healthcare-tech-001',
                category: 'Technology',
                credit_hours: 1.5,
                difficulty_level: 'Beginner',
                learning_objectives: [
                    'Navigate EHR systems effectively',
                    'Implement telehealth best practices',
                    'Ensure HIPAA compliance in digital workflows'
                ],
                target_audience: 'All healthcare professionals',
                instructor_name: 'Dr. Troy Hounshell, PT, ScD',
                instructor_credentials: 'Physical Therapist, Doctor of Science',
                content_url: '/courses/healthcare-technology-001-progressive.html',
                estimated_duration_minutes: 90,
                is_published: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: 'course-joint-replacement-001',
                title: 'Considerations in Lower Extremity Joint Replacements',
                description: 'Comprehensive guide to hip and knee replacement rehabilitation including precautions, timelines, and outcomes.',
                course_code: 'joint-replacement-001',
                category: 'Orthopedic',
                credit_hours: 3.0,
                difficulty_level: 'Advanced',
                learning_objectives: [
                    'Understand joint replacement surgical approaches',
                    'Apply appropriate precautions and progressions',
                    'Optimize rehabilitation outcomes'
                ],
                target_audience: 'Physical Therapists, Physical Therapist Assistants',
                instructor_name: 'Dr. Troy Hounshell, PT, ScD',
                instructor_credentials: 'Physical Therapist, Doctor of Science',
                content_url: '/courses/joint-replacement-001-progressive.html',
                estimated_duration_minutes: 180,
                is_published: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        ];

        const transaction = this.db.transaction(['courses'], 'readwrite');
        const store = transaction.objectStore('courses');
        
        initialCourses.forEach(course => {
            store.add(course);
        });

        console.log('✅ Initial course data seeded');
    }
}

// Global database instance
window.drTroyDB = new DrTroyDatabase();

// Initialize and seed data when database is ready
window.drTroyDB.init().then(() => {
    window.drTroyDB.seedInitialData();
});