// DrTroy CE Shopping Cart System
// Handles both individual courses and bundle packages

class ShoppingCart {
    constructor() {
        this.items = this.loadCart();
        this.listeners = [];
    }

    // Load cart from localStorage
    loadCart() {
        try {
            const saved = localStorage.getItem('drtroyCart');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading cart:', e);
            return [];
        }
    }

    // Save cart to localStorage
    saveCart() {
        try {
            localStorage.setItem('drtroyCart', JSON.stringify(this.items));
            this.notifyListeners();
        } catch (e) {
            console.error('Error saving cart:', e);
        }
    }

    // Add item to cart
    addItem(item) {
        const existingIndex = this.items.findIndex(cartItem => 
            cartItem.type === item.type && 
            (item.type === 'course' ? cartItem.courseId === item.courseId : cartItem.packageCode === item.packageCode)
        );

        if (existingIndex >= 0) {
            // Item already in cart - update quantity or replace
            if (item.type === 'course') {
                this.items[existingIndex].quantity = (this.items[existingIndex].quantity || 1) + 1;
            } else {
                // Packages don't have quantities - just replace
                this.items[existingIndex] = { ...item };
            }
        } else {
            // Add new item
            this.items.push({ 
                ...item, 
                quantity: item.type === 'course' ? 1 : undefined,
                addedAt: new Date().toISOString() 
            });
        }

        this.saveCart();
        return this.items.length;
    }

    // Remove item from cart
    removeItem(itemId, type = 'course') {
        this.items = this.items.filter(item => 
            !(item.type === type && 
              (type === 'course' ? item.courseId === itemId : item.packageCode === itemId))
        );
        this.saveCart();
    }

    // Update item quantity (courses only)
    updateQuantity(courseId, quantity) {
        const item = this.items.find(item => item.type === 'course' && item.courseId === courseId);
        if (item) {
            if (quantity <= 0) {
                this.removeItem(courseId, 'course');
            } else {
                item.quantity = quantity;
                this.saveCart();
            }
        }
    }

    // Get cart items
    getItems() {
        return this.items;
    }

    // Get cart count
    getItemCount() {
        return this.items.reduce((count, item) => {
            return count + (item.quantity || 1);
        }, 0);
    }

    // Calculate cart total
    calculateTotal() {
        const subtotal = this.items.reduce((total, item) => {
            const quantity = item.quantity || 1;
            return total + (item.price * quantity);
        }, 0);

        // Check for new account discount (bundles only)
        const hasNewAccountDiscount = this.checkNewAccountDiscount();
        let discount = 0;
        
        if (hasNewAccountDiscount) {
            // $10 off each bundle package
            const bundleCount = this.items.filter(item => item.type === 'package').length;
            discount = bundleCount * 10;
        }

        return {
            subtotal: subtotal,
            discount: discount,
            total: subtotal - discount,
            hasNewAccountDiscount
        };
    }

    // Check if user qualifies for new account discount
    checkNewAccountDiscount() {
        // Check if user is new (no previous purchases)
        const account = localStorage.getItem('drtroyAccount');
        if (account) {
            const accountData = JSON.parse(account);
            return !accountData.purchases || accountData.purchases.length === 0;
        }
        return true; // Default to true for new users
    }

    // Clear cart
    clear() {
        this.items = [];
        this.saveCart();
    }

    // Add listener for cart changes
    addListener(callback) {
        this.listeners.push(callback);
    }

    // Remove listener
    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }

    // Notify all listeners of cart changes
    notifyListeners() {
        this.listeners.forEach(listener => {
            try {
                listener(this);
            } catch (e) {
                console.error('Error in cart listener:', e);
            }
        });
    }

    // Convert cart to checkout format
    getCheckoutData() {
        const totals = this.calculateTotal();
        
        return {
            items: this.items,
            subtotal: totals.subtotal,
            discount: totals.discount,
            total: totals.total,
            hasNewAccountDiscount: totals.hasNewAccountDiscount,
            itemCount: this.getItemCount()
        };
    }
}

// Course and Package Data
const COURSE_CATALOG = {
    'PT-MSK-001': {
        title: 'PT Musculoskeletal Evaluation and Diagnosis',
        credits: 3,
        price: 27.99,
        courseNumber: 'DRTROY-PT-MSK-001-2024',
        category: 'pt-specific',
        status: 'available'
    },
    'JOINT-001': {
        title: 'Considerations in Lower Extremity Joint Replacements',
        credits: 3,
        price: 27.99,
        courseNumber: 'DRTROY-JOINT-001-2024',
        category: 'pt-specific',
        status: 'available'
    },
    'OT-ADL-001': {
        title: 'OT Evaluation and Assessment of ADLs',
        credits: 3,
        price: 27.99,
        courseNumber: 'DRTROY-OT-ADL-001-2024',
        category: 'ot-specific',
        status: 'coming-soon'
    },
    'MOBILITY-001': {
        title: 'Comprehensive Mobility and Fall Prevention',
        credits: 3,
        price: 27.99,
        courseNumber: 'DRTROY-MOBILITY-001-2024',
        category: 'core',
        status: 'available'
    },
    'BALANCE-001': {
        title: 'Balance, Gait, and Vestibular Management',
        credits: 3,
        price: 27.99,
        courseNumber: 'DRTROY-BALANCE-001-2024',
        category: 'core',
        status: 'coming-soon'
    },
    'EXERCISE-001': {
        title: 'Post-Surgical and Therapeutic Exercise',
        credits: 3,
        price: 27.99,
        courseNumber: 'DRTROY-EXERCISE-001-2024',
        category: 'core',
        status: 'coming-soon'
    },
    'GERIATRIC-001': {
        title: 'Geriatric Care Across the Continuum',
        credits: 3,
        price: 27.99,
        courseNumber: 'DRTROY-GERIATRIC-001-2024',
        category: 'core',
        status: 'coming-soon'
    },
    'DOCUMENTATION-001': {
        title: 'Professional Documentation and Communication',
        credits: 3,
        price: 27.99,
        courseNumber: 'DRTROY-DOC-001-2024',
        category: 'core',
        status: 'coming-soon'
    },
    'MODALITIES-001': {
        title: 'Physical Agents, Modalities, and Wound Care',
        credits: 3,
        price: 27.99,
        courseNumber: 'DRTROY-MODALITIES-001-2024',
        category: 'core',
        status: 'coming-soon'
    },
    'NEURO-001': {
        title: 'Neurological Rehabilitation',
        credits: 3,
        price: 27.99,
        courseNumber: 'DRTROY-NEURO-001-2024',
        category: 'core',
        status: 'available'
    },
    'INFECTION-001': {
        title: 'Infection Control and Patient Safety',
        credits: 3,
        price: 27.99,
        courseNumber: 'DRTROY-INFECTION-001-2024',
        category: 'core',
        status: 'coming-soon'
    },
    'EDUCATION-001': {
        title: 'Patient Education and Health Promotion',
        credits: 2,
        price: 18.99,
        courseNumber: 'DRTROY-EDUCATION-001-2024',
        category: 'core',
        status: 'available'
    },
    'HEALTHTECH-001': {
        title: 'Healthcare Technology and Electronic Records',
        credits: 1.5,
        price: 14.99,
        courseNumber: 'DRTROY-HEALTHTECH-001-2024',
        category: 'core',
        status: 'available'
    }
};

const PACKAGE_CATALOG = {
    'PT': {
        title: 'PT Package - Complete Continuing Education',
        code: 'PT',
        credits: 27,
        description: 'Complete CE package designed for Physical Therapists. Includes core courses plus PT-specific specialties.',
        originalPrice: 109,
        finalPrice: 99, // With $10 new account discount
        savings: 10,
        courses: ['PT-MSK-001', 'JOINT-001', 'MOBILITY-001', 'NEURO-001', 'EDUCATION-001', 'HEALTHTECH-001', 'BALANCE-001', 'EXERCISE-001', 'GERIATRIC-001'],
        featured: true
    },
    'PTA': {
        title: 'PTA Package - Continuing Education for PTAs',
        code: 'PTA',
        credits: 17,
        description: 'Tailored CE package for Physical Therapist Assistants covering essential topics.',
        originalPrice: 89,
        finalPrice: 79, // With $10 new account discount
        savings: 10,
        courses: ['MOBILITY-001', 'NEURO-001', 'EDUCATION-001', 'HEALTHTECH-001', 'GERIATRIC-001'],
        featured: true
    },
    'OT': {
        title: 'OT Package - Complete Continuing Education',
        code: 'OT',
        credits: 23,
        description: 'Complete CE package designed for Occupational Therapists with OT-specific content.',
        originalPrice: 109,
        finalPrice: 99, // With $10 new account discount
        savings: 10,
        courses: ['OT-ADL-001', 'MOBILITY-001', 'NEURO-001', 'EDUCATION-001', 'HEALTHTECH-001', 'GERIATRIC-001', 'INFECTION-001'],
        featured: true
    },
    'COTA': {
        title: 'COTA Package - Continuing Education for COTAs',
        code: 'COTA',
        credits: 23,
        description: 'Tailored CE package for Certified Occupational Therapy Assistants.',
        originalPrice: 89,
        finalPrice: 79, // With $10 new account discount
        savings: 10,
        courses: ['MOBILITY-001', 'NEURO-001', 'EDUCATION-001', 'HEALTHTECH-001', 'GERIATRIC-001'],
        featured: true
    }
};

// Global cart instance
window.drtroyCart = new ShoppingCart();

// Cart helper functions
window.addCourseToCart = function(courseId) {
    const course = COURSE_CATALOG[courseId];
    if (!course) {
        alert('Course not found.');
        return;
    }

    if (course.status !== 'available') {
        alert('This course is not yet available.');
        return;
    }

    const cartItem = {
        type: 'course',
        courseId: courseId,
        title: course.title,
        credits: course.credits,
        price: course.price,
        courseNumber: course.courseNumber,
        category: course.category
    };

    const itemCount = window.drtroyCart.addItem(cartItem);
    
    // Show feedback
    showCartNotification(`Added "${course.title}" to cart`);
    updateCartIcon();
    
    return itemCount;
};

window.addPackageToCart = function(packageCode) {
    const pkg = PACKAGE_CATALOG[packageCode];
    if (!pkg) {
        alert('Package not found.');
        return;
    }

    const cartItem = {
        type: 'package',
        packageCode: packageCode,
        title: pkg.title,
        credits: pkg.credits,
        price: pkg.originalPrice, // Use original price, discount applied at checkout
        description: pkg.description,
        courses: pkg.courses
    };

    const itemCount = window.drtroyCart.addItem(cartItem);
    
    // Show feedback
    showCartNotification(`Added "${pkg.title}" to cart`);
    updateCartIcon();
    
    return itemCount;
};

// Cart notification
window.showCartNotification = function(message) {
    // Remove existing notification
    const existing = document.getElementById('cart-notification');
    if (existing) {
        existing.remove();
    }

    // Create notification
    const notification = document.createElement('div');
    notification.id = 'cart-notification';
    notification.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: #059669;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-weight: 500;
            max-width: 300px;
        ">
            ${message}
            <div style="margin-top: 0.5rem;">
                <a href="cart.html" style="color: white; text-decoration: underline; font-size: 0.9rem;">View Cart</a>
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 4000);
};

// Update cart icon in navigation
window.updateCartIcon = function() {
    const cartIcon = document.getElementById('cart-icon');
    const cartCount = document.getElementById('cart-count');
    
    if (cartIcon && cartCount) {
        const count = window.drtroyCart.getItemCount();
        if (count > 0) {
            cartCount.textContent = count;
            cartCount.style.display = 'inline-block';
        } else {
            cartCount.style.display = 'none';
        }
    }
};

// Initialize cart on page load
document.addEventListener('DOMContentLoaded', function() {
    updateCartIcon();
    
    // Listen for cart changes
    window.drtroyCart.addListener(function() {
        updateCartIcon();
    });
});

// Utility functions for other pages to use
window.getCartItemCount = function() {
    return window.drtroyCart.getItemCount();
};

window.getCartTotal = function() {
    return window.drtroyCart.calculateTotal();
};

window.clearCart = function() {
    window.drtroyCart.clear();
    updateCartIcon();
};