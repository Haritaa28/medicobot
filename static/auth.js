// Authentication related JavaScript

document.addEventListener('DOMContentLoaded', function() {
    initAuth();
});

function initAuth() {
    // Check if user is logged in
    checkAuthStatus();

    // Setup auth forms
    setupAuthForms();

    // Setup password visibility toggles
    setupPasswordToggles();

    // Setup remember me functionality
    setupRememberMe();
}

function checkAuthStatus() {
    const authToken = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');

    if (authToken && userData) {
        // User is logged in
        updateUIForLoggedInUser(JSON.parse(userData));
    } else {
        // User is not logged in
        updateUIForGuest();
    }
}

function updateUIForLoggedInUser(userData) {
    // Update navigation
    const authLinks = document.querySelectorAll('.auth-link');
    authLinks.forEach(link => {
        if (link.classList.contains('login-link')) {
            link.style.display = 'none';
        }
        if (link.classList.contains('register-link')) {
            link.style.display = 'none';
        }
        if (link.classList.contains('profile-link')) {
            link.style.display = 'block';
        }
        if (link.classList.contains('logout-link')) {
            link.style.display = 'block';
        }
    });

    // Update user info in profile page
    const userElements = document.querySelectorAll('[data-user-field]');
    userElements.forEach(element => {
        const field = element.getAttribute('data-user-field');
        if (userData[field]) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
                element.value = userData[field];
            } else {
                element.textContent = userData[field];
            }
        }
    });

    // Update avatar
    const avatarElements = document.querySelectorAll('.user-avatar-initials');
    avatarElements.forEach(avatar => {
        if (userData.username) {
            const initials = userData.username.charAt(0).toUpperCase();
            avatar.textContent = initials;
        }
    });
}

function updateUIForGuest() {
    const authLinks = document.querySelectorAll('.auth-link');
    authLinks.forEach(link => {
        if (link.classList.contains('login-link')) {
            link.style.display = 'block';
        }
        if (link.classList.contains('register-link')) {
            link.style.display = 'block';
        }
        if (link.classList.contains('profile-link')) {
            link.style.display = 'none';
        }
        if (link.classList.contains('logout-link')) {
            link.style.display = 'none';
        }
    });
}

function setupAuthForms() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const formData = new FormData(this);
            const data = Object.fromEntries(formData);

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    // Save auth token and user data
                    if (result.token) {
                        localStorage.setItem('auth_token', result.token);
                    }
                    if (result.user) {
                        localStorage.setItem('user_data', JSON.stringify(result.user));
                    }

                    // Check remember me
                    const rememberMe = this.querySelector('input[name="remember"]');
                    if (rememberMe && rememberMe.checked) {
                        localStorage.setItem('remember_me', 'true');
                    }

                    // Redirect or reload
                    window.location.href = result.redirect || '/home';
                } else {
                    showAuthError(result.message || 'Login failed');
                }
            } catch (error) {
                console.error('Login error:', error);
                showAuthError('Network error. Please try again.');
            }
        });
    }

    // Registration form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Validate passwords match
            const password = this.querySelector('#password').value;
            const confirmPassword = this.querySelector('#confirm_password').value;

            if (password !== confirmPassword) {
                showAuthError('Passwords do not match');
                return;
            }

            // Validate password strength
            if (password.length < 6) {
                showAuthError('Password must be at least 6 characters long');
                return;
            }

            const formData = new FormData(this);
            const data = Object.fromEntries(formData);

            // Remove confirm password from data
            delete data.confirm_password;

            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    showAuthSuccess('Registration successful! Redirecting to login...');

                    // Clear form
                    this.reset();

                    // Redirect to login after 2 seconds
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    showAuthError(result.message || 'Registration failed');
                }
            } catch (error) {
                console.error('Registration error:', error);
                showAuthError('Network error. Please try again.');
            }
        });
    }

    // Logout button
    const logoutBtn = document.querySelector('.logout-link');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();

            if (confirm('Are you sure you want to logout?')) {
                try {
                    await fetch('/logout', { method: 'POST' });

                    // Clear local storage
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('user_data');
                    localStorage.removeItem('remember_me');

                    // Redirect to home
                    window.location.href = '/';
                } catch (error) {
                    console.error('Logout error:', error);
                }
            }
        });
    }
}

function setupPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.toggle-password');

    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const icon = this.querySelector('i');

            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
                this.setAttribute('aria-label', 'Hide password');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
                this.setAttribute('aria-label', 'Show password');
            }
        });
    });
}

function setupRememberMe() {
    const rememberCheckbox = document.querySelector('input[name="remember"]');
    const savedRemember = localStorage.getItem('remember_me');

    if (rememberCheckbox && savedRemember === 'true') {
        rememberCheckbox.checked = true;

        // Pre-fill username if remembered
        const savedUsername = localStorage.getItem('remembered_username');
        const usernameInput = document.querySelector('input[name="username"]');
        if (savedUsername && usernameInput) {
            usernameInput.value = savedUsername;
        }
    }

    if (rememberCheckbox) {
        rememberCheckbox.addEventListener('change', function() {
            if (this.checked) {
                const usernameInput = document.querySelector('input[name="username"]');
                if (usernameInput && usernameInput.value) {
                    localStorage.setItem('remembered_username', usernameInput.value);
                }
                localStorage.setItem('remember_me', 'true');
            } else {
                localStorage.removeItem('remembered_username');
                localStorage.removeItem('remember_me');
            }
        });
    }
}

function showAuthError(message) {
    // Remove existing error messages
    const existingErrors = document.querySelectorAll('.auth-error');
    existingErrors.forEach(error => error.remove());

    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'auth-error';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;

    // Add styles
    errorDiv.style.cssText = `
        background: linear-gradient(135deg, #ff4d4d 0%, #ff944d 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
    `;

    // Insert at the beginning of the form
    const form = document.querySelector('.auth-form');
    if (form) {
        form.insertBefore(errorDiv, form.firstChild);

        // Auto remove after 5 seconds
        setTimeout(() => {
            errorDiv.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => errorDiv.remove(), 300);
        }, 5000);
    }
}

function showAuthSuccess(message) {
    // Remove existing success messages
    const existingSuccess = document.querySelectorAll('.auth-success');
    existingSuccess.forEach(success => success.remove());

    // Create success message element
    const successDiv = document.createElement('div');
    successDiv.className = 'auth-success';
    successDiv.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;

    // Add styles
    successDiv.style.cssText = `
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
    `;

    // Insert at the beginning of the form
    const form = document.querySelector('.auth-form');
    if (form) {
        form.insertBefore(successDiv, form.firstChild);
    }
}

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;
    const feedback = [];

    // Length check
    if (password.length >= 8) {
        strength++;
    } else {
        feedback.push('At least 8 characters');
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
        strength++;
    } else {
        feedback.push('Lowercase letters');
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
        strength++;
    } else {
        feedback.push('Uppercase letters');
    }

    // Number check
    if (/[0-9]/.test(password)) {
        strength++;
    } else {
        feedback.push('Numbers');
    }

    // Special character check
    if (/[^A-Za-z0-9]/.test(password)) {
        strength++;
    } else {
        feedback.push('Special characters');
    }

    return {
        score: strength,
        maxScore: 5,
        feedback: feedback.length > 0 ? `Add: ${feedback.join(', ')}` : 'Strong password!'
    };
}

// Update password strength indicator
function updatePasswordStrength(password) {
    const strength = checkPasswordStrength(password);
    const indicator = document.getElementById('passwordStrength');
    const feedback = document.getElementById('passwordFeedback');

    if (indicator) {
        indicator.style.width = `${(strength.score / strength.maxScore) * 100}%`;

        // Update color based on strength
        if (strength.score <= 2) {
            indicator.style.backgroundColor = '#ff4d4d';
        } else if (strength.score === 3) {
            indicator.style.backgroundColor = '#ffd24d';
        } else {
            indicator.style.backgroundColor = '#4dff4d';
        }
    }

    if (feedback) {
        feedback.textContent = strength.feedback;
        feedback.style.color = strength.score >= 4 ? '#4dff4d' :
                              strength.score >= 2 ? '#ffd24d' : '#ff4d4d';
    }
}

// Auto-logout after inactivity
function setupAutoLogout() {
    let timeout;
    const logoutTime = 30 * 60 * 1000; // 30 minutes

    function resetTimer() {
        clearTimeout(timeout);
        timeout = setTimeout(logoutDueToInactivity, logoutTime);
    }

    function logoutDueToInactivity() {
        if (localStorage.getItem('auth_token')) {
            if (confirm('You have been inactive for a while. Do you want to stay logged in?')) {
                resetTimer();
            } else {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
                window.location.href = '/login?timeout=true';
            }
        }
    }

    // Reset timer on user activity
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetTimer);
    });

    resetTimer();
}

// Initialize auto-logout if user is logged in
if (localStorage.getItem('auth_token')) {
    setupAutoLogout();
}

// Export functions
window.Auth = {
    checkAuthStatus,
    updatePasswordStrength,
    checkPasswordStrength
};