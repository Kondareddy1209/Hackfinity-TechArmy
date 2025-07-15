// routes/auth.js - Handles user authentication (signup, login, OTP)

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getUsersCollection } = require('../models/user'); // Import user collection access

const JWT_SECRET = process.env.JWT_SECRET;

// Helper function to generate a 6-digit OTP
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // Generates a number between 100000 and 999999
}

// Signup Route
router.post('/signup', async (req, res) => {
    const { username, email, password, gender, mobile, role } = req.body;

    if (!username || !email || !password || !gender || !mobile || !role) {
        return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
    }
    if (role !== 'user' && role !== 'admin') {
        return res.status(400).json({ success: false, message: 'Invalid role. Must be "user" or "admin".' });
    }
    if (!/^[0-9]{10}$/.test(mobile)) {
        return res.status(400).json({ success: false, message: 'Invalid mobile number. Must be 10 digits.' });
    }

    try {
        const usersCollection = getUsersCollection();
        const existingUserByEmail = await usersCollection.findOne({ email });
        if (existingUserByEmail) {
            return res.status(409).json({ success: false, message: 'Email already exists.' });
        }
        const existingUserByUsername = await usersCollection.findOne({ username });
        if (existingUserByUsername) {
            return res.status(409).json({ success: false, message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOtp(); // Generate OTP
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

        const newUser = {
            username,
            email,
            password: hashedPassword,
            gender,
            mobile,
            role,
            otp, // Store OTP
            otpExpiry, // Store OTP expiry
            isVerified: false, // New field: user is not verified until OTP is confirmed
            createdAt: new Date()
        };

        await usersCollection.insertOne(newUser);

        // In a real app, you'd send this OTP via SMS or email service.
        // For this MVP, we'll simulate it by logging and sending to client.
        console.log(`OTP for ${email}: ${otp}`); // Log OTP for testing

        res.status(201).json({
            success: true,
            message: 'User registered successfully! Please check your email for OTP verification.',
            email: email // Send email back to client to pre-fill OTP page if needed
        });

    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
});

// Login Route (remains largely the same, but will also check isVerified status)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Please provide email and password.' });
    }

    try {
        const usersCollection = getUsersCollection();
        const user = await usersCollection.findOne({ email });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        // Check if the user's email is verified
        if (!user.isVerified) {
            // If not verified, resend OTP and instruct user to verify
            const otp = generateOtp();
            const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
            await usersCollection.updateOne(
                { _id: user._id },
                { $set: { otp: otp, otpExpiry: otpExpiry } }
            );
            console.log(`Resent OTP for unverified user ${email}: ${otp}`);
            return res.status(403).json({ success: false, message: 'Please verify your email with the OTP sent to your inbox.', redirectTo: '/verify-otp', email: email });
        }

        const token = jwt.sign(
            { id: user._id.toString(), email: user.email, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ success: true, message: 'Login successful!', token, role: user.role });

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// Resend OTP Route (NEW)
router.post('/send-otp', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required to resend OTP.' });
    }

    try {
        const usersCollection = getUsersCollection();
        const user = await usersCollection.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User with this email not found.' });
        }

        const otp = generateOtp();
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

        await usersCollection.updateOne(
            { _id: user._id },
            { $set: { otp: otp, otpExpiry: otpExpiry } }
        );

        console.log(`Resent OTP for ${email}: ${otp}`); // Log OTP for testing

        res.json({ success: true, message: 'New OTP sent successfully to your email!' });

    } catch (error) {
        console.error("Error resending OTP:", error);
        res.status(500).json({ success: false, message: 'Server error during OTP resend.' });
    }
});

// Verify OTP Route (NEW)
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Email and OTP are required for verification.' });
    }

    try {
        const usersCollection = getUsersCollection();
        const user = await usersCollection.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'Email already verified.' });
        }

        // Check if OTP matches and is not expired
        if (user.otp === otp && user.otpExpiry > new Date()) {
            await usersCollection.updateOne(
                { _id: user._id },
                { $set: { isVerified: true }, $unset: { otp: "", otpExpiry: "" } } // Clear OTP fields after verification
            );
            res.json({ success: true, message: 'Email verified successfully! You can now log in.' });
        } else if (user.otpExpiry <= new Date()) {
            res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid OTP.' });
        }

    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ success: false, message: 'Server error during OTP verification.' });
    }
});

module.exports = router;
