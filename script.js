// ==========================================
// UNIFIED DOZENTELECOM AUTHENTICATION SCRIPT
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // --- STATE VARIABLES ---
    let isRegisterMode = false;

    // --- DOM ELEMENTS ---
    const authCard = document.getElementById("authCard");
    const resetCard = document.getElementById("resetCard");
    const resetStep2 = document.getElementById("resetStep2");
    
    // Auth inputs & buttons
    const authPhone = document.getElementById("authPhone");
    const authPassword = document.getElementById("authPassword");
    const authPin = document.getElementById("authPin");
    const mainAuthBtn = document.getElementById("mainAuthBtn");
    const toggleAuthMode = document.getElementById("toggleAuthMode");
    const phoneLabel = document.getElementById("phoneLabel");
    const regOnlyFields = document.querySelectorAll(".reg-only");

    // Forgot / Reset Password elements
    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    const resetIdentifier = document.getElementById("resetIdentifier");
    const sendOtpBtn = document.getElementById("sendOtpBtn"); // DECLARED ONLY ONCE NOW
    const resetOtp = document.getElementById("resetOtp");
    const resetNewPassword = document.getElementById("resetNewPassword");
    const verifyAndResetBtn = document.getElementById("verifyAndResetBtn");

    // Logout elements
    const logoutSection = document.getElementById("logoutSection");
    const logoutBtn = document.getElementById("logoutBtn");

    // ==========================================
    // 1. INITIAL SESSION CHECK (On Page Load)
    // ==========================================
    const userToken = localStorage.getItem("userToken");
    if (userToken) {
        if (logoutSection) logoutSection.style.display = "block";
        if (authCard) authCard.style.display = "none";
    } else {
        if (logoutSection) logoutSection.style.display = "none";
        if (authCard) authCard.style.display = "block";
    }

    // ==========================================
    // 2. TOGGLE LOGIN / REGISTER MODE
    // ==========================================
    if (toggleAuthMode) {
        toggleAuthMode.addEventListener("click", (e) => {
            e.preventDefault();
            isRegisterMode = !isRegisterMode;

            if (isRegisterMode) {
                if (phoneLabel) phoneLabel.textContent = "Phone Number";
                if (mainAuthBtn) mainAuthBtn.textContent = "Register";
                if (toggleAuthMode) toggleAuthMode.innerHTML = 'Already have an account? Login';
                regOnlyFields.forEach(el => el.style.display = "block");
            } else {
                if (phoneLabel) phoneLabel.textContent = "Phone Number or Email Address";
                if (mainAuthBtn) mainAuthBtn.textContent = "Login";
                if (toggleAuthMode) toggleAuthMode.innerHTML = "Don't have an account? Create Account";
                regOnlyFields.forEach(el => el.style.display = "none");
            }
        });
    }

    // ==========================================
    // 3. SUBMIT LOGIN / REGISTRATION
    // ==========================================
    if (mainAuthBtn) {
        mainAuthBtn.addEventListener("click", async () => {
            const phoneOrEmail = authPhone ? authPhone.value.trim() : "";
            const password = authPassword ? authPassword.value.trim() : "";
            const pin = authPin ? authPin.value.trim() : "";

            if (!phoneOrEmail || !password) {
                alert("Please fill in your credentials.");
                return;
            }

            if (isRegisterMode && !pin) {
                alert("Please enter a 4-digit transaction PIN to register.");
                return;
            }

            const endpoint = isRegisterMode 
                ? "https://dozentelecom.onrender.com/api/auth/register"
                : "https://dozentelecom.onrender.com/api/auth/login";

            // Send both pin fields so backend is guaranteed to accept it
// Send name, email, phone, and both pin fields so backend is guaranteed to accept it
const payload = isRegisterMode
    ? { 
        name: document.getElementById("authName") ? document.getElementById("authName").value : "",
        email: document.getElementById("authEmail") ? document.getElementById("authEmail").value : "",
        phone: phoneOrEmail, 
        password, 
        pin, 
        transactionPin: pin 
      }
    : { identifier: phoneOrEmail, password };

            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (res.ok) {
                    if (isRegisterMode) {
                        alert("Registration successful! Switching to login...");
                        toggleAuthMode.click();
                    } else {
                        alert("Login successful!");
                        localStorage.setItem("userToken", data.token);
                        window.location.reload();
                    }
                } else {
                    alert(data.message || "An authentication error occurred.");
                }
            } catch (err) {
                console.error("Auth Error:", err);
                alert("Cannot connect to server. Check your internet connection.");
            }
        });
    }

    // ==========================================
    // 4. SIGN OUT FUNCTIONALITY
    // ==========================================
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("userToken");
            alert("Signed out successfully!");
            window.location.reload();
        });
    }

    // ==========================================
    // 5. FORGOT PASSWORD: OPEN CARD
    // ==========================================
    if (forgotPasswordLink && resetCard) {
        forgotPasswordLink.addEventListener("click", (e) => {
            e.preventDefault();
            if (authCard) authCard.style.display = "none";
            resetCard.style.display = "block";
        });
    }

    // ==========================================
    // 6. FORGOT PASSWORD: STEP 1 (SEND OTP)
    // ==========================================
    if (sendOtpBtn) {
        sendOtpBtn.addEventListener("click", async () => {
            const identifier = resetIdentifier ? resetIdentifier.value.trim() : "";
            if (!identifier) {
                alert("Please input your Email Address or Phone Number.");
                return;
            }

            try {
                const res = await fetch("https://dozentelecom.onrender.com/api/auth/forgot-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identifier })
                });

                const data = await res.json();
                if (res.ok) {
                    alert("An OTP code has been sent to your registered email address.");
                    if (resetStep2) resetStep2.style.display = "block";
                } else {
                    alert(data.message || "Error sending password reset OTP.");
                }
            } catch (err) {
                console.error("OTP Error:", err);
                alert("Unable to reach authentication server.");
            }
        });
    }

    // ==========================================
    // 7. FORGOT PASSWORD: STEP 2 (RESET PASS)
    // ==========================================
    if (verifyAndResetBtn) {
        verifyAndResetBtn.addEventListener("click", async () => {
            const identifier = resetIdentifier ? resetIdentifier.value.trim() : "";
            const otp = resetOtp ? resetOtp.value.trim() : "";
            const newPassword = resetNewPassword ? resetNewPassword.value.trim() : "";

            if (!otp || !newPassword) {
                alert("Please enter the OTP code sent to your email and your new password.");
                return;
            }

            try {
                const res = await fetch("https://dozentelecom.onrender.com/api/auth/reset-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
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

    // ==========================================
    // 8. BACK TO LOGIN ACTION
    // ==========================================
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (resetCard) resetCard.style.display = 'none';
            if (authCard) authCard.style.display = 'block';
        });
    }
});
