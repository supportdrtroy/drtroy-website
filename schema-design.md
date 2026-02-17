# DrTroy CE Platform - Database Schema & System Architecture

## Database Schema (Supabase-Ready)

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    license_number VARCHAR(50),
    license_type VARCHAR(20), -- 'PT', 'PTA', 'OT', 'COTA'
    license_state VARCHAR(2),
    employer VARCHAR(255),
    phone VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    profile_image_url VARCHAR(500),
    billing_address JSONB,
    marketing_consent BOOLEAN DEFAULT false
);
```

### Courses Table
```sql
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_code VARCHAR(50) UNIQUE NOT NULL, -- 'pt-msk-001', etc.
    category VARCHAR(100), -- 'Musculoskeletal', 'Neurological', etc.
    credit_hours DECIMAL(3,2) NOT NULL,
    difficulty_level VARCHAR(20), -- 'Beginner', 'Intermediate', 'Advanced'
    learning_objectives TEXT[],
    prerequisites TEXT[],
    target_audience VARCHAR(255),
    instructor_name VARCHAR(255),
    instructor_bio TEXT,
    instructor_credentials VARCHAR(255),
    content_url VARCHAR(500) NOT NULL, -- URL to course HTML
    thumbnail_url VARCHAR(500),
    estimated_duration_minutes INTEGER,
    is_published BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    version VARCHAR(10) DEFAULT '1.0',
    price DECIMAL(8,2) DEFAULT 0.00,
    accreditation_info JSONB, -- APTA, state boards, etc.
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    published_at TIMESTAMP
);
```

### Course Enrollments Table
```sql
CREATE TABLE course_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    certificate_issued_at TIMESTAMP,
    certificate_id VARCHAR(50) UNIQUE,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    total_time_spent INTEGER DEFAULT 0, -- minutes
    current_module INTEGER DEFAULT 1,
    quiz_attempts INTEGER DEFAULT 0,
    final_score DECIMAL(5,2),
    passing_score DECIMAL(5,2) DEFAULT 70.00,
    status VARCHAR(20) DEFAULT 'enrolled', -- 'enrolled', 'in_progress', 'completed', 'expired'
    access_expires_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);
```

### Module Progress Table
```sql
CREATE TABLE module_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES course_enrollments(id) ON DELETE CASCADE,
    module_number INTEGER NOT NULL,
    module_title VARCHAR(255),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    time_spent INTEGER DEFAULT 0, -- minutes
    quiz_score DECIMAL(5,2),
    quiz_attempts INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(enrollment_id, module_number)
);
```

### Certificates Table
```sql
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id VARCHAR(50) UNIQUE NOT NULL, -- Human-readable: DRTROY-2026-001234
    user_id UUID NOT NULL REFERENCES users(id),
    course_id UUID NOT NULL REFERENCES courses(id),
    enrollment_id UUID NOT NULL REFERENCES course_enrollments(id),
    issued_at TIMESTAMP DEFAULT NOW(),
    credit_hours DECIMAL(3,2) NOT NULL,
    expiration_date TIMESTAMP,
    certificate_url VARCHAR(500), -- PDF download URL
    verification_url VARCHAR(500), -- Public verification URL
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP,
    revocation_reason TEXT,
    accreditation_numbers JSONB, -- Different state board numbers
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Quiz Responses Table
```sql
CREATE TABLE quiz_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES course_enrollments(id) ON DELETE CASCADE,
    module_number INTEGER NOT NULL,
    question_id VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    user_answer TEXT,
    is_correct BOOLEAN NOT NULL,
    response_time_seconds INTEGER,
    attempt_number INTEGER DEFAULT 1,
    responded_at TIMESTAMP DEFAULT NOW()
);
```

### Activity Log Table
```sql
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    enrollment_id UUID REFERENCES course_enrollments(id),
    activity_type VARCHAR(50) NOT NULL, -- 'login', 'module_start', 'module_complete', etc.
    activity_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Admin Users Table
```sql
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin', -- 'super_admin', 'admin', 'instructor'
    permissions JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);
```

## API Endpoints Structure

### Authentication
- `POST /api/auth/register` - Student registration
- `POST /api/auth/login` - Student login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset confirmation
- `GET /api/auth/verify-email/:token` - Email verification

### Student Dashboard
- `GET /api/student/profile` - Get student profile
- `PUT /api/student/profile` - Update student profile
- `GET /api/student/courses` - Get enrolled courses
- `GET /api/student/certificates` - Get earned certificates
- `GET /api/student/progress/:courseId` - Get course progress

### Course Management
- `GET /api/courses` - List published courses
- `GET /api/courses/:id` - Get course details
- `POST /api/courses/:id/enroll` - Enroll in course
- `PUT /api/courses/:id/progress` - Update progress
- `POST /api/courses/:id/complete` - Mark course complete

### Certificates
- `POST /api/certificates/generate` - Generate certificate
- `GET /api/certificates/:id/download` - Download certificate PDF
- `GET /api/verify/:certificateId` - Public certificate verification

### Admin Dashboard
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/users` - List all users
- `GET /api/admin/courses` - Manage courses
- `GET /api/admin/certificates` - Certificate management
- `GET /api/admin/analytics` - Usage analytics

## Frontend Architecture

### Student Portal (`/student/`)
- Registration/Login pages
- Dashboard with course progress
- Course player with progress tracking
- Certificate gallery
- Profile management

### Admin Portal (`/admin/`)
- User management interface
- Course content management
- Analytics and reporting
- Certificate verification tools
- System settings

### Public Pages
- Course catalog (`/courses/`)
- Certificate verification (`/verify/:id`)
- Marketing pages

## Data Flow Architecture

1. **Student Registration** → Creates user record → Email verification
2. **Course Enrollment** → Creates enrollment record → Unlocks course content
3. **Progress Tracking** → Updates module_progress → Calculates overall progress
4. **Course Completion** → Generates certificate → Sends notification
5. **Admin Monitoring** → Real-time dashboard → Analytics and reporting

## Local Storage Bridge (Pre-Supabase)

Until Supabase is integrated, we'll use:
- IndexedDB for persistent local storage
- Structured data models matching the schema
- Sync preparation for eventual backend connection
- Mock API responses with real data structures

This architecture ensures seamless migration to Supabase when ready.