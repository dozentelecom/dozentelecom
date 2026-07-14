require('dotenv').config();
const { Resend } = require('resend');
const mongoose = require('mongoose');

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// Temporary memory store simulating database arrays
// Connect to MongoDB
mongoose.connect('mongodb+srv://Dozentelecom:YeXOFIkZQtjBdHcK@dozentelecom.bfghhqz.mongodb.net/?appName=Dozentelecom')
	.then(() => console.log('Successfully connected to permanet Mongodb!'))
	.catch(err => console.error('Database connection error:', err));
// Define User Schema & Model
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  pin: { type: String, required: true },
  email: { type: String, unique: true, sparse: true }, // keeping it sparse in case some old users don't have emails yet
  resetOtp: { type: String },
  resetOtpExpires: { type: Date }
});

const User = mongoose.model('User', userSchema);;

// 1. ROUTE: Register Account (With encrypted password & 4-digit PIN)
app.post('/api/auth/register', async (req, res) => {
  const { name, phone, password, pin, email } = req.body;

  try {
  // 1. Check if the user already exists in MongoDB
        const user = await User.findOne({
            $or: [
                { phone: phone },
                { email: phone }
            ]
        });

        // FIXED: Changed 'exists' to 'user' to match your variable above
        if (user) { 
            return res.status(400).json({ success: false, message: 'Phone number/email already registered' });
        }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const hashedPin = await bcrypt.hash(pin, salt);

    // Save the new user directly to MongoDB
    const newUser = new User({
      name,
      phone,
      password: hashedPassword,
      pin: hashedPin,
      email: email || "" // Default to empty string if email isn't provided yet
    });

    await newUser.save();

    res.status(201).json({ success: true, message: 'Account created successfully!' });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// 2. ROUTE: Login Account
app.post('/api/auth/login', async (req, res) => {
  const { phone, password } = req.body;

  try {
    // Find the user in MongoDB
   // ✅ New query (looks for phone OR email)
const user = await User.findOne({
    $or: [
        { phone: phone },
        { email: phone }
    ]
});
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid phone number/email or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid phone number or password' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Login successful!', 
      user: { name: user.name, phone: user.phone, email: user.email } 
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// Initialize Resend with your API key
const resend = new Resend('re_HyNv9KVt_LCnwKYQXq9T578GhJcsbAJeu');

// ROUTE: Send OTP / Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  const { identifier } = req.body; // This is what the user typed in the input box

  try {
    // 1. Find user ignoring uppercase/lowercase differences
        const user = await User.findOne({
            $or: [
                { email: { $regex: new RegExp(`^${identifier}$`, 'i') } },
                { phone: identifier }
            ]
        });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 2. Generate a 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Save OTP and Expiration (valid for 10 minutes) to the user document
    user.resetOtp = otp;
    user.resetOtpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

   // 4. Send the OTP email using Resend
        await resend.emails.send({
            from: 'onboarding@resend.dev', // DO NOT change this! Resend requires this for free testing accounts
            to: user.email,               // The user's registered email address in the database
            subject: 'DozenTelecom - Your Password Reset OTP',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #4f46e5;">DozenTelecom</h2>
                    <p>Hello,</p>
                    <p>You requested to reset your password. Use the verification code below to proceed:</p>
                    <div style="background: #f1f5f9; padding: 15px; border-radius: 4px; font-size: 24px; font-weight: bold; letter-spacing: 2px; text-align: center; color: #1e293b; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This code will expire in 10 minutes.</p>
                    <p style="color: #64748b; font-size: 12px; margin-top: 20px;">If you didn't request this, you can safely ignore this email.</p>
                </div>
            `
        });

        // 5. Send success response back to the browser frontend
        return res.status(200).json({ success: true, message: "OTP code sent successfully!" });

    } catch (err) {
        console.error("OTP Delivery Error:", err);
        return res.status(500).json({ success: false, message: "Server error handling email OTP delivery" });
    }
});

// 5. ROUTE: Reset Password (Validates OTP and replaces the password)
app.post('/api/auth/reset-password', async (req, res) => {
  const { identifier, otp, newPassword } = req.body;
  try {
    // Find the user where (phone matches OR email matches) AND OTP matches AND OTP is not expired
    const user = await User.findOne({
      $or: [
        { phone: identifier },
        { email: identifier }
      ],
      resetOtp: otp,
      resetOtpExpires: { $gt: Date.now() } // $gt means "greater than" (checks if expiry time is in the future)
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    // Securely hash and save the new password using bcrypt
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Clear out the OTP fields after a successful reset
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;

    // Save the updated user document to MongoDB
    await user.save();

    return res.json({ success: true, message: "Password updated successfully." });

  } catch (err) {
    console.error("Server error resetting user password:", err);
    return res.status(500).json({ success: false, message: "Server error resetting user password." });
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