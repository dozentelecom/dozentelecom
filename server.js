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
    transactionPin: { type: String, required: true },
    resetOtp: { type: String },
    resetOtpExpires: { type: Date },
    // NIN/BVN Verification
    ninBvn: { type: String, default: "" },
    ninBvnVerified: { type: Boolean, default: false },
    // Account Number (Generated after NIN/BVN verification)
    accountNumber: { type: String, default: "" },
    // Wallet Info
    walletBalance: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    // Fingerprint Registration
    fingerprintRegistered: { type: Boolean, default: false }
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
const resendApiKey = process.env.RESEND_API_KEY || 're_HyNv9KVt_LCnwKYQxq9T578GhJcsbAJeu';
const resend = new Resend(resendApiKey);

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
        plans: [
            { id: "mtn-airtime", name: "MTN Airtime", basePrice: 100 },
            { id: "airtel-airtime", name: "Airtel Airtime", basePrice: 100 }
        ]
    },
    electricity: {
        interestRate: 0.10, // 10%
        providers: [
            { id: "disco-1", name: "EKEDC", basePrice: 5000 },
            { id: "disco-2", name: "IKEDC", basePrice: 5000 }
        ]
    },
    cableTv: {
        interestRate: 0.10, // 10%
        providers: [
            { id: "dstv", name: "DStv", basePrice: 2500 },
            { id: "gotv", name: "GOtv", basePrice: 1500 }
        ]
    },
    airtimeTocash: {
        interestRate: 0.15, // 15%
        description: "Convert airtime to cash"
    },
    educationalPins: {
        interestRate: 0.15, // 15%
        providers: [
            { id: "jamb", name: "JAMB ePIN", basePrice: 5500 },
            { id: "waec", name: "WAEC ePIN", basePrice: 3500 }
        ]
    }
};

// --- HELPER FUNCTION TO CALCULATE PRICE WITH INTEREST ---
function calculatePriceWithInterest(basePrice, serviceType) {
    let interestRate = 0;
    
    if (serviceType === 'data' || serviceType === 'airtime') {
        interestRate = pricingData.data.interestRate;
    } else if (serviceType === 'electricity') {
        interestRate = pricingData.electricity.interestRate;
    } else if (serviceType === 'cableTv') {
        interestRate = pricingData.cableTv.interestRate;
    } else if (serviceType === 'airtimeToCash' || serviceType === 'educationalPins') {
        interestRate = 0.15;
    }
    
    return {
        basePrice: basePrice,
        interest: basePrice * interestRate,
        finalPrice: basePrice + (basePrice * interestRate)
    };
}

// ==========================================
// 1. ROUTE: Register Account
// ==========================================
app.post('/api/auth/register', async (req, res) => {
    const { name, phone, password, pin, transactionPin, email } = req.body;
    const finalPin = pin || transactionPin;

    if (!phone || !password || !finalPin) {
        return res.status(400).json({ success: false, message: "Missing required fields: phone, password, and transaction PIN are required." });
    }

    try {
        const user = await User.findOne({
            $or: [
                { phone: phone },
                ...(email ? [{ email: email }] : [])
            ]
        });

        if (user) {
            return res.status(400).json({ success: false, message: 'Phone number or email is already registered.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const hashedPin = await bcrypt.hash(finalPin, salt);

        const newUser = new User({
            name: name ? name.trim() : "",
            phone: phone ? phone.trim() : "",
            email: email ? email.trim().toLowerCase() : "",
            password: hashedPassword,
            transactionPin: hashedPin
        });

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

    if (!identifier || !password) {
        return res.status(400).json({ success: false, message: "Missing required fields: identifier and password are required." });
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
                ninBvnVerified: user.ninBvnVerified,
                accountNumber: user.accountNumber,
                walletBalance: user.walletBalance
            }
        });

    } catch (err) {
        console.error("Login Server Error:", err);
        return res.status(500).json({ success: false, message: "Internal server error during login" });
    }
});

// ==========================================
// 3. ROUTE: Verify NIN/BVN and Generate Account Number
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

        // In production, you would call a real NIN/BVN verification API
        // For now, we'll mock it
        if (ninBvn.length < 11) {
            return res.status(400).json({ success: false, message: "Invalid NIN/BVN format" });
        }

        // Generate unique account number (mock)
        const accountNumber = "9001" + Math.random().toString().substring(2, 12);

        user.ninBvn = ninBvn;
        user.ninBvnVerified = true;
        user.accountNumber = accountNumber;
        await user.save();

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
// 4. ROUTE: Fund Wallet (10% Funding Fee)
// ==========================================
app.post('/api/wallet/fund', async (req, res) => {
    const { userId, amount } = req.body;

    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ success: false, message: "Valid User ID and amount are required." });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!user.ninBvnVerified || !user.accountNumber) {
            return res.status(400).json({ 
                success: false, 
                message: "Please verify your NIN/BVN first to generate your account number before funding." 
            });
        }

        const fundingFee = amount * 0.10; // 10% funding fee
        const totalDebit = amount + fundingFee;
        const amountCredited = amount;

        user.walletBalance += amountCredited;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Wallet funded successfully!",
            fundingAmount: amount,
            fundingFee: fundingFee,
            totalDebit: totalDebit,
            amountCredited: amountCredited,
            newBalance: user.walletBalance
        });

    } catch (err) {
        console.error("Wallet Funding Error:", err);
        return res.status(500).json({ success: false, message: "Server error during wallet funding" });
    }
});

// ==========================================
// 5. ROUTE: Get Pricing with Interest
// ==========================================
app.get('/api/pricing/:serviceType', async (req, res) => {
    const { serviceType } = req.params;

    try {
        const pricing = pricingData[serviceType];
        if (!pricing) {
            return res.status(404).json({ success: false, message: "Service type not found" });
        }

        return res.status(200).json({ success: true, data: pricing });

    } catch (err) {
        console.error("Pricing Error:", err);
        return res.status(500).json({ success: false, message: "Server error fetching pricing" });
    }
});

// ==========================================
// 6. ROUTE: Change Transaction PIN
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
// 7. ROUTE: Reset Transaction PIN (via OTP)
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
// 8. ROUTE: Change Password
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
// 9. ROUTE: Register Fingerprint
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
// 10. ROUTE: Send OTP (Forgot Password)
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

        const targetEmail = user.email || identifier;
        if (!targetEmail || !targetEmail.includes('@')) {
            return res.status(400).json({ success: false, message: "An OTP can only be dispatched to a valid email address." });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        user.resetOtp = otp;
        user.resetOtpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

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
                    <p style="color: #64748b; font-size: 12px;">DozenTelecom Support Team</p>
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
// 11. ROUTE: Reset Password (Using OTP)
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
            return res.status(400).json({ success: false, message: "OTP code has expired." });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

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
