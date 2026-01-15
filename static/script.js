// Main JavaScript file for MedicoBot

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    checkSystemStatus();
});

function initializeApp() {
    // Set current year in footer
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Initialize tooltips
    initTooltips();

    // Initialize animations
    initAnimations();

    // Check for saved language preference
    const savedLang = localStorage.getItem('preferredLanguage');
    if (savedLang) {
        const langSelect = document.getElementById('languageSelect');
        if (langSelect) {
            langSelect.value = savedLang;
        }
    }

    // Check for dark mode preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        enableDarkMode();
    }
}

function setupEventListeners() {
    // Language selector
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
        langSelect.addEventListener('change', function(e) {
            localStorage.setItem('preferredLanguage', e.target.value);
            showNotification(`Language changed to ${e.target.options[e.target.selectedIndex].text}`);
        });
    }

    // Mode toggle
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.addEventListener('click', toggleAppMode);
    }

    // Mobile menu toggle
    const navToggle = document.getElementById('navToggle');
    if (navToggle) {
        navToggle.addEventListener('click', toggleMobileMenu);
    }

    // Close mobile menu when clicking outside
    document.addEventListener('click', function(e) {
        const navMenu = document.getElementById('navMenu');
        const navToggle = document.getElementById('navToggle');

        if (navMenu && navToggle &&
            !navMenu.contains(e.target) &&
            !navToggle.contains(e.target) &&
            navMenu.classList.contains('show')) {
            navMenu.classList.remove('show');
        }
    });

    // Form validation
    const forms = document.querySelectorAll('form[novalidate]');
    forms.forEach(form => {
        form.addEventListener('submit', validateForm);
    });

    // Auto-dismiss flash messages
    const flashMessages = document.querySelectorAll('.flash-message');
    flashMessages.forEach(msg => {
        setTimeout(() => {
            msg.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => msg.remove(), 300);
        }, 5000);
    });
}

function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');

    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function(e) {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.getAttribute('data-tooltip');
            document.body.appendChild(tooltip);

            const rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + (rect.width / 2) + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';

            this._tooltip = tooltip;
        });

        element.addEventListener('mouseleave', function() {
            if (this._tooltip) {
                this._tooltip.remove();
                this._tooltip = null;
            }
        });
    });
}

function initAnimations() {
    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
            }
        });
    }, observerOptions);

    // Observe elements with animation classes
    document.querySelectorAll('.fade-in, .slide-up').forEach(el => {
        observer.observe(el);
    });
}

async function checkSystemStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();

        updateStatusIndicator(data);
    } catch (error) {
        console.error('Error checking system status:', error);
    }
}

function updateStatusIndicator(status) {
    const indicator = document.getElementById('systemStatus');
    if (!indicator) return;

    if (status.offline_mode) {
        indicator.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline Mode';
        indicator.className = 'status-offline';
    } else {
        let services = [];
        if (status.gemini_api) services.push('AI');
        if (status.translation_api) services.push('Translation');
        if (status.news_api) services.push('News');

        indicator.innerHTML = `<i class="fas fa-wifi"></i> Online (${services.join(', ')})`;
        indicator.className = 'status-online';
    }
}

function toggleAppMode() {
    const modeBtn = document.getElementById('modeToggle');
    const currentMode = modeBtn.textContent;
    const newMode = currentMode === 'Online' ? 'Offline' : 'Online';

    fetch('/toggle_mode', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: newMode.toLowerCase() })
    })
    .then(response => response.json())
    .then(data => {
        modeBtn.textContent = newMode;
        showNotification(`Switched to ${newMode} mode`);
        checkSystemStatus();
    })
    .catch(error => {
        console.error('Error toggling mode:', error);
        showNotification('Failed to switch mode', 'error');
    });
}

function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    if (navMenu) {
        navMenu.classList.toggle('show');
    }
}

function validateForm(e) {
    const form = e.target;
    const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
    let isValid = true;

    inputs.forEach(input => {
        if (!input.value.trim()) {
            markInvalid(input, 'This field is required');
            isValid = false;
        } else {
            markValid(input);

            // Email validation
            if (input.type === 'email') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(input.value)) {
                    markInvalid(input, 'Please enter a valid email address');
                    isValid = false;
                }
            }

            // Password validation
            if (input.type === 'password' && input.value.length < 6) {
                markInvalid(input, 'Password must be at least 6 characters');
                isValid = false;
            }
        }
    });

    if (!isValid) {
        e.preventDefault();
        showNotification('Please fix the errors in the form', 'error');
    }
}

function markInvalid(input, message) {
    input.classList.add('invalid');
    input.classList.remove('valid');

    let errorMsg = input.nextElementSibling;
    if (!errorMsg || !errorMsg.classList.contains('error-message')) {
        errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        input.parentNode.insertBefore(errorMsg, input.nextSibling);
    }
    errorMsg.textContent = message;
}

function markValid(input) {
    input.classList.remove('invalid');
    input.classList.add('valid');

    const errorMsg = input.nextElementSibling;
    if (errorMsg && errorMsg.classList.contains('error-message')) {
        errorMsg.remove();
    }
}

function showNotification(message, type = 'success') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(notif => notif.remove());

    // Create notification
    const notification = document.createElement('div');
    notification.className = `custom-notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;

    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 10px;
        color: white;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 15px;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
    `;

    // Set background based on type
    if (type === 'success') {
        notification.style.background = 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)';
    } else if (type === 'error') {
        notification.style.background = 'linear-gradient(135deg, #ff4d4d 0%, #ff944d 100%)';
    } else if (type === 'info') {
        notification.style.background = 'linear-gradient(135deg, #4d79ff 0%, #00ccff 100%)';
    }

    // Add close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.3s;
    `;

    closeBtn.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255,255,255,0.2)';
    });

    closeBtn.addEventListener('mouseleave', function() {
        this.style.background = 'none';
    });

    closeBtn.addEventListener('click', function() {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    });

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function enableDarkMode() {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
}

function disableDarkMode() {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
}

function toggleDarkMode() {
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
        disableDarkMode();
    } else {
        enableDarkMode();
    }
}

// Utility function for making API calls
async function makeApiCall(endpoint, method = 'GET', data = null) {
    const headers = {
        'Content-Type': 'application/json',
    };

    // Add authentication token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method: method,
        headers: headers,
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(endpoint, config);

        if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Debounce function for performance
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

// Export functions for use in other files
window.MedicoBot = {
    showNotification,
    makeApiCall,
    formatDate,
    debounce
};