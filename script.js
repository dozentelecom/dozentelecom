// State tracking
let isLoginMode = true;
let loggedInUserPhone = "";

// 1. Visually toggle between Login and Register views
const toggleAuthLink = document.getElementById('toggleAuthMode');
if (toggleAuthLink) {
    toggleAuthLink.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        
        const phoneLabel = document.getElementById('phoneLabel');
        const phoneInput = document.getElementById('authPhone');
        
        if (isLoginMode) {
            if (document.getElementById('authTitle')) document.getElementById('authTitle').innerText = "Welcome Back";
            if (document.getElementById('authSubtitle')) document.getElementById('authSubtitle').innerText = "Login to access cheap data and airtime plans";
            if (document.getElementById('mainAuthBtn')) document.getElementById('mainAuthBtn').innerText = "Login";
            toggleAuthLink.innerHTML = `Don't have an account? <span style="text-decoration: underline; cursor: pointer;">Create Account</span>`;
            
            // Hide registration-only fields
            document.querySelectorAll('.reg-only').forEach(el => el.style.display = 'none');
            
            if (phoneLabel) phoneLabel.innerText = "Phone Number or Email Address";
            if (phoneInput) phoneInput.placeholder = "e.g. 08143140831 or user@example.com";
        } else {
            if (document.getElementById('authTitle')) document.getElementById('authTitle').innerText = "Create Account";
            if (document.getElementById('authSubtitle')) document.getElementById('authSubtitle').innerText = "Sign up to start saving on transactions";
            if (document.getElementById('mainAuthBtn')) document.getElementById('mainAuthBtn').innerText = "Register";
            toggleAuthLink.innerHTML = `Already have an account? <span style="text-decoration: underline; cursor: pointer;">Login</span>`;
            
            // Show registration-only fields
            document.querySelectorAll('.reg-only').forEach(el => el.style.display = 'block');
            
            if (phoneLabel) phoneLabel.innerText = "Phone Number";
            if (phoneInput) phoneInput.placeholder = "e.g. 08143140831";
        }
    });
}

// 2. Handles login or registration submission on click
const mainAuthBtn = document.getElementById('mainAuthBtn');
if (mainAuthBtn) {
    mainAuthBtn.addEventListener('click', async () => {
        // Grab inputs
        const phone = document.getElementById('authPhone') ? document.getElementById('authPhone').value.trim() : "";
        const password = document.getElementById('authPassword') ? document.getElementById('authPassword').value.trim() : "";
        
        const nameInput = document.getElementById('authName');
        const emailInput = document.getElementById('authEmail');
        const pinInput = document.getElementById('authPin');

        const username = nameInput ? nameInput.value.trim() : "";
        const email = emailInput ? emailInput.value.trim() : "";
        const pin = pinInput ? pinInput.value.trim() : "";

        // Validate basic fields
        if (!phone || !password) {
            alert("Please provide phone/email and password.");
            return;
        }

        if (!isLoginMode) {
            if (!username || !email || !pin) {
                alert("Please fill in all registration fields: Full Name, Email, and 4-Digit PIN.");
                return;
            }
            if (pin.length !== 4 || isNaN(pin)) {
                alert("Transaction PIN must be a 4-digit number.");
                return;
            }
        }

        try {
            if (isLoginMode) {
                // ==================== LOGIN ====================
                const res = await fetch('https://dozentelecom.onrender.com/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, password })
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    alert("Login successful!");
                    if (data.user) {
                        loggedInUserPhone = data.user.phone;
                        if (document.getElementById('userGreeting')) {
                            document.getElementById('userGreeting').innerText = data.user.username || data.user.name || "User";
                        }
                    }
                    if (document.getElementById('authCard')) document.getElementById('authCard').style.display = 'none';
                    if (document.getElementById('transactionCard')) document.getElementById('transactionCard').style.display = 'block';
                    if (document.getElementById('logoutSection')) document.getElementById('logoutSection').style.display = 'block';
                } else {
                    alert(data.message || "Invalid login credentials.");
                }

            } else {
              // ==================== REGISTER ====================
const res = await fetch('https://dozentelecom.onrender.com/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
        name: username,  // <-- This maps 'username' from HTML to 'name' on the database!
        email: email, 
        phone: phone, 
        password: password, 
        pin: pin 
    })
});

                const data = await res.json();

                if (res.ok) {
                    alert("Registration successful! You can now log in.");
                    isLoginMode = true;
                    if (document.getElementById('authTitle')) document.getElementById('authTitle').innerText = "Welcome Back";
                    if (document.getElementById('mainAuthBtn')) document.getElementById('mainAuthBtn').innerText = "Login";
                    toggleAuthLink.innerHTML = `Don't have an account? <span style="text-decoration: underline; cursor: pointer;">Create Account</span>`;
                    document.querySelectorAll('.reg-only').forEach(el => el.style.display = 'none');
                } else {
                    alert(data.message || "Server error during registration.");
                }
            }
        } catch (err) {
            console.error("Auth Error:", err);
            alert("Backend logic engine is offline.");
        }
    });
}

// 3. Request Password Reset OTP
const sendOtpBtn = document.getElementById('sendOtpBtn');
if (sendOtpBtn) {
    sendOtpBtn.addEventListener('click', async () => {
        const identifier = document.getElementById('resetIdentifier') ? document.getElementById('resetIdentifier').value.trim() : "";
        if (!identifier) {
            alert("Please input your Email Address or Phone Number.");
            return;
        }

        try {
            const res = await fetch('https://dozentelecom.onrender.com/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier })
            });

            const data = await res.json();
            if (res.ok) {
                alert("An OTP code has been sent to your registered email address.");
                // Show OTP and New Password section
                if (document.getElementById('otpSection')) document.getElementById('otpSection').style.display = 'block';
            } else {
                alert(data.message || "Error sending password reset OTP.");
            }
        } catch (err) {
            console.error("OTP Error:", err);
            alert("Unable to reach authentication server.");
        }
    });
}

// 4. Submit Password Reset with OTP
const resetPasswordBtn = document.getElementById('resetPasswordBtn');
if (resetPasswordBtn) {
    resetPasswordBtn.addEventListener('click', async () => {
        const identifier = document.getElementById('resetIdentifier') ? document.getElementById('resetIdentifier').value.trim() : "";
        const otp = document.getElementById('resetOtp') ? document.getElementById('resetOtp').value.trim() : "";
        const newPassword = document.getElementById('newPassword') ? document.getElementById('newPassword').value.trim() : "";

        if (!otp || !newPassword) {
            alert("Please input the OTP sent to your email and your new password.");
            return;
        }

        try {
            const res = await fetch('https://dozentelecom.onrender.com/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, otp, newPassword })
            });

            const data = await res.json();
            if (res.ok) {
                alert("Password changed successfully! You can now log in.");
                window.location.reload();
            } else {
                alert(data.message || "Failed to reset password. Please check your OTP.");
            }
        } catch (err) {
            console.error("Reset Error:", err);
            alert("Unable to process password reset request.");
        }
    });
}

// 5. Sign Out / Logout Operation
// This looks for your red button and resets the page when clicked
const signOutBtn = document.getElementById('logoutBtn') || document.getElementById('signOutBtn') || document.getElementById('logoutSection');

if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
        // Clear stored user state
        loggedInUserPhone = "";
        
        alert("You have signed out successfully.");
        
        // Reload the page to securely wipe all active user data and show the login screen
        window.location.reload();
    });
}