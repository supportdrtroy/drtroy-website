// DrTroy.com JavaScript

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    
    // Mobile Navigation Toggle
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
            
            // Animate hamburger bars
            const bars = navToggle.querySelectorAll('.bar');
            bars.forEach(bar => bar.classList.toggle('active'));
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!navToggle.contains(event.target) && !navMenu.contains(event.target)) {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                
                const bars = navToggle.querySelectorAll('.bar');
                bars.forEach(bar => bar.classList.remove('active'));
            }
        });
        
        // Close menu when clicking on menu links
        const navLinks = navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                
                const bars = navToggle.querySelectorAll('.bar');
                bars.forEach(bar => bar.classList.remove('active'));
            });
        });
    }
    
    // Testimonials Slider
    const testimonialsSlider = document.getElementById('testimonials-slider');
    const testimonialCards = document.querySelectorAll('.testimonial-card');
    const navDots = document.querySelectorAll('.nav-dot');
    let currentSlide = 0;
    
    if (testimonialsSlider && testimonialCards.length > 0) {
        
        // Function to show specific slide
        function showSlide(index) {
            // Hide all cards
            testimonialCards.forEach(card => {
                card.classList.remove('active');
            });
            
            // Remove active from all dots
            navDots.forEach(dot => {
                dot.classList.remove('active');
            });
            
            // Show current card and activate dot
            if (testimonialCards[index]) {
                testimonialCards[index].classList.add('active');
            }
            if (navDots[index]) {
                navDots[index].classList.add('active');
            }
            
            currentSlide = index;
        }
        
        // Next slide function
        function nextSlide() {
            const nextIndex = (currentSlide + 1) % testimonialCards.length;
            showSlide(nextIndex);
        }
        
        // Previous slide function
        function prevSlide() {
            const prevIndex = currentSlide === 0 ? testimonialCards.length - 1 : currentSlide - 1;
            showSlide(prevIndex);
        }
        
        // Auto-play testimonials
        let autoPlayInterval = setInterval(nextSlide, 5000);
        
        // Pause auto-play on hover
        testimonialsSlider.addEventListener('mouseenter', function() {
            clearInterval(autoPlayInterval);
        });
        
        // Resume auto-play when mouse leaves
        testimonialsSlider.addEventListener('mouseleave', function() {
            autoPlayInterval = setInterval(nextSlide, 5000);
        });
        
        // Dot navigation
        navDots.forEach((dot, index) => {
            dot.addEventListener('click', function() {
                showSlide(index);
                // Reset auto-play
                clearInterval(autoPlayInterval);
                autoPlayInterval = setInterval(nextSlide, 5000);
            });
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', function(event) {
            if (event.key === 'ArrowLeft') {
                prevSlide();
                clearInterval(autoPlayInterval);
                autoPlayInterval = setInterval(nextSlide, 5000);
            } else if (event.key === 'ArrowRight') {
                nextSlide();
                clearInterval(autoPlayInterval);
                autoPlayInterval = setInterval(nextSlide, 5000);
            }
        });
        
        // Touch/swipe support for mobile
        let touchStartX = 0;
        let touchEndX = 0;
        
        testimonialsSlider.addEventListener('touchstart', function(event) {
            touchStartX = event.changedTouches[0].screenX;
        });
        
        testimonialsSlider.addEventListener('touchend', function(event) {
            touchEndX = event.changedTouches[0].screenX;
            handleSwipe();
        });
        
        function handleSwipe() {
            const swipeThreshold = 50;
            const swipeDistance = touchEndX - touchStartX;
            
            if (Math.abs(swipeDistance) > swipeThreshold) {
                if (swipeDistance > 0) {
                    // Swipe right - previous slide
                    prevSlide();
                } else {
                    // Swipe left - next slide
                    nextSlide();
                }
                
                // Reset auto-play
                clearInterval(autoPlayInterval);
                autoPlayInterval = setInterval(nextSlide, 5000);
            }
        }
    }
    
    // Smooth scrolling for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            const href = this.getAttribute('href');
            
            // Skip if it's just a hash
            if (href === '#') return;
            
            const targetElement = document.querySelector(href);
            
            if (targetElement) {
                event.preventDefault();
                
                const offsetTop = targetElement.offsetTop - 80; // Account for fixed navbar
                
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    let lastScrollTop = 0;
    
    if (navbar) {
        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            // Add shadow when scrolled
            if (scrollTop > 10) {
                navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
            } else {
                navbar.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            }
            
            lastScrollTop = scrollTop;
        });
    }
    
    // Form submissions (for CTAs)
    const ctaButtons = document.querySelectorAll('[href="#trial"], [href="#signup-individual"], [href="#signup-team"]');
    
    ctaButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            
            // Show modal or redirect to signup
            showSignupModal();
        });
    });
    
    // Demo request buttons
    const demoButtons = document.querySelectorAll('[href="#demo"], [href="#contact-enterprise"]');
    
    demoButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            
            // Show demo request modal
            showDemoModal();
        });
    });
    
    // Course preview buttons
    const previewButtons = document.querySelectorAll('[href="#preview"]');
    
    previewButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            
            // Show course preview modal
            showCoursePreviewModal(this);
        });
    });
    
    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    const animateElements = document.querySelectorAll('.solution-card, .course-card, .pricing-card');
    animateElements.forEach(element => {
        observer.observe(element);
    });
    
    // Lazy loading for images
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
    
});

// Modal Functions
function showSignupModal() {
    // Create modal for signup
    const modal = createModal('signup');
    const modalContent = `
        <div class="modal-header">
            <h2>Start Your Free Trial</h2>
            <p>Get access to all courses for 7 days, completely free.</p>
        </div>
        <form class="signup-form">
            <div class="form-group">
                <label for="name">Full Name</label>
                <input type="text" id="name" name="name" required>
            </div>
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" required>
            </div>
            <div class="form-group">
                <label for="profession">Profession</label>
                <select id="profession" name="profession" required>
                    <option value="">Select your profession</option>
                    <option value="PT">Physical Therapist (PT)</option>
                    <option value="PTA">Physical Therapist Assistant (PTA)</option>
                    <option value="OT">Occupational Therapist (OT)</option>
                    <option value="COTA">Certified Occupational Therapy Assistant (COTA)</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label for="state">State</label>
                <input type="text" id="state" name="state" placeholder="e.g., Texas" required>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Start Free Trial</button>
            <p class="form-note">No credit card required. Cancel anytime.</p>
        </form>
    `;
    
    modal.querySelector('.modal-body').innerHTML = modalContent;
    
    // Handle form submission
    const form = modal.querySelector('.signup-form');
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        
        // Collect form data
        const formData = new FormData(form);
        const userData = Object.fromEntries(formData);
        
        // Here you would typically send the data to your backend
        console.log('Signup data:', userData);
        
        // Show success message
        showSuccessMessage('Trial started! Check your email for login details.');
        closeModal();
    });
}

function showDemoModal() {
    const modal = createModal('demo');
    const modalContent = `
        <div class="modal-header">
            <h2>Request a Demo</h2>
            <p>See how DrTroy.com can transform your continuing education experience.</p>
        </div>
        <form class="demo-form">
            <div class="form-group">
                <label for="demo-name">Full Name</label>
                <input type="text" id="demo-name" name="name" required>
            </div>
            <div class="form-group">
                <label for="demo-email">Email Address</label>
                <input type="email" id="demo-email" name="email" required>
            </div>
            <div class="form-group">
                <label for="demo-organization">Organization</label>
                <input type="text" id="demo-organization" name="organization">
            </div>
            <div class="form-group">
                <label for="demo-team-size">Team Size</label>
                <select id="demo-team-size" name="team_size">
                    <option value="">Select team size</option>
                    <option value="1">Individual</option>
                    <option value="2-5">2-5 people</option>
                    <option value="6-15">6-15 people</option>
                    <option value="16-50">16-50 people</option>
                    <option value="50+">50+ people</option>
                </select>
            </div>
            <div class="form-group">
                <label for="demo-message">Tell us about your needs</label>
                <textarea id="demo-message" name="message" rows="3" placeholder="What are your main continuing education challenges?"></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Request Demo</button>
        </form>
    `;
    
    modal.querySelector('.modal-body').innerHTML = modalContent;
    
    // Handle form submission
    const form = modal.querySelector('.demo-form');
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        
        const formData = new FormData(form);
        const demoData = Object.fromEntries(formData);
        
        console.log('Demo request:', demoData);
        
        showSuccessMessage('Demo request received! We\'ll contact you within 24 hours.');
        closeModal();
    });
}

function showCoursePreviewModal(button) {
    const courseCard = button.closest('.course-card');
    const courseTitle = courseCard.querySelector('h3').textContent;
    
    const modal = createModal('course-preview');
    const modalContent = `
        <div class="modal-header">
            <h2>${courseTitle}</h2>
            <p>Course Preview</p>
        </div>
        <div class="course-preview-content">
            <div class="preview-video">
                <div class="video-placeholder">
                    <i class="fas fa-play-circle"></i>
                    <p>Course Preview Video</p>
                    <small>2 minutes</small>
                </div>
            </div>
            <div class="course-details">
                <h3>What You'll Learn</h3>
                <ul>
                    <li>Evidence-based treatment approaches</li>
                    <li>Practical implementation strategies</li>
                    <li>Real-world case studies</li>
                    <li>Documentation best practices</li>
                </ul>
                
                <h3>Course Includes</h3>
                <ul>
                    <li><i class="fas fa-video"></i> HD video lectures</li>
                    <li><i class="fas fa-file-pdf"></i> Downloadable resources</li>
                    <li><i class="fas fa-certificate"></i> CE certificate</li>
                    <li><i class="fas fa-mobile"></i> Mobile access</li>
                </ul>
                
                <div class="preview-cta">
                    <button class="btn btn-primary btn-block" onclick="showSignupModal()">
                        Enroll Now - Start Free Trial
                    </button>
                </div>
            </div>
        </div>
    `;
    
    modal.querySelector('.modal-body').innerHTML = modalContent;
}

function createModal(type) {
    // Remove existing modal
    const existingModal = document.querySelector('.modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-backdrop" onclick="closeModal()"></div>
        <div class="modal-content">
            <button class="modal-close" onclick="closeModal()">
                <i class="fas fa-times"></i>
            </button>
            <div class="modal-body"></div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add modal styles
    if (!document.querySelector('#modal-styles')) {
        const modalStyles = document.createElement('style');
        modalStyles.id = 'modal-styles';
        modalStyles.textContent = `
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                animation: modalFadeIn 0.3s ease forwards;
            }
            
            .modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
            }
            
            .modal-content {
                background: white;
                border-radius: 1rem;
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                position: relative;
                transform: scale(0.9);
                animation: modalSlideIn 0.3s ease forwards;
            }
            
            .modal-close {
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: #6b7280;
                z-index: 1;
            }
            
            .modal-body {
                padding: 2rem;
            }
            
            .modal-header {
                text-align: center;
                margin-bottom: 2rem;
            }
            
            .modal-header h2 {
                margin-bottom: 0.5rem;
            }
            
            .form-group {
                margin-bottom: 1rem;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 0.25rem;
                font-weight: 500;
            }
            
            .form-group input,
            .form-group select,
            .form-group textarea {
                width: 100%;
                padding: 0.75rem;
                border: 2px solid #e5e7eb;
                border-radius: 0.5rem;
                font-size: 1rem;
            }
            
            .form-group input:focus,
            .form-group select:focus,
            .form-group textarea:focus {
                outline: none;
                border-color: #1e40af;
            }
            
            .form-note {
                text-align: center;
                font-size: 0.875rem;
                color: #6b7280;
                margin-top: 1rem;
            }
            
            .course-preview-content {
                display: flex;
                flex-direction: column;
                gap: 2rem;
            }
            
            .video-placeholder {
                background: #f3f4f6;
                border-radius: 0.5rem;
                padding: 3rem;
                text-align: center;
                color: #6b7280;
            }
            
            .video-placeholder i {
                font-size: 3rem;
                margin-bottom: 1rem;
                color: #1e40af;
            }
            
            .course-details ul {
                list-style: none;
                padding: 0;
            }
            
            .course-details li {
                padding: 0.5rem 0;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .course-details li:last-child {
                border-bottom: none;
            }
            
            .course-details li i {
                margin-right: 0.5rem;
                color: #1e40af;
            }
            
            .preview-cta {
                margin-top: 2rem;
            }
            
            @keyframes modalFadeIn {
                to { opacity: 1; }
            }
            
            @keyframes modalSlideIn {
                to { transform: scale(1); }
            }
        `;
        document.head.appendChild(modalStyles);
    }
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    return modal;
}

function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.9)';
        setTimeout(() => {
            modal.remove();
            document.body.style.overflow = '';
        }, 300);
    }
}

function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: #059669;
        color: white;
        padding: 1rem 2rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 10001;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(successDiv);
    
    // Animate in
    setTimeout(() => {
        successDiv.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        successDiv.style.transform = 'translateX(100%)';
        setTimeout(() => successDiv.remove(), 300);
    }, 5000);
}

// Utility function to debounce scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}