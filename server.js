const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/dozentelecom";
mongoose.connect(mongoURI)
    .then(() => console.log("Connected to MongoDB successfully"))
    .catch((err) => console.error("Database connection error:", err));

// --- MONGOOSE USER SCHEMA ---
const userSchema = new mongoose.Schema({
    name: { type: String },
    phone: { type: String, required: true, unique: true },
    email: { type: String, default: "" }, 
    password: { type: String, required: true },
    transactionPin: { type: String, required: true }, // Unified storage
    resetOtp: { type: String },
    resetOtpExpires: { type: Date }
});

// ==========================================
// ROOT HEALTH CHECK ROUTE
// ==========================================
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: "DozenTelecom API Server is running and healthy!"
    });
});

const User = mongoose.model('User', userSchema);

// --- INITIALIZE RESEND EMAIL API ---
// Reads your key securely from environment variables, or falls back to your development key
const resendApiKey = process.env.RESEND_API_KEY || 're_HyNv9KVt_LCnwKYQxq9T578GhJcsbAJeu';
const resend = new Resend(resendApiKey);


// ==========================================
// 1. ROUTE: Register Account
// ==========================================
app.post('/api/auth/register', async (req, res) => {
    // Accepts pin or transactionPin dynamically from the payload
    const { name, phone, password, pin, transactionPin, email } = req.body;
    const finalPin = pin || transactionPin;

    if (!phone || !password || !finalPin) {
        return res.status(400).json({ success: false, message: "Missing required fields: phone, password, and transaction PIN are required." });
    }

    try {
        // Find existing user by phone OR email
        const user = await User.findOne({
            $or: [
                { phone: phone },
                ...(email ? [{ email: email }] : [])
            ]
        });

        // FIXED: 'user' variable is now correctly referenced (was crashing on 'exists')
        if (user) {
            return res.status(400).json({ success: false, message: 'Phone number or email is already registered.' });
        }

        // Hash secret details
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const hashedPin = await bcrypt.hash(finalPin, salt);

        // Save new user document to MongoDB
        const newUser = new User({
            name: name ? name.trim() : "",
            phone: phone.trim(),
            email: email ? email.trim().toLowerCase() : "",
            password: hashedPassword,
            transactionPin: hashedPin
        });.

        await newUser.save();
        return res.status(201).json({ success: true, message: "Account registered successfully!" });

    } catch (err) {
        console.error("Registration Server Error:", err);
        return res.status(500).json({ success: false, message: "Server error during registration" });
    }
});


// ==========================================
// 2. ROUTE: User Login
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    const { identifier, password } = req.body;

    try {
        // FIXED: Restored template literal syntax to properly read the 'identifier' variable
        const user = await User.findOne({
            $or: [
                { phone: identifier },
                { email: { $regex: new RegExp(`^${identifier}$`, 'i') } }
            ]
        });

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid credentials (User not found)" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid credentials (Incorrect password)" });
        }

        // Simulated login token return
        const token = "mock_session_token_" + user._id;

        return res.status(200).json({ 
            success: true, 
            message: "Login successful!", 
            token: token,
            user: { id: user._id, phone: user.phone, email: user.email }
        });

    } catch (err) {
        console.error("Login Server Error:", err);
        return res.status(500).json({ success: false, message: "Internal server error during login" });
    }
});


// ==========================================
// 3. ROUTE: Send OTP (Forgot Password)
// ==========================================
app.post('/api/auth/forgot-password', async (req, res) => {
    const { identifier } = req.body;

    try {
        const user = await User.findOne({
            $or: [
                { phone: identifier },
                { email: { $regex: new RegExp(`^${identifier}$`, 'i') } }
            ]
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "No registered account found with that detail." });
        }

        // Fallback email determination
        const targetEmail = user.email || identifier;
        if (!targetEmail || !targetEmail.includes('@')) {
            return res.status(400).json({ success: false, message: "An OTP can only be dispatched to a valid email address." });
        }

        // Generate a random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP to DB with a 10-minute validity
        user.resetOtp = otp;
        user.resetOtpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        // Send OTP using Resend (using onboarding@resend.dev for free test sandbox accounts)
        await resend.emails.send({
            from: 'onboarding@resend.dev', 
            to: targetEmail,               
            subject: 'DozenTelecom - Reset Password OTP',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #4f46e5; text-align: center;">DozenTelecom</h2>
                    <p>Hello,</p>
                    <p>We received a request to change your password. Use this verification code below to proceed:</p>
                    <div style="background: #f1f5f9; padding: 15px; border-radius: 6px; font-size: 26px; font-weight: bold; letter-spacing: 3px; text-align: center; color: #1e293b; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This OTP will expire in <strong>10 minutes</strong>. If you did not make this request, please change your security settings immediately.</p>
                </div>
            `
        });

        return res.status(200).json({ success: true, message: "OTP code sent successfully!" });

    } catch (err) {
        console.error("OTP Delivery Error:", err);
        return res.status(500).json({ success: false, message: "Server error handling email OTP delivery" });
    }
});


// ==========================================
// 4. ROUTE: Reset Password (Using OTP)
// ==========================================
app.post('/api/auth/reset-password', async (req, res) => {
    const { identifier, otp, newPassword } = req.body;

    try {
        const user = await User.findOne({
            $or: [
                { phone: identifier },
                { email: { $regex: new RegExp(`^${identifier}$`, 'i') } }
            ]
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Validate OTP and Expiration
        if (!user.resetOtp || user.resetOtp !== otp) {
            return res.status(400).json({ success: false, message: "Invalid OTP code." });
        }

        if (Date.now() > user.resetOtpExpires) {
            return res.status(400).json({ success: false, message: "OTP code has expired." });
        }

        // Hash and update the new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        // Clear out OTP values
        user.resetOtp = undefined;
        user.resetOtpExpires = undefined;
        await user.save();

        return res.status(200).json({ success: true, message: "Your password has been reset successfully!" });

    } catch (err) {
        console.error("Password Reset Error:", err);
        return res.status(500).json({ success: false, message: "Internal server error during password reset" });
    }
});

// --- PORT BINDING ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running successfully on port ${PORT}`);
});
