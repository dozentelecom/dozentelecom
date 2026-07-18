const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { Resend } = require('resend');
const axios = require('axios');
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
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    transactionPin: { type: String, required: true },
    resetOtp: { type: String },
    resetOtpExpires: { type: Date },
    // Email Verification
    emailVerified: { type: Boolean, default: false },
    emailVerificationCode: { type: String },
    emailVerificationExpires: { type: Date },
    // NIN/BVN Verification
    ninBvn: { type: String, default: "" },
    ninBvnVerified: { type: Boolean, default: false },
    // Account Number (Generated after NIN/BVN verification)
    accountNumber: { type: String, default: "" },
    // Wallet Info
    walletBalance: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    totalFunded: { type: Number, default: 0 },
    // Fingerprint Registration
    fingerprintRegistered: { type: Boolean, default: false },
    // Transaction History
    transactions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    }],
    createdAt: { type: Date, default: Date.now }
});

// --- TRANSACTION SCHEMA ---
const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['data', 'airtime', 'electricity', 'cableTv', 'educationalPins', 'airtimeToCash', 'funding'], required: true },
    amount: { type: Number, required: true },
    interest: { type: Number, default: 0 },
    finalAmount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    description: { type: String },
    reference: { type: String },
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

// --- INITIALIZE RESEND EMAIL API ---
const resendApiKey = process.env.RESEND_API_KEY;
const resend = new Resend(resendApiKey);

// --- PAYSTACK CONFIG ---
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

// --- VTU API CONFIG ---
const VTU_API_KEY = process.env.VTU_API_KEY;
const VTU_API_URL = process.env.VTU_API_URL;

// ==========================================
// PRICING DATA WITH INTEREST RATES
// ==========================================
const pricingData = {
    data: {
        interestRate: 0.05, // 5%
        mtn: {
            SME: [
                { id: "mtn-sme-1gb", name: "MTN SME 1GB (30 Days)", basePrice: 230 },
                { id: "mtn-sme-2gb", name: "MTN SME 2GB (30 Days)", basePrice: 460 },
                { id: "mtn-sme-5gb", name: "MTN SME 5GB (30 Days)", basePrice: 1150 }
            ]
        },
        airtel: {
            SME: [{ id: "airtel-sme-1gb", name: "Airtel SME 1GB (30 Days)", basePrice: 220 }]
        }
    },
    airtime: {
        interestRate: 0.05, // 5%
    },
    electricity: {
        interestRate: 0.10, // 10%
    },
    cableTv: {
        interestRate: 0.10, // 10%
    },
    airtimeTocash: {
        interestRate: 0.15, // 15%
    },
    educationalPins: {
        interestRate: 0.15, // 15%
    }
};

// --- HELPER FUNCTION TO CALCULATE PRICE WITH INTEREST ---
function calculatePriceWithInterest(basePrice, serviceType) {
    let interestRate = pricingData[serviceType]?.interestRate || 0;
    
    return {
        basePrice: basePrice,
        interest: basePrice * interestRate,
        finalPrice: basePrice + (basePrice * interestRate)
    };
}

// --- HELPER FUNCTION TO GENERATE VERIFICATION CODE ---
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// --- HELPER FUNCTION TO GENERATE ACCOUNT NUMBER ---
function generateAccountNumber() {
    return "9001" + Math.floor(Math.random() * 1000000000).toString().padStart(10, '0');
}

// ==========================================
// 1. ROUTE: Register Account with Email Verification
// ==========================================
app.post('/api/auth/register', async (req, res) => {
    const { name, phone, email, password, pin, transactionPin } = req.body;
    const finalPin = pin || transactionPin;

    if (!phone || !email || !password || !finalPin) {
        return res.status(400).json({ success: false, message: "All fields are required (name, phone, email, password, PIN)." });
    }

    try {
        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [
                { phone: phone },
                { email: email }
            ]
        });

        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Phone number or email is already registered.' });
        }

        // Hash password and PIN
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const hashedPin = await bcrypt.hash(finalPin, salt);

        // Generate email verification code
        const verificationCode = generateVerificationCode();
        const verificationExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

        // Create new user
        const newUser = new User({
            name: name ? name.trim() : "",
            phone: phone ? phone.trim() : "",
            email: email ? email.trim().toLowerCase() : "",
            password: hashedPassword,
            transactionPin: hashedPin,
            emailVerificationCode: verificationCode,
            emailVerificationExpires: verificationExpires
        });

        await newUser.save();

        // Send verification email
        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: email,
            subject: 'DozenTelecom - Email Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #4f46e5; text-align: center;">DozenTelecom</h2>
                    <p>Hello ${name},</p>
                    <p>Welcome to DozenTelecom! Your account has been created successfully.</p>
                    <p>Please verify your email address using the code below:</p>
                    <div style="background: #f1f5f9; padding: 15px; border-radius: 6px; font-size: 26px; font-weight: bold; letter-spacing: 3px; text-align: center; color: #1e293b; margin: 20px 0;">
                        ${verificationCode}
                    </div>
                    <p>This code will expire in <strong>15 minutes</strong>.</p>
                    <p style="color: #64748b; font-size: 12px;">If you did not create this account, please ignore this email.</p>
                </div>
            `
        });

        return res.status(201).json({ 
            success: true, 
            message: "Account created successfully! Please check your email to verify your account.",
            userId: newUser._id
        });

    } catch (err) {
        console.error("Registration Server Error:", err);
        return res.status(500).json({ success: false, message: "Server error during registration" });
    }
});

// ==========================================
// 2. ROUTE: Verify Email Address
// ==========================================
app.post('/api/auth/verify-email', async (req, res) => {
    const { userId, verificationCode } = req.body;

    if (!userId || !verificationCode) {
        return res.status(400).json({ success: false, message: "User ID and verification code are required." });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.emailVerified) {
            return res.status(400).json({ success: false, message: "Email already verified" });
        }

        if (!user.emailVerificationCode || user.emailVerificationCode !== verificationCode) {
            return res.status(400).json({ success: false, message: "Invalid verification code" });
        }

        if (Date.now() > user.emailVerificationExpires) {
            return res.status(400).json({ success: false, message: "Verification code has expired" });
        }

        user.emailVerified = true;
        user.emailVerificationCode = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        return res.status(200).json({ success: true, message: "Email verified successfully!" });

    } catch (err) {
        console.error("Email Verification Error:", err);
        return res.status(500).json({ success: false, message: "Server error during verification" });
    }
});

// ==========================================
// 3. ROUTE: User Login
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ success: false, message: "Identifier and password are required." });
    }

    try {
        const user = await User.findOne({
            $or: [
                { phone: identifier },
                { email: { $regex: new RegExp("^" + identifier + "$", "i") } }
            ]
        });

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid credentials (User not found)" });
        }

        if (!user.emailVerified) {
            return res.status(400).json({ success: false, message: "Please verify your email first before logging in" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid credentials (Incorrect password)" });
        }

        const token = "mock_session_token_" + user._id;

        return res.status(200).json({ 
            success: true, 
            message: "Login successful!", 
            token: token,
            user: { 
                id: user._id, 
                phone: user.phone, 
                email: user.email,
                name: user.name,
                ninBvnVerified: user.ninBvnVerified,
                accountNumber: user.accountNumber,
                walletBalance: user.walletBalance,
                totalSpent: user.totalSpent,
                totalFunded: user.totalFunded
            }
        });

    } catch (err) {
        console.error("Login Server Error:", err);
        return res.status(500).json({ success: false, message: "Internal server error during login" });
    }
});

// ==========================================
// 4. ROUTE: Verify NIN/BVN and Generate Account Number
// ==========================================
app.post('/api/auth/verify-nin-bvn', async (req, res) => {
    const { userId, ninBvn } = req.body;

    if (!userId || !ninBvn) {
        return res.status(400).json({ success: false, message: "User ID and NIN/BVN are required." });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Validate NIN/BVN format (should be 11 digits)
        if (!/^\d{11}$/.test(ninBvn)) {
            return res.status(400).json({ success: false, message: "Invalid NIN/BVN format. Must be 11 digits." });
        }

        // Generate unique account number
        const accountNumber = generateAccountNumber();

        user.ninBvn = ninBvn;
        user.ninBvnVerified = true;
        user.accountNumber = accountNumber;
        await user.save();

        // Send notification email
        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: user.email,
            subject: 'DozenTelecom - NIN/BVN Verified | Account Number Generated',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #10b981; text-align: center;">✓ Verification Successful</h2>
                    <p>Hello ${user.name},</p>
                    <p>Your NIN/BVN has been verified successfully!</p>
                    <p>Your account number for wallet funding:</p>
                    <div style="background: #f1f5f9; padding: 15px; border-radius: 6px; font-size: 20px; font-weight: bold; letter-spacing: 2px; text-align: center; color: #1e293b; margin: 20px 0; font-family: 'Courier New';">
                        ${accountNumber}
                    </div>
                    <p>Use this account number to fund your wallet.</p>
                    <p style="color: #64748b; font-size: 12px;">DozenTelecom Support Team</p>
                </div>
            `
        });

        return res.status(200).json({ 
            success: true, 
            message: "NIN/BVN verified successfully!",
            accountNumber: accountNumber
        });

    } catch (err) {
        console.error("NIN/BVN Verification Error:", err);
        return res.status(500).json({ success: false, message: "Server error during verification" });
    }
});

// ==========================================
// 5. ROUTE: Initialize Paystack Payment (Fund Wallet)
// ==========================================
app.post('/api/wallet/initialize-payment', async (req, res) => {
    const { userId, amount, email } = req.body;

    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ success: false, message: "Valid User ID and amount are required." });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!user.emailVerified) {
            return res.status(400).json({ success: false, message: "Please verify your email first" });
        }

        const fundingFee = amount * 0.10; // 10% funding fee
        const totalAmount = (amount + fundingFee) * 100; // Convert to kobo for Paystack

        // Initialize Paystack transaction
        const paystackResponse = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email: email || user.email,
                amount: totalAmount,
                reference: `DZ_${userId}_${Date.now()}`,
                metadata: {
                    userId: userId,
                    fundingAmount: amount,
                    fundingFee: fundingFee,
                    transactionType: 'wallet_funding'
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!paystackResponse.data.status) {
            return res.status(400).json({ success: false, message: "Failed to initialize payment" });
        }

        return res.status(200).json({
            success: true,
            message: "Payment initialized successfully",
            data: {
                authorizationUrl: paystackResponse.data.data.authorization_url,
                accessCode: paystackResponse.data.data.access_code,
                reference: paystackResponse.data.data.reference,
                amount: amount,
                fundingFee: fundingFee,
                totalDebit: amount + fundingFee
            }
        });

    } catch (err) {
        console.error("Paystack Initialization Error:", err.response?.data || err.message);
        return res.status(500).json({ success: false, message: "Server error initializing payment" });
    }
});

// ==========================================
// 6. ROUTE: Verify Paystack Payment & Credit Wallet
// ==========================================
app.post('/api/wallet/verify-payment', async (req, res) => {
    const { reference } = req.body;

    if (!reference) {
        return res.status(400).json({ success: false, message: "Payment reference is required." });
    }

    try {
        // Verify with Paystack
        const verifyResponse = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
                }
            }
        );

        if (!verifyResponse.data.status || verifyResponse.data.data.status !== 'success') {
            return res.status(400).json({ success: false, message: "Payment verification failed" });
        }

        const { metadata, amount } = verifyResponse.data.data;
        const fundingAmount = metadata.fundingAmount;
        const fundingFee = metadata.fundingFee;

        // Update user wallet
        const user = await User.findById(metadata.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        user.walletBalance += fundingAmount;
        user.totalFunded += fundingAmount;

        // Create transaction record
        const transaction = new Transaction({
            userId: user._id,
            type: 'funding',
            amount: fundingAmount,
            interest: fundingFee,
            finalAmount: fundingAmount + fundingFee,
            status: 'completed',
            description: `Wallet funding via Paystack (10% fee applied)`,
            reference: reference
        });

        user.transactions.push(transaction._id);
        await transaction.save();
        await user.save();

        // Send notification email
        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: user.email,
            subject: 'DozenTelecom - Wallet Funded Successfully ✓',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #10b981; text-align: center;">✓ Wallet Funded</h2>
                    <p>Hello ${user.name},</p>
                    <p>Your wallet has been successfully funded!</p>
                    <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount Funded:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₦${fundingAmount.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Service Fee (10%):</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₦${fundingFee.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px;"><strong>Total Debited:</strong></td>
                            <td style="padding: 8px; text-align: right;"><strong>₦${(fundingAmount + fundingFee).toLocaleString()}</strong></td>
                        </tr>
                    </table>
                    <p>Your new wallet balance: <strong style="color: #4f46e5;">₦${user.walletBalance.toLocaleString()}</strong></p>
                    <p style="color: #64748b; font-size: 12px;">Reference: ${reference}</p>
                </div>
            `
        });

        return res.status(200).json({
            success: true,
            message: "Payment verified and wallet credited successfully!",
            data: {
                fundingAmount: fundingAmount,
                fundingFee: fundingFee,
                newBalance: user.walletBalance,
                reference: reference
            }
        });

    } catch (err) {
        console.error("Payment Verification Error:", err.response?.data || err.message);
        return res.status(500).json({ success: false, message: "Server error verifying payment" });
    }
});

// ==========================================
// 7. ROUTE: Buy Data (with VTU API Integration)
// ==========================================
app.post('/api/services/buy-data', async (req, res) => {
    const { userId, network, planId, phoneNumber, pin } = req.body;

    if (!userId || !network || !planId || !phoneNumber || !pin) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Verify transaction PIN
        const isPinMatch = await bcrypt.compare(pin, user.transactionPin);
        if (!isPinMatch) {
            return res.status(400).json({ success: false, message: "Invalid transaction PIN" });
        }

        // Get pricing
        const basePrice = 230; // Example price
        const pricing = calculatePriceWithInterest(basePrice, 'data');

        if (user.walletBalance < pricing.finalPrice) {
            return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
        }

        // Call VTU API (SmartAPI)
        const vtuResponse = await axios.post(
            `${VTU_API_URL}/topup`,
            {
                network: network,
                phone: phoneNumber,
                plan: planId,
                amount: basePrice
            },
            {
                headers: {
                    'Authorization': `Bearer ${VTU_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (vtuResponse.data.status !== 'success') {
            return res.status(400).json({ success: false, message: "VTU service failed" });
        }

        // Deduct from wallet
        user.walletBalance -= pricing.finalPrice;
        user.totalSpent += pricing.finalPrice;

        // Create transaction record
        const transaction = new Transaction({
            userId: user._id,
            type: 'data',
            amount: basePrice,
            interest: pricing.interest,
            finalAmount: pricing.finalPrice,
            status: 'completed',
            description: `${network} Data - ${planId}`,
            reference: vtuResponse.data.reference || `DZ_${Date.now()}`
        });

        user.transactions.push(transaction._id);
        await transaction.save();
        await user.save();

        // Send notification email
        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: user.email,
            subject: 'DozenTelecom - Data Purchase Successful ✓',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #10b981; text-align: center;">✓ Data Purchased</h2>
                    <p>Hello ${user.name},</p>
                    <p>Your data purchase has been processed successfully!</p>
                    <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Network:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${network}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Plan:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${planId}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₦${pricing.finalPrice.toLocaleString()}</td>
                        </tr>
                    </table>
                    <p>Remaining balance: <strong style="color: #4f46e5;">₦${user.walletBalance.toLocaleString()}</strong></p>
                </div>
            `
        });

        return res.status(200).json({
            success: true,
            message: "Data purchased successfully!",
            data: {
                basePrice: pricing.basePrice,
                interest: pricing.interest,
                finalPrice: pricing.finalPrice,
                newBalance: user.walletBalance,
                reference: vtuResponse.data.reference
            }
        });

    } catch (err) {
        console.error("Data Purchase Error:", err.response?.data || err.message);
        return res.status(500).json({ success: false, message: "Server error processing data purchase" });
    }
});

// ==========================================
// 8. ROUTE: Buy Airtime
// ==========================================
app.post('/api/services/buy-airtime', async (req, res) => {
    const { userId, network, amount, phoneNumber, pin } = req.body;

    if (!userId || !network || !amount || !phoneNumber || !pin) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const isPinMatch = await bcrypt.compare(pin, user.transactionPin);
        if (!isPinMatch) {
            return res.status(400).json({ success: false, message: "Invalid transaction PIN" });
        }

        const pricing = calculatePriceWithInterest(amount, 'airtime');

        if (user.walletBalance < pricing.finalPrice) {
            return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
        }

        // Call VTU API for airtime
        const vtuResponse = await axios.post(
            `${VTU_API_URL}/airtime`,
            {
                network: network,
                phone: phoneNumber,
                amount: amount
            },
            {
                headers: {
                    'Authorization': `Bearer ${VTU_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (vtuResponse.data.status !== 'success') {
            return res.status(400).json({ success: false, message: "VTU service failed" });
        }

        user.walletBalance -= pricing.finalPrice;
        user.totalSpent += pricing.finalPrice;

        const transaction = new Transaction({
            userId: user._id,
            type: 'airtime',
            amount: amount,
            interest: pricing.interest,
            finalAmount: pricing.finalPrice,
            status: 'completed',
            description: `${network} Airtime - ���${amount}`,
            reference: vtuResponse.data.reference || `DZ_${Date.now()}`
        });

        user.transactions.push(transaction._id);
        await transaction.save();
        await user.save();

        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: user.email,
            subject: 'DozenTelecom - Airtime Purchase Successful ✓',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #10b981; text-align: center;">✓ Airtime Purchased</h2>
                    <p>Hello ${user.name},</p>
                    <p>Your airtime purchase has been processed successfully!</p>
                    <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Network:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${network}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₦${amount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px;"><strong>Total Paid:</strong></td>
                            <td style="padding: 8px; text-align: right;">₦${pricing.finalPrice.toLocaleString()}</td>
                        </tr>
                    </table>
                    <p>Remaining balance: <strong style="color: #4f46e5;">₦${user.walletBalance.toLocaleString()}</strong></p>
                </div>
            `
        });

        return res.status(200).json({
            success: true,
            message: "Airtime purchased successfully!",
            data: {
                amount: amount,
                interest: pricing.interest,
                finalPrice: pricing.finalPrice,
                newBalance: user.walletBalance
            }
        });

    } catch (err) {
        console.error("Airtime Purchase Error:", err.response?.data || err.message);
        return res.status(500).json({ success: false, message: "Server error processing airtime purchase" });
    }
});

// ==========================================
// 9. ROUTE: Change Transaction PIN
// ==========================================
app.post('/api/auth/change-transaction-pin', async (req, res) => {
    const { userId, oldPin, newPin } = req.body;

    if (!userId || !oldPin || !newPin) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const isPinMatch = await bcrypt.compare(oldPin, user.transactionPin);
        if (!isPinMatch) {
            return res.status(400).json({ success: false, message: "Current PIN is incorrect." });
        }

        const salt = await bcrypt.genSalt(10);
        user.transactionPin = await bcrypt.hash(newPin, salt);
        await user.save();

        return res.status(200).json({ success: true, message: "Transaction PIN changed successfully!" });

    } catch (err) {
        console.error("Change PIN Error:", err);
        return res.status(500).json({ success: false, message: "Server error changing PIN" });
    }
});

// ==========================================
// 10. ROUTE: Reset Transaction PIN (via OTP)
// ==========================================
app.post('/api/auth/reset-transaction-pin', async (req, res) => {
    const { identifier, otp, newPin } = req.body;

    if (!identifier || !otp || !newPin) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

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

        if (!user.resetOtp || user.resetOtp !== otp) {
            return res.status(400).json({ success: false, message: "Invalid OTP code." });
        }

        if (Date.now() > user.resetOtpExpires) {
            return res.status(400).json({ success: false, message: "OTP code has expired." });
        }

        const salt = await bcrypt.genSalt(10);
        user.transactionPin = await bcrypt.hash(newPin, salt);
        user.resetOtp = undefined;
        user.resetOtpExpires = undefined;
        await user.save();

        return res.status(200).json({ success: true, message: "Transaction PIN reset successfully!" });

    } catch (err) {
        console.error("Reset PIN Error:", err);
        return res.status(500).json({ success: false, message: "Server error resetting PIN" });
    }
});

// ==========================================
// 11. ROUTE: Change Password
// ==========================================
app.post('/api/auth/change-password', async (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const isPasswordMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({ success: false, message: "Current password is incorrect." });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        return res.status(200).json({ success: true, message: "Password changed successfully!" });

    } catch (err) {
        console.error("Change Password Error:", err);
        return res.status(500).json({ success: false, message: "Server error changing password" });
    }
});

// ==========================================
// 12. ROUTE: Register Fingerprint
// ==========================================
app.post('/api/auth/register-fingerprint', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: "User ID is required." });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        user.fingerprintRegistered = true;
        await user.save();

        return res.status(200).json({ success: true, message: "Fingerprint registered successfully!" });

    } catch (err) {
        console.error("Fingerprint Registration Error:", err);
        return res.status(500).json({ success: false, message: "Server error registering fingerprint" });
    }
});

// ==========================================
// 13. ROUTE: Send OTP (Forgot Password)
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
            return res.status(404).json({ success: false, message: "No registered account found." });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetOtp = otp;
        user.resetOtpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: user.email,
            subject: 'DozenTelecom - Reset Password OTP',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #4f46e5; text-align: center;">DozenTelecom</h2>
                    <p>Hello,</p>
                    <p>We received a request to reset your password. Use this verification code:</p>
                    <div style="background: #f1f5f9; padding: 15px; border-radius: 6px; font-size: 26px; font-weight: bold; letter-spacing: 3px; text-align: center; color: #1e293b; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This OTP will expire in <strong>10 minutes</strong>.</p>
                </div>
            `
        });

        return res.status(200).json({ success: true, message: "OTP sent successfully!" });

    } catch (err) {
        console.error("OTP Delivery Error:", err);
        return res.status(500).json({ success: false, message: "Server error sending OTP" });
    }
});

// ==========================================
// 14. ROUTE: Reset Password (Using OTP)
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

        if (!user.resetOtp || user.resetOtp !== otp) {
            return res.status(400).json({ success: false, message: "Invalid OTP code." });
        }

        if (Date.now() > user.resetOtpExpires) {
            return res.status(400).json({ success: false, message: "OTP expired." });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetOtp = undefined;
        user.resetOtpExpires = undefined;
        await user.save();

        return res.status(200).json({ success: true, message: "Password reset successfully!" });

    } catch (err) {
        console.error("Password Reset Error:", err);
        return res.status(500).json({ success: false, message: "Server error resetting password" });
    }
});

// ==========================================
// 15. ROUTE: Get User Profile
// ==========================================
app.get('/api/user/profile/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId)
            .select('-password -transactionPin -emailVerificationCode -resetOtp')
            .populate('transactions');

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        return res.status(200).json({ success: true, data: user });

    } catch (err) {
        console.error("Get Profile Error:", err);
        return res.status(500).json({ success: false, message: "Server error fetching profile" });
    }
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

// --- PORT BINDING ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running successfully on port ${PORT}`);
});
