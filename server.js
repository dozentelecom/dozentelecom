require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors());

// Temporary memory store simulating database arrays
const databaseUsers = [];

// 1. ROUTE: Register Account (With encrypted password & 4-digit PIN)
app.post('/api/auth/register', async (req, res) => {
    const { name, phone, password, pin } = req.body;

    const exists = databaseUsers.find(u => u.phone === phone);
    if (exists) return res.status(400).json({ success: false, message: 'Phone number already registered.' });

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const hashedPin = await bcrypt.hash(pin, salt); // Securely hash the 4-digit PIN too

        const newUser = {
            name: name.toUpperCase(),
            phone: phone,
            password: hashedPassword,
            pin: hashedPin
        };
        databaseUsers.push(newUser);
        res.json({ success: true, message: 'Account created successfully! Please login.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Registration failed.' });
    }
});

// 2. ROUTE: User Account Login
app.post('/api/auth/login', async (req, res) => {
    const { phone, password } = req.body;
    const user = databaseUsers.find(u => u.phone === phone);
    if (!user) return res.status(400).json({ success: false, message: 'Account details not found.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Incorrect credentials.' });

    res.json({ success: true, user: { name: user.name, phone: user.phone } });
});

// Initialize Resend with your API key
const resend = new Resend('re_HyNv9KVt_LCnwKYQXq9T578GhJcsbAJeu');

// 4. ROUTE: Forgot Password (via Resend HTTP API)
app.post('/api/auth/forgot-password', async (req, res) => {
    const { identifier } = req.body;
    try {
        // Find user by email address
        const user = databaseUsers.find(u => u.email === identifier);
        if (!user) {
            return res.status(404).json({ success: false, message: "No account found with this information." });
        }

        // Generate secure 6-digit OTP code
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetOtp = otpCode;
        user.resetOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiration

        // Send email via Resend API (Uses Port 443, so Render won't block it!)
        await resend.emails.send({
            from: 'onboarding@resend.dev', // Free testing domain provided by Resend
            to: user.email,
            subject: 'Password Reset OTP Code',
            html: `<p>Your password reset code is <strong>${otpCode}</strong>. It expires in 10 minutes.</p>`
        });

        return res.json({ success: true, message: "A secure verification code has been sent to your email address." });

    } catch (err) {
        console.error("Resend Engine Error:", err);
        return res.status(500).json({ success: false, message: "Server error handling email OTP delivery." });
    }
});

// 5. ROUTE: Reset Password (Validates OTP and replaces the password)
app.post('/api/auth/reset-password', async (req, res) => {
    const { identifier, otp, newPassword } = req.body;
    try {
        const user = databaseUsers.find(u => 
            (u.phone === identifier || u.email === identifier) && 
            u.resetOtp === otp && 
            u.resetOtpExpires > Date.now()
        );

        if (!user) return res.status(400).json({ success: false, message: "Invalid or expired OTP verification code." });

        // Securely hash and save the new password using bcrypt
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        
        // Clear out the OTP fields after a successful reset
        user.resetOtp = undefined;
        user.resetOtpExpires = undefined;

        res.json({ success: true, message: "Password updated successfully." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error resetting user password." });
    }
});

// 3. ROUTE: Secure Payment Loop with PIN verification
app.post('/api/pay', async (req, res) => {
    const { email, amount, userPhone, transactionPin, metadata } = req.body;

    // Locate the customer account authorizing this transaction
    const user = databaseUsers.find(u => u.phone === userPhone);
    if (!user) return res.status(401).json({ success: false, message: 'Authentication failed.' });

    // Validate the 4-Digit Security PIN
    const isPinValid = await bcrypt.compare(transactionPin, user.pin);
    if (!isPinValid) return res.status(403).json({ success: false, message: 'Security check failed: Incorrect 4-Digit Transaction PIN.' });

    try {
        const response = await axios.post('https://api.paystack.co/transaction/initialize', {
            email: email,
            amount: amount * 100, 
            metadata: metadata 
        }, {
            headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
        });
        
        res.json({ success: true, authorization_url: response.data.data.authorization_url });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Payment link processing failed.' });
    }
});

// 5. ROUTE: Automated API Callback
app.post('/api/webhook', async (req, res) => {
    const event = req.body;
    if (event.event === 'charge.success') {
        const dataReceived = event.data.metadata;
        const amountPaid = event.data.amount / 100;
        const { phone, network, serviceType, planId } = dataReceived;

        try {
            if (serviceType === 'airtime') {
                await axios.post('https://sabuss.com/vtu/api/airtime', {
                    api_key: process.env.SMARTAPI_SECRET_KEY,
                    network: network.toUpperCase(),
                    amount: amountPaid,
                    phone: phone
                });
            } else if (serviceType === 'data') {
                await axios.post('https://sabuss.com/vtu/api/data', {
                    api_key: process.env.SMARTAPI_SECRET_KEY,
                    network: network.toUpperCase(),
                    plan_code: planId,
                    phone: phone
                });
            }
            return res.sendStatus(200);
        } catch (error) {
            return res.sendStatus(500);
        }
    }
    res.sendStatus(200);
});

app.listen(5000, () => console.log('Secure logic server active on port 5000'));