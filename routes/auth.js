// routes/auth.js - Handles user authentication (signup, login, OTP)

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { ObjectId } = require('mongodb'); // Import ObjectId for user ID reference
const { getUsersCollection } = require('../models/user'); // Import user collection access
const { getOtpCollection } = require('../models/otp');   // Import OTP collection access (NEW)

const JWT_SECRET = process.env.JWT_SECRET;

// --- Nodemailer Transporter Setup for Gmail ---
// Ensure GMAIL_USER and GMAIL_PASS are set in your .env file.
// If you have 2-Factor Authentication enabled, use an App Password.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

// Helper function to generate a 6-digit OTP
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to send OTP email
async function sendOtpEmail(toEmail, otp) {
    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: toEmail,
        subject: 'Your Digital Catalog Agent OTP',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #4CAF50;">Hello!</h2>
                <p>Thank you for signing up for the Digital Catalog Agent. To complete your registration, please use the following One-Time Password (OTP):</p>
                <h3 style="color: #007bff; font-size: 24px; text-align: center; background-color: #f0f0f0; padding: 15px; border-radius: 8px; letter-spacing: 5px;">${otp}</h3>
                <p>This OTP is valid for 5 minutes. Please do not share it with anyone.</p>
                <p>If you did not request this, please ignore this email.</p>
                <p>Best regards,<br>The Digital Catalog Agent Team</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP sent to ${toEmail}: ${otp}`);
        return true;
    } catch (error) {
        console.error(`Error sending OTP email to ${toEmail}:`, error);
        return false;
    }
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
        const otpCollection = getOtpCollection(); // Get OTP collection

        const existingUserByEmail = await usersCollection.findOne({ email });
        if (existingUserByEmail) {
            return res.status(409).json({ success: false, message: 'Email already exists.' });
        }
        const existingUserByUsername = await usersCollection.findOne({ username });
        if (existingUserByUsername) {
            return res.status(409).json({ success: false, message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOtp();
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

        const newUser = {
            username,
            email,
            password: hashedPassword,
            gender,
            mobile,
            role,
            isVerified: false, // User is not verified initially
            createdAt: new Date()
        };

        const userInsertResult = await usersCollection.insertOne(newUser);
        const userId = userInsertResult.insertedId; // Get the new user's ID

        // Store OTP details in the separate otp_verifications collection
        const otpRecord = {
            userId: userId, // Reference to the user
            email: email,
            otp: otp,
            otpExpiry: otpExpiry,
            createdAt: new Date()
        };
        await otpCollection.insertOne(otpRecord);

        // Send OTP email
        const emailSent = await sendOtpEmail(email, otp);
        if (!emailSent) {
            console.warn(`Failed to send OTP email to ${email} during signup. User registered but not verified.`);
            return res.status(202).json({ // 202 Accepted, but not fully processed (email failed)
                success: true,
                message: 'User registered, but failed to send OTP email. Please try resending OTP from the verification page.',
                email: email,
                redirectTo: '/verify-otp'
            });
        }

        res.status(201).json({
            success: true,
            message: 'User registered successfully! Please check your email for OTP verification.',
            email: email,
            redirectTo: '/verify-otp'
        });

    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
});

// Login Route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Please provide email and password.' });
    }

    try {
        const usersCollection = getUsersCollection();
        const otpCollection = getOtpCollection(); // Get OTP collection

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
            // If not verified, generate and send a new OTP, and update the OTP collection
            const otp = generateOtp();
            const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

            // Update or insert OTP record for the user
            await otpCollection.updateOne(
                { userId: user._id }, // Find by userId
                { $set: { email: user.email, otp: otp, otpExpiry: otpExpiry, createdAt: new Date() } },
                { upsert: true } // Create if not exists, update if exists
            );

            const emailSent = await sendOtpEmail(email, otp);
            if (!emailSent) {
                console.warn(`Failed to resend OTP email to ${email} for unverified user.`);
                return res.status(403).json({
                    success: false,
                    message: 'Your email is not verified. Failed to resend OTP. Please try again or contact support.',
                    redirectTo: '/verify-otp',
                    email: email
                });
            }

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

// Resend OTP Route
router.post('/send-otp', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required to resend OTP.' });
    }

    try {
        const usersCollection = getUsersCollection();
        const otpCollection = getOtpCollection(); // Get OTP collection

        const user = await usersCollection.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User with this email not found.' });
        }

        // Check if user is already verified
        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'Email is already verified. Please log in.' });
        }

        const otp = generateOtp();
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

        // Update or insert OTP record for the user
        await otpCollection.updateOne(
            { userId: user._id },
            { $set: { email: user.email, otp: otp, otpExpiry: otpExpiry, createdAt: new Date() } },
            { upsert: true }
        );

        const emailSent = await sendOtpEmail(email, otp);
        if (!emailSent) {
            console.warn(`Failed to send OTP email to ${email} during resend.`);
            return res.status(500).json({ success: false, message: 'Failed to send new OTP. Please try again.' });
        }

        res.json({ success: true, message: 'New OTP sent successfully to your email!' });

    } catch (error) {
        console.error("Error resending OTP:", error);
        res.status(500).json({ success: false, message: 'Server error during OTP resend.' });
    }
});

// Verify OTP Route
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Email and OTP are required for verification.' });
    }

    try {
        const usersCollection = getUsersCollection();
        const otpCollection = getOtpCollection(); // Get OTP collection

        const user = await usersCollection.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'Email already verified.' });
        }

        // Find the OTP record for this user
        const otpRecord = await otpCollection.findOne({ userId: user._id, email: email });

        if (!otpRecord) {
            return res.status(400).json({ success: false, message: 'No OTP found for this email. Please request a new one.' });
        }

        // Check if OTP matches and is not expired
        if (otpRecord.otp === otp && otpRecord.otpExpiry > new Date()) {
            // Mark user as verified in the users collection
            await usersCollection.updateOne(
                { _id: user._id },
                { $set: { isVerified: true } }
            );
            // Delete the OTP record from the otp_verifications collection
            await otpCollection.deleteOne({ _id: otpRecord._id });

            // Generate a JWT token for the now verified user
            const token = jwt.sign(
                { id: user._id.toString(), email: user.email, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Send back success, token, and role for direct dashboard redirection
            res.json({ success: true, message: 'Email verified successfully! Redirecting to dashboard.', token, role: user.role });
        } else if (otpRecord.otpExpiry <= new Date()) {
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
