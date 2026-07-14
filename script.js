const dataPlans = {
    mtn: [
        { id: "1", name: "MTN SME 1GB (30 days)", price: 260 },
        { id: "2", name: "MTN SME 2GB (30 days)", price: 520 },
        { id: "5", name: "MTN SME 5GB (30 days)", price: 1300 }
    ],
    airtel: [{ id: "11", name: "Airtel CG 1GB (30 days)", price: 270 }],
    glo: [{ id: "21", name: "Glo Gift 1.35GB (30 days)", price: 430 }],
    "9mobile": [{ id: "31", name: "9mobile 1GB (30 days)", price: 400 }]
};

let loggedInUserPhone = ""; 
let isLoginMode = true;

const serviceSelect = document.getElementById('service');
const networkSelect = document.getElementById('network');
const amountGroup = document.getElementById('amountGroup');
const toggleAuthLink = document.getElementById('toggleAuthMode');

// Toggles visual views between Logging in vs Creating an account
// Toggles visual views between Logging in vs Creating an account
toggleAuthLink.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    
    const phoneLabel = document.getElementById('phoneLabel');
    const phoneInput = document.getElementById('authPhone');
    
    if (isLoginMode) {
        document.getElementById('authTitle').innerText = "Welcome Back";
        document.getElementById('authSubtitle').innerText = "Login to access cheap data and airtime plans";
        document.getElementById('mainAuthBtn').innerText = "Login";
        toggleAuthLink.innerText = "Don't have an account? Create Account";
        document.querySelectorAll('.reg-only').forEach(el => el.style.display = 'none');
        
        // On Login screen: Accept both phone and email
		if (phoneLabel) phoneLabel.innerText = "Phone Number or Email Address";
		if (phoneInput) phoneInput.placeholder = "e.g. 08143140831 or user@example.com";
        
    } else {
        document.getElementById('authTitle').innerText = "Create Account";
        document.getElementById('authSubtitle').innerText = "Join Dozentelecom platform for free";
        document.getElementById('mainAuthBtn').innerText = "Sign Up";
        toggleAuthLink.innerText = "Already registered? Login Here";
        document.querySelectorAll('.reg-only').forEach(el => el.style.display = 'block');
        
        // On Create Account screen: Make this field strictly for Phone Number
		if (phoneLabel) phoneLabel.innerText = "Phone Number";
		if (phoneInput) phoneInput.placeholder = "e.g. 08143140831";
    }
});

// Handles form registration or verification on click
document.getElementById('mainAuthBtn').addEventListener('click', async () => {
    // 1. Grab values from HTML inputs
    const phone = document.getElementById('authPhone') ? document.getElementById('authPhone').value.trim() : "";
    const password = document.getElementById('authPassword') ? document.getElementById('authPassword').value.trim() : "";
    
    // Grab registration-only inputs
    const nameInput = document.getElementById('authName');
    const emailInput = document.getElementById('authEmail');
    const pinInput = document.getElementById('authPin');

    const username = nameInput ? nameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";
    const pin = pinInput ? pinInput.value.trim() : "";

    // 2. Validate Inputs
    if (!phone || !password) {
        alert("Please provide phone and password.");
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

    // 3. Send Requests
    try {
        if (isLoginMode) {
            // ==================== LOGIN OPERATION ====================
            const res = await fetch('https://dozentelecom.onrender.com/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                alert("Login successful!");
                window.location.reload(); 
            } else {
                alert(data.message || "Invalid login credentials.");
            }

        } else {
            // ==================== REGISTER OPERATION ====================
            const res = await fetch('https://dozentelecom.onrender.com/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: username, 
                    email: email, 
                    phone: phone, 
                    password: password, 
                    pin: pin 
                })
            });

            const data = await res.json();

            if (res.ok) {
                alert("Registration successful! You can now log in.");
                
                // Manually switch back to login mode instead of refreshing!
                isLoginMode = true;
                document.getElementById('authTitle').innerText = "Login";
                document.getElementById('mainAuthBtn').innerText = "Login";
                document.getElementById('toggleAuthMode').innerHTML = `Don't have an account? <span style="text-decoration: underline; cursor: pointer;">Create Account</span>`;
                
                // Hide registration-only fields
                document.querySelectorAll('.reg-only').forEach(el => el.style.display = 'none');
            } else {
                alert(data.message || "Server error during registration.");
            }
        }

    } catch (err) {
        console.error("Authentication Error:", err);
        alert("Unable to connect to the server. Please check your network and try again.");
    }
});

    if (isLoginMode) {
        // LOGIN OPERATION
        try {
            const res = await fetch('https://dozentelecom.onrender.com/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });
            const data = await res.json();
            if (data.success) {
                loggedInUserPhone = data.user.phone;
                document.getElementById('userGreeting').innerText = data.user.name;
                document.getElementById('authCard').style.display = 'none';
                document.getElementById('transactionCard').style.display = 'block';
                document.getElementById('logoutSection').style.display = 'block';
            } else {
                alert(data.message);
            }
        } catch (err) {
            alert("Backend logic engine is offline.");
        }
    } else {
        // REGISTRATION OPERATION
        const name = document.getElementById('authName').value.trim();
        const pin = document.getElementById('authPin').value.trim();

        if (!name || pin.length !== 4) {
            alert("Please fill in your name and ensure security PIN is exactly 4 digits.");
            return;
        }

        try {
            const res = await fetch('https://dozentelecom.onrender.com/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, password, pin })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                toggleAuthLink.click(); // resets UI back to login mode
            } else {
                alert(data.message);
            }
        } catch (err) {
            alert("Registration request failed.");
        }
    }
});

// Sign Out Routine
document.getElementById('logoutBtn').addEventListener('click', () => {
    loggedInUserPhone = "";
    document.getElementById('authPhone').value = "";
    document.getElementById('authPassword').value = "";
    document.getElementById('transactionCard').style.display = 'none';
    document.getElementById('logoutSection').style.display = 'none';
    document.getElementById('authCard').style.display = 'block';
});

// Update standard dynamic package fields
serviceSelect.addEventListener('change', updateFormFields);
networkSelect.addEventListener('change', updateFormFields);

function updateFormFields() {
    const service = serviceSelect.value;
    const network = networkSelect.value;

    if (service === 'data') {
        if (!network) {
            amountGroup.innerHTML = `
                <label>Select Data Plan</label>
                <select disabled><option>Choose network provider...</option></select>
            `;
            return;
        }
        let options = (dataPlans[network] || []).map(p => `<option value="${p.id}">${p.name} - ₦${p.price}</option>`).join('');
        amountGroup.innerHTML = `
            <label for="dataPlan">Select Data Plan</label>
            <select id="dataPlan" required><option value="" disabled selected>Choose bundle</option>${options}</select>
        `;
    } else {
        amountGroup.innerHTML = `
            <label for="amount">Amount (₦)</label>
            <input type="number" id="amount" min="100" placeholder="Minimum 100" required>
        `;
    }
}

// Intercept Purchase form submission and push payment requests with secure confirmation pin validation
document.getElementById('rechargeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const network = networkSelect.value;
    const service = serviceSelect.value;
    const phone = document.getElementById('phone').value;
    const pin = document.getElementById('confirmPin').value;
    
    let amount = 0;
    let planId = "";

    if (service === 'data') {
        const dataPlanSelect = document.getElementById('dataPlan');
        planId = dataPlanSelect.value;
        const selectedPlan = dataPlans[network].find(p => p.id === planId);
        amount = selectedPlan.price;
    } else {
        amount = document.getElementById('amount').value;
    }

    try {
        const response = await fetch('https://dozentelecom.onrender.com/api/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: "customer_dozen@example.com", 
                amount: amount,
                userPhone: loggedInUserPhone,
                transactionPin: pin,
                metadata: { phone, network, serviceType: service, planId }
            })
        });

        const data = await response.json();

        if (data.success && data.authorization_url) {
            window.location.href = data.authorization_url;
        } else {
            alert(data.message || "Execution blocked.");
        }
    } catch (error) {
        alert("Unable to establish backend link.");
    }
});
// --- PASSWORD RESET SYSTEM HANDLERS ---
const authCard = document.getElementById('authTitle')?.parentElement?.parentElement || document.querySelector('.auth-form-padding')?.parentElement;
const resetCard = document.getElementById('resetCard');
const resetStep1 = document.getElementById('resetStep1');
const resetStep2 = document.getElementById('resetStep2');

// Open Reset Screen when "Forgot Password?" is clicked
document.getElementById('forgotPasswordLink').addEventListener('click', () => {
    if (authCard) authCard.style.display = 'none';
    resetCard.style.display = 'block';
    resetStep1.style.display = 'block';
    resetStep2.style.display = 'none';
});

// Go Back to Login Screen
document.getElementById('backToLoginFromReset').addEventListener('click', () => {
    resetCard.style.display = 'none';
    if (authCard) authCard.style.display = 'block';
});

// Action A: Request OTP Code
document.getElementById('sendOtpBtn').addEventListener('click', async () => {
    const identifier = document.getElementById('resetIdentifier').value.trim();
    if (!identifier) return alert("Please input your Email Address.");

    try {
        const res = await fetch('https://dozentelecom.onrender.com/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
            alert(data.message);
            resetStep1.style.display = 'none';
            resetStep2.style.display = 'block';
        } else {
            alert(data.message || "failed to send reset code.");
        }
    } catch (err) {
		console.error(err);
        alert("Unable to connect to the server.");
    }
});

// Action B: Verify and Reset Password
document.getElementById('verifyAndResetBtn').addEventListener('click', async () => {
    const identifier = document.getElementById('resetIdentifier').value.trim();
    const otp = document.getElementById('resetOtp').value.trim();
    const newPassword = document.getElementById('resetNewPassword').value.trim();

    if (!otp || !newPassword) return alert("Please fill in both the OTP code and your new password.");

    try {
        const res = await fetch('https://dozentelecom.onrender.com/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, otp, newPassword })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            alert("Password reset successful! Redirecting to login...");
            window.location.reload();
        } else {
            alert(data.message || "Failed to reset password.");
        }
    } catch (err) {
        console.error(err);
        alert("Unable to connect to the server.");
    }
});
// Function to handle the "Send Verification Code" button click
async function handleForgotPassword() {
    // Make sure your input field has an id="resetIdentifier" in your HTML!
    const emailInput = document.getElementById('resetIdentifier').value.trim();

    if (!emailInput) {
        alert("Please enter your registered email address.");
        return;
    }

    try {
        const response = await fetch('https://dozentelecom.onrender.com/api/auth/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ identifier: emailInput })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(data.message);
        } else {
            alert(data.message || "Failed to send reset code.");
        }
    } catch (err) {
        console.error("Frontend Error:", err);
        alert("Unable to connect to the server. Please try again later.");
    }
}