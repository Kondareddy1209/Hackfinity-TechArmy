// public/scripts/main.js - All client-side JavaScript logic

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const authPage = document.getElementById('auth-page');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const authTitle = document.getElementById('auth-title');

    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginBtn = document.getElementById('login-btn');
    const showSignupLink = document.querySelector('p.switch-auth-mode[onclick*="signup"]');
    const showAdminLoginLink = document.querySelector('p.switch-auth-mode[onclick*="admin-login"]');


    const signupUsernameInput = document.getElementById('signup-username');
    const signupEmailInput = document.getElementById('signup-email');
    const signupPasswordInput = document.getElementById('signup-password');
    const signupGenderSelect = document.getElementById('signup-gender');
    const signupMobileInput = document.getElementById('signup-mobile');
    const signupRoleSelect = document.getElementById('signup-role');
    const signupBtn = document.getElementById('signup-btn');
    const showLoginLink = document.querySelector('p.switch-auth-mode[onclick*="/"]');

    // OTP elements
    const otpInput = document.getElementById('otp-input');
    const verifyOtpBtn = document.getElementById('verify-otp-btn');
    const resendOtpBtn = document.getElementById('resend-otp-btn');
    const otpTimerDisplay = document.getElementById('otp-timer');
    let otpCountdownInterval;
    let otpEmailForVerification = ''; // To store email for OTP verification page

    const userDashboard = document.getElementById('user-dashboard');
    const adminDashboard = document.getElementById('admin-dashboard');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const userLogoutBtn = document.getElementById('user-logout-btn');

    const addProductBtn = document.getElementById('add-product-btn');
    const simulateVoiceBtn = document.getElementById('simulate-voice-btn');
    const productNameInput = document.getElementById('product-name-input');
    const productCategoryInput = document.getElementById('product-category-input');
    const productQuantityInput = document.getElementById('product-quantity-input');
    const productDescriptionInput = document.getElementById('product-description-input');
    const catalogList = document.getElementById('catalog-list');

    const adminCatalogList = document.getElementById('admin-catalog-list');
    const adminUserList = document.getElementById('admin-user-list');
    const refreshAllProductsBtn = document.getElementById('refresh-all-products-btn');
    const refreshUsersBtn = document.getElementById('refresh-users-btn');

    const editModal = document.getElementById('edit-modal');
    const closeButton = editModal ? editModal.querySelector('.close-button') : null;
    const saveEditBtn = document.getElementById('save-edit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const editProductId = document.getElementById('edit-product-id');
    const editName = document.getElementById('edit-name');
    const editCategory = document.getElementById('edit-category');
    const editQuantity = document.getElementById('edit-quantity');
    const editDescription = document.getElementById('edit-description');

    let currentUserRole = null;

    // --- Utility Functions ---
    function showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('message-container');
        if (!messageContainer) {
            console.warn("Message container not found. Message:", message);
            return;
        }
        const messageBox = document.createElement('div');
        messageBox.className = `message ${type}`;
        messageBox.textContent = message;
        // Prepend to show newest messages on top
        messageContainer.prepend(messageBox);
        setTimeout(() => {
            messageBox.remove();
        }, 3000);
    }

    function setAuthToken(token) {
        localStorage.setItem('jwtToken', token);
    }

    function getAuthToken() {
        return localStorage.getItem('jwtToken');
    }

    function removeAuthToken() {
        localStorage.removeItem('jwtToken');
    }

    // Client-side JWT decode function (for initial load and role determination)
    function jwt_decode(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error("Failed to decode JWT:", e);
            return null;
        }
    }

    function showAuthPage(targetPage = 'login') {
        // Hide all dashboards
        if (userDashboard) userDashboard.classList.add('hidden');
        if (adminDashboard) adminDashboard.classList.add('hidden');

        // Show the authentication page
        if (authPage) authPage.classList.remove('hidden');

        // Determine which form to show on the auth page
        if (loginForm) loginForm.classList.add('hidden');
        if (signupForm) signupForm.classList.add('hidden');
        // Hide OTP elements if not on OTP page
        if (otpInput && otpInput.closest('.auth-box')) {
            otpInput.closest('.auth-box').classList.add('hidden');
        }


        if (targetPage === 'login' && loginForm) {
            loginForm.classList.remove('hidden');
            if (authTitle) authTitle.textContent = 'User Login';
            if (loginEmailInput) loginEmailInput.value = '';
            if (loginPasswordInput) loginPasswordInput.value = '';
        } else if (targetPage === 'signup' && signupForm) {
            signupForm.classList.remove('hidden');
            if (authTitle) authTitle.textContent = 'Sign Up for Digital Catalog Agent';
            if (signupUsernameInput) signupUsernameInput.value = '';
            if (signupEmailInput) signupEmailInput.value = '';
            if (signupPasswordInput) signupPasswordInput.value = '';
            if (signupGenderSelect) signupGenderSelect.value = '';
            if (signupMobileInput) signupMobileInput.value = '';
        } else if (targetPage === 'admin-login' && loginForm) { // Re-using login form for admin login
            loginForm.classList.remove('hidden');
            if (authTitle) authTitle.textContent = 'Admin Login';
            if (loginEmailInput) loginEmailInput.value = '';
            if (loginPasswordInput) loginPasswordInput.value = '';
        } else if (targetPage === 'verify-otp') {
            // Show the OTP form, which is part of the auth-box structure in verify-otp.ejs
            if (otpInput && otpInput.closest('.auth-box')) {
                otpInput.closest('.auth-box').classList.remove('hidden');
            }
            if (authTitle) authTitle.textContent = 'Verify Your Email';
            startOtpTimer(300); // Start 5-minute timer
        }
    }


    function showDashboard(role) {
        if (authPage) authPage.classList.add('hidden');
        if (userDashboard) userDashboard.classList.add('hidden');
        if (adminDashboard) adminDashboard.classList.add('hidden');

        if (role === 'user') {
            if (userDashboard) userDashboard.classList.remove('hidden');
            displayUserCatalog();
        } else if (role === 'admin') {
            if (adminDashboard) adminDashboard.classList.remove('hidden');
            displayAllProductsAdmin();
            displayAllUsersAdmin();
        } else {
            showMessage('Invalid role or no role found. Redirecting to login.', 'error');
            removeAuthToken();
            showAuthPage();
        }
    }

    // --- Authentication Handlers ---

    // Event listener for "Don't have an account? Sign Up" link
    if (showSignupLink) {
        showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.pushState({}, '', '/signup'); // Update URL
            showAuthPage('signup');
        });
    }

    // Event listener for "Are you an admin? Admin Login" link
    if (showAdminLoginLink) {
        showAdminLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.pushState({}, '', '/admin-login'); // Update URL
            showAuthPage('admin-login');
        });
    }

    // Event listener for "Already have an account? Login" link
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.pushState({}, '', '/'); // Update URL to root (login)
            showAuthPage('login');
        });
    }

    if (signupBtn) {
        signupBtn.addEventListener('click', async () => {
            const username = signupUsernameInput.value.trim();
            const email = signupEmailInput.value.trim();
            const password = signupPasswordInput.value.trim();
            const gender = signupGenderSelect.value;
            const mobile = signupMobileInput.value.trim();
            const role = signupRoleSelect.value;

            if (!username || !email || !password || !gender || !mobile || !role) {
                showMessage('All fields are required for signup.', 'warning');
                return;
            }
            if (!/^[0-9]{10}$/.test(mobile)) {
                showMessage('Mobile number must be 10 digits.', 'warning');
                return;
            }

            try {
                const response = await fetch('/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password, gender, mobile, role })
                });
                const result = await response.json();

                if (result.success) {
                    showMessage(result.message, 'success');
                    otpEmailForVerification = email; // Store email for OTP page
                    sessionStorage.setItem('otpEmail', email); // Store in session storage for persistence
                    window.history.pushState({}, '', '/verify-otp'); // Update URL in browser
                    showAuthPage('verify-otp'); // Render the OTP verification page
                } else {
                    showMessage(`Error: ${result.message}`, 'error');
                }
            } catch (error) {
                console.error('Signup error:', error);
                showMessage('An error occurred during signup. Please try again.', 'error');
            }
        });
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = loginEmailInput.value.trim();
            const password = loginPasswordInput.value.trim();

            if (!email || !password) {
                showMessage('Email and password are required for login.', 'warning');
                return;
            }

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const result = await response.json();

                if (result.success) {
                    setAuthToken(result.token);
                    currentUserRole = result.role;
                    showMessage(result.message, 'success');
                    // Redirect to appropriate dashboard based on role
                    if (currentUserRole === 'admin') {
                        window.history.pushState({}, '', '/admin-dashboard');
                        showDashboard('admin');
                    } else { // Default to user dashboard
                        window.history.pushState({}, '', '/user-dashboard');
                        showDashboard('user');
                    }
                } else {
                    // Handle unverified email redirection
                    if (result.redirectTo === '/verify-otp' && result.email) {
                        otpEmailForVerification = result.email;
                        sessionStorage.setItem('otpEmail', result.email); // Store in session storage
                        window.history.pushState({}, '', result.redirectTo);
                        showAuthPage('verify-otp');
                        showMessage(result.message, 'warning');
                    } else {
                        showMessage(`Error: ${result.message}`, 'error');
                    }
                }
            } catch (error) {
                console.error('Login error:', error);
                showMessage('An error occurred during login. Please try again.', 'error');
            }
        });
    }

    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', () => {
            removeAuthToken();
            currentUserRole = null;
            window.history.pushState({}, '', '/'); // Redirect to login page
            showAuthPage('login');
            showMessage('Logged out successfully.', 'info');
        });
    }

    if (userLogoutBtn) {
        userLogoutBtn.addEventListener('click', () => {
            removeAuthToken();
            currentUserRole = null;
            window.history.pushState({}, '', '/'); // Redirect to login page
            showAuthPage('login');
            showMessage('Logged out successfully.', 'info');
        });
    }

    // --- OTP Verification Logic ---
    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener('click', async () => {
            const otp = otpInput.value.trim();
            const email = otpEmailForVerification; // Use the stored email

            if (!otp || !email) {
                showMessage('Please enter the OTP and ensure your email is set.', 'warning');
                return;
            }

            try {
                const response = await fetch('/api/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp })
                });
                const result = await response.json();

                if (result.success) {
                    showMessage(result.message, 'success');
                    clearInterval(otpCountdownInterval); // Stop timer
                    sessionStorage.removeItem('otpEmail'); // Clear stored email after successful verification

                    // Redirect to dashboard based on role received from backend
                    setAuthToken(result.token); // Store the new token
                    currentUserRole = result.role;
                    if (currentUserRole === 'admin') {
                        window.history.pushState({}, '', '/admin-dashboard');
                        showDashboard('admin');
                    } else {
                        window.history.pushState({}, '', '/user-dashboard');
                        showDashboard('user');
                    }
                } else {
                    showMessage(`Error: ${result.message}`, 'error');
                }
            } catch (error) {
                console.error('OTP verification error:', error);
                showMessage('An error occurred during OTP verification. Please try again.', 'error');
            }
        });
    }

    if (resendOtpBtn) {
        resendOtpBtn.addEventListener('click', async () => {
            const email = otpEmailForVerification;

            if (!email) {
                showMessage('No email found to resend OTP. Please go back to signup/login.', 'warning');
                return;
            }

            try {
                const response = await fetch('/api/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const result = await response.json();

                if (result.success) {
                    showMessage(result.message, 'success');
                    startOtpTimer(300); // Restart 5-minute timer
                } else {
                    showMessage(`Error: ${result.message}`, 'error');
                }
            } catch (error) {
                console.error('Resend OTP error:', error);
                showMessage('An error occurred while resending OTP. Please try again.', 'error');
            }
        });
    }

    function startOtpTimer(duration) {
        let timer = duration;
        let minutes, seconds;

        // Clear any existing interval to prevent multiple timers running
        if (otpCountdownInterval) {
            clearInterval(otpCountdownInterval);
        }

        // Disable resend button and start text
        if (resendOtpBtn) {
            resendOtpBtn.disabled = true;
            resendOtpBtn.textContent = `Resend OTP in ${formatTime(timer)}`;
        }

        otpCountdownInterval = setInterval(() => {
            minutes = parseInt(timer / 60, 10);
            seconds = parseInt(timer % 60, 10);

            minutes = minutes < 10 ? "0" + minutes : minutes;
            seconds = seconds < 10 ? "0" + seconds : seconds;

            if (otpTimerDisplay) {
                otpTimerDisplay.textContent = `OTP expires in ${minutes}:${seconds}`;
            }

            if (--timer < 0) {
                clearInterval(otpCountdownInterval);
                if (otpTimerDisplay) {
                    otpTimerDisplay.textContent = 'OTP expired. Please resend.';
                }
                if (resendOtpBtn) {
                    resendOtpBtn.disabled = false;
                    resendOtpBtn.textContent = 'Resend OTP';
                }
            }
        }, 1000);
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }


    // --- User Dashboard Functionality ---

    async function displayUserCatalog() {
        const token = getAuthToken();
        if (!token) {
            showMessage('Not authenticated. Please log in.', 'error');
            showAuthPage('login');
            return;
        }
        try {
            const response = await fetch('/api/products/my', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) {
                showMessage('Session expired or unauthorized. Please log in again.', 'error');
                removeAuthToken();
                showAuthPage('login');
                return;
            }
            const catalog = await response.json();
            if (catalogList) {
                catalogList.innerHTML = '';

                if (catalog.length === 0) {
                    catalogList.innerHTML = '<p class="text-gray-500 text-center col-span-full">No products added yet. Start by adding one above!</p>';
                    return;
                }

                catalog.forEach(product => {
                    const productDiv = document.createElement('div');
                    productDiv.className = 'product-item';
                    productDiv.innerHTML = `
                        <h3>${product.name}</h3>
                        <p><strong>Category:</strong> ${product.category}</p>
                        <p><strong>Quantity:</strong> ${product.quantity}</p>
                        <p><strong>Description:</strong> ${product.description}</p>
                        <div class="actions">
                            <button class="edit-btn" data-id="${product.id}">Edit</button>
                            <button class="delete-btn" data-id="${product.id}">Delete</button>
                        </div>
                    `;
                    catalogList.appendChild(productDiv);
                });

                document.querySelectorAll('.edit-btn').forEach(button => {
                    button.addEventListener('click', (event) => openEditModal(event.target.dataset.id));
                });
                document.querySelectorAll('.delete-btn').forEach(button => {
                    button.addEventListener('click', (event) => deleteProduct(event.target.dataset.id));
                });
            }

        } catch (error) {
            console.error('Error fetching user catalog:', error);
            showMessage('Failed to load your catalog. Please try again.', 'error');
        }
    }

    if (addProductBtn) {
        addProductBtn.addEventListener('click', async () => {
            const name = productNameInput.value.trim();
            const category = productCategoryInput.value.trim();
            const quantity = parseInt(productQuantityInput.value, 10);
            const customDescription = productDescriptionInput.value.trim();
            const token = getAuthToken();

            if (!name || !category || isNaN(quantity) || quantity <= 0) {
                showMessage('Please fill in Product Name, Category, and a positive Quantity.', 'warning');
                return;
            }
            if (!token) {
                showMessage('Not authenticated. Please log in.', 'error');
                showAuthPage('login');
                return;
            }

            try {
                const response = await fetch('/api/products/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ name, category, quantity, customDescription }),
                });

                if (response.status === 401 || response.status === 403) {
                    showMessage('Session expired or unauthorized. Please log in again.', 'error');
                    removeAuthToken();
                    showAuthPage('login');
                    return;
                }

                const result = await response.json();

                if (result.success) {
                    showMessage(`Product "${result.product.name}" added successfully!`, 'success');
                    productNameInput.value = '';
                    productCategoryInput.value = '';
                    productQuantityInput.value = '';
                    productDescriptionInput.value = '';
                    displayUserCatalog();
                } else {
                    showMessage(`Error: ${result.message}`, 'error');
                }
            } catch (error) {
                console.error('Error adding product:', error);
                showMessage('An error occurred while adding the product. Please try again.', 'error');
            }
        });
    }

    if (simulateVoiceBtn) {
        simulateVoiceBtn.addEventListener('click', () => {
            const simulatedProducts = [
                { name: "Fresh Apples", category: "Fruits", quantity: 75, description: "" },
                { name: "Hand-woven Basket", category: "Handicrafts", quantity: 10, description: "Beautifully crafted from natural fibers." },
                { name: "Organic Rice", category: "Grains", quantity: 200, description: "" },
                { name: "Pure Cow Ghee", category: "Dairy", quantity: 30, description: "Authentic, rich, and aromatic ghee." }
            ];
            const randomProduct = simulatedProducts[Math.floor(Math.random() * simulatedProducts.length)];

            if (productNameInput) productNameInput.value = randomProduct.name;
            if (productCategoryInput) productCategoryInput.value = randomProduct.category;
            if (productQuantityInput) productQuantityInput.value = randomProduct.quantity;
            if (productDescriptionInput) productDescriptionInput.value = randomProduct.description;

            showMessage(`Voice input simulated: "${randomProduct.name}, ${randomProduct.category}, ${randomProduct.quantity} units"`, 'info');
        });
    }

    // --- Modal Functions for Edit (No changes, included for completeness) ---
    async function openEditModal(id) {
        const token = getAuthToken();
        if (!token) {
            showMessage('Not authenticated. Please log in.', 'error');
            showAuthPage('login');
            return;
        }
        try {
            const response = await fetch('/api/products/my', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) {
                showMessage('Session expired or unauthorized. Please log in again.', 'error');
                removeAuthToken();
                showAuthPage('login');
                return;
            }
            const catalog = await response.json();
            const productToEdit = catalog.find(p => p.id == id);

            if (productToEdit) {
                if (editProductId) editProductId.value = productToEdit.id;
                if (editName) editName.value = productToEdit.name;
                if (editCategory) editCategory.value = productToEdit.category;
                if (editQuantity) editQuantity.value = productToEdit.quantity;
                if (editDescription) editDescription.value = productToEdit.description;
                if (editModal) editModal.classList.remove('hidden');
            } else {
                showMessage('Product not found for editing or you are not authorized to edit it.', 'error');
            }
        } catch (error) {
            console.error('Error opening edit modal:', error);
            showMessage('Could not retrieve product details for editing.', 'error');
        }
    }

    function closeEditModal() {
        if (editModal) editModal.classList.add('hidden');
    }

    if (closeButton) closeButton.addEventListener('click', closeEditModal);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);

    window.addEventListener('click', (event) => {
        if (editModal && event.target == editModal) {
            closeEditModal();
        }
    });

    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', async () => {
            const id = editProductId.value;
            const name = editName.value.trim();
            const category = editCategory.value.trim();
            const quantity = parseInt(editQuantity.value, 10);
            const description = editDescription.value.trim();
            const token = getAuthToken();

            if (!id || !name || !category || isNaN(quantity) || quantity <= 0) {
                showMessage('Please fill in all fields correctly for editing.', 'warning');
                return;
            }
            if (!token) {
                showMessage('Not authenticated. Please log in.', 'error');
                showAuthPage('login');
                return;
            }

            try {
                const response = await fetch('/api/products/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ id, name, category, quantity, description }),
                });

                if (response.status === 401 || response.status === 403) {
                    showMessage('Session expired or unauthorized. Please log in again.', 'error');
                    removeAuthToken();
                    showAuthPage('login');
                    return;
                }

                const result = await response.json();

                if (result.success) {
                    showMessage(`Product "${result.product.name}" updated successfully!`, 'success');
                    closeEditModal();
                    displayUserCatalog();
                } else {
                    showMessage(`Error updating product: ${result.message}`, 'error');
                }
            } catch (error) {
                console.error('Error saving edited product:', error);
                showMessage('An error occurred while saving changes. Please try again.', 'error');
            }
        });
    }

    async function deleteProduct(id) {
        if (!confirmAction("Are you sure you want to delete this product?")) {
            return;
        }
        const token = getAuthToken();
        if (!token) {
            showMessage('Not authenticated. Please log in.', 'error');
            showAuthPage('login');
            return;
        }

        try {
            const response = await fetch('/api/products/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id }),
            });

            if (response.status === 401 || response.status === 403) {
                showMessage('Session expired or unauthorized. Please log in again.', 'error');
                removeAuthToken();
                showAuthPage('login');
                return;
            }

            const result = await response.json();

            if (result.success) {
                showMessage(`Product deleted successfully!`, 'success');
                displayUserCatalog();
            } else {
                showMessage(`Error deleting product: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            showMessage('An error occurred while deleting the product. Please try again.', 'error');
        }
    }

    function confirmAction(message) {
        return window.confirm(message);
    }

    // --- Admin Dashboard Functionality (No changes, included for completeness) ---

    if (refreshAllProductsBtn) refreshAllProductsBtn.addEventListener('click', displayAllProductsAdmin);
    if (refreshUsersBtn) refreshUsersBtn.addEventListener('click', displayAllUsersAdmin);

    async function displayAllProductsAdmin() {
        const token = getAuthToken();
        if (!token) {
            showMessage('Not authenticated. Please log in.', 'error');
            showAuthPage('login');
            return;
        }
        try {
            const response = await fetch('/api/admin/all_products', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) {
                showMessage('Session expired or unauthorized. Please log in as Admin.', 'error');
                removeAuthToken();
                showAuthPage('login');
                return;
            }
            const allProducts = await response.json();
            if (adminCatalogList) {
                adminCatalogList.innerHTML = '';

                if (allProducts.length === 0) {
                    adminCatalogList.innerHTML = '<p class="text-gray-500 text-center col-span-full">No products found in the system.</p>';
                    return;
                }

                allProducts.forEach(product => {
                    const productDiv = document.createElement('div');
                    productDiv.className = 'product-item';
                    productDiv.innerHTML = `
                        <h3>${product.name}</h3>
                        <p><strong>Category:</strong> ${product.category}</p>
                        <p><strong>Quantity:</strong> ${product.quantity}</p>
                        <p><strong>Description:</strong> ${product.description}</p>
                        <p class="text-xs text-gray-500">Owner ID: ${product.userId}</p>
                    `;
                    adminCatalogList.appendChild(productDiv);
                });
            }
        } catch (error) {
            console.error('Error fetching all products for admin:', error);
            showMessage('Failed to load all products for admin. Please try again.', 'error');
        }
    }

    async function displayAllUsersAdmin() {
        const token = getAuthToken();
        if (!token) {
            showMessage('Not authenticated. Please log in.', 'error');
            showAuthPage('login');
            return;
        }
        try {
            const response = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) {
                showMessage('Session expired or unauthorized. Please log in as Admin.', 'error');
                removeAuthToken();
                showAuthPage('login');
                return;
            }
            const users = await response.json();
            if (adminUserList) {
                adminUserList.innerHTML = '';

                if (users.length === 0) {
                    adminUserList.innerHTML = '<p class="text-gray-500 text-center col-span-full">No users registered.</p>';
                    return;
                }

                users.forEach(user => {
                    const userLi = document.createElement('li');
                    userLi.className = 'bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3 text-left';
                    userLi.innerHTML = `
                        <strong>Username:</strong> ${user.username}<br>
                        <strong>Email:</strong> ${user.email}<br>
                        <strong>Role:</strong> ${user.role}<br>
                        <span class="text-xs text-gray-500">User ID: ${user.id}</span>
                    `;
                    adminUserList.appendChild(userLi);
                });
            }
        } catch (error) {
            console.error('Error fetching users for admin:', error);
            showMessage('Failed to load users for admin. Please try again.', 'error');
        }
    }

    // --- Initial Load Logic ---
    const path = window.location.pathname;
    const initialToken = getAuthToken();

    if (initialToken) {
        const decodedToken = jwt_decode(initialToken);
        if (decodedToken && decodedToken.role) {
            currentUserRole = decodedToken.role;
            if (currentUserRole === 'admin' && path !== '/admin-dashboard') {
                window.history.replaceState({}, '', '/admin-dashboard');
            } else if (currentUserRole === 'user' && path !== '/user-dashboard') {
                window.history.replaceState({}, '', '/user-dashboard');
            }
            showDashboard(currentUserRole);
        } else {
            removeAuthToken();
            showAuthPage('login');
        }
    } else {
        // If no token, check path and display appropriate auth page
        if (path === '/signup') {
            showAuthPage('signup');
        } else if (path === '/admin-login') {
            showAuthPage('admin-login');
        } else if (path === '/verify-otp') {
            const storedEmail = sessionStorage.getItem('otpEmail');
            if (storedEmail) {
                otpEmailForVerification = storedEmail;
                showAuthPage('verify-otp');
            } else {
                showMessage('No email found for OTP verification. Please sign up or log in again.', 'warning');
                window.history.replaceState({}, '', '/');
                showAuthPage('login');
            }
        }
        else {
            showAuthPage('login'); // Default to login page
        }
    }

    // Store email in session storage after signup to retrieve on OTP page refresh
    // This part should be triggered after a successful signup API call
    // For the initial load, it only retrieves if already set.
    // The actual setting happens in signupBtn.addEventListener('click')
    // and loginBtn.addEventListener('click') when redirectTo is '/verify-otp'.
    if (window.location.pathname === '/verify-otp' && !otpEmailForVerification && sessionStorage.getItem('otpEmail')) {
        otpEmailForVerification = sessionStorage.getItem('otpEmail');
    }
});
