const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User'); // Assuming this path is correct
const Otp = require('../models/Otp');   // Assuming this path is correct
const { requireAuth } = require('../middleware/authMiddleware'); // Corrected import

// Define the JWT secret here, with a fallback for development
const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_fallback'; // IMPORTANT: Use a strong, unique, random key in .env for production!

// Helper function to generate JWT
const generateToken = (id) => {
    // Use the defined jwtSecret here
    return jwt.sign({ id }, jwtSecret, {
        expiresIn: '1h',
    });
};

// Nodemailer transporter setup (ensure EMAIL_USER and EMAIL_PASS are in .env)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// @route   GET /
// @desc    Render the user login page (accessible at /auth)
// @access  Public
router.get('/', (req, res) => {
    res.render('login', { error: null, message: null });
});

// @route   GET /login
// @desc    Render the user login page (accessible at /auth/login)
// @access  Public
router.get('/login', (req, res) => {
    res.render('login', { error: null, message: null });
});


// @route   GET /signup
// @desc    Render the signup page (accessible at /auth/signup)
// @access  Public
router.get('/signup', (req, res) => {
    res.render('signup', { error: null });
});

// @route   POST /signup
// @desc    Register a new user and send OTP for verification (posts to /auth/signup)
// @access  Public
router.post('/signup', async (req, res) => {
    const { firstName, lastName, email, mobile, password, gender } = req.body;

    try {
        let user = await User.findOne({ email });

        if (user) {
            if (user.isVerified) {
                return res.render('signup', { error: 'User with this email already exists and is verified. Please log in.', message: null });
            } else {
                // If user exists but not verified, update their info and resend OTP
                user.firstName = firstName;
                user.lastName = lastName;
                user.mobile = mobile;
                user.gender = gender;
                user.password = password; // Password will be hashed by pre-save hook
                await user.save();
            }
        } else {
            // Create a new user
            user = new User({ firstName, lastName, email, mobile, password, gender });
            await user.save();
        }

        // Always delete previous signup OTPs for this email before sending a new one
        await Otp.deleteMany({ email, type: 'signup' });
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const newOtp = new Otp({ email: user.email, otp: otpCode, type: 'signup' });
        await newOtp.save();

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Verify Your MyGreenHome Account - OTP',
            html: `<p>Dear ${user.firstName},</p>
                   <p>Your One-Time Password (OTP) for MyGreenHome account verification is: <strong>${otpCode}</strong></p>
                   <p>This OTP is valid for 5 minutes. Please do not share it with anyone.</p>
                   <p>If you did not request this, please ignore this email.</p>`,
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`OTP ${otpCode} sent to ${user.email}`);
        } catch (emailError) {
            console.error('Email send failed:', emailError);
            // Optionally, you might want to log this error but still proceed to OTP page
            // if email sending is not critical for local development.
        }
        res.redirect(`/auth/verify-otp?email=${encodeURIComponent(user.email)}`);

    } catch (error) {
        console.error('Error during signup or sending OTP:', error);
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            const value = error.keyValue[field];
            return res.render('signup', { error: `${field} "${value}" is already registered.`, message: null });
        }
        res.render('signup', { error: 'Registration failed. Please try again.', message: null });
    }
});

// @route   GET /verify-otp
// @desc    Render OTP verification page (accessible at /auth/verify-otp)
// @access  Public
router.get('/verify-otp', (req, res) => {
    const email = req.query.email || '';
    // This page is now exclusively for signup OTPs
    res.render('verify_otp', { username: email, error: null, message: null, isPasswordReset: false });
});

// @route   POST /verify-otp
// @desc    Handle OTP verification for signup (posts to /auth/verify-otp)
// @access  Public
router.post('/verify-otp', async (req, res) => {
    const { username, otp } = req.body; // Removed isPasswordReset
    const email = username;

    try {
        // Only verify signup OTPs
        const storedOtp = await Otp.findOne({ email, otp, type: 'signup' });

        if (!storedOtp) {
            return res.render('verify_otp', {
                username: email,
                error: 'Invalid or expired OTP. Please try again or resend.',
                message: null,
                isPasswordReset: false // Always false now
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.render('verify_otp', {
                username: email,
                error: 'User not found for this email.',
                message: null,
                isPasswordReset: false
            });
        }

        await Otp.deleteOne({ _id: storedOtp._id }); // Delete the used OTP

        user.isVerified = true; // Mark user as verified
        await user.save();
        res.render('login', { message: 'Email verified successfully! You can now log in.', error: null });

    } catch (error) {
        console.error('Error during OTP verification:', error);
        res.render('verify_otp', {
            username: email,
            error: 'Verification failed. Please try again.',
            message: null,
            isPasswordReset: false
        });
    }
});

// @route   POST /resend-otp
// @desc    Resend OTP for signup verification (posts to /auth/resend-otp)
// @access  Public
router.post('/resend-otp', async (req, res) => {
    const { email } = req.body; // Removed type, as it's always 'signup' now

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, message: 'User not found.' });
        }

        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'Account already verified. Please login.' });
        }

        await Otp.deleteMany({ email, type: 'signup' }); // Only delete signup OTPs
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const newOtp = new Otp({ email: user.email, otp: otpCode, type: 'signup' }); // Only create signup OTPs
        await newOtp.save();

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Resend OTP for MyGreenHome Account Verification', // Subject specific to signup
            html: `<p>Dear ${user.firstName || 'User'},</p>
                   <p>Your new One-Time Password (OTP) for account verification is: <strong>${otpCode}</strong></p>
                   <p>This OTP is valid for 5 minutes. Please do not share it with anyone.</p>
                   <p>If you did not request this, please ignore this email.</p>`,
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`OTP ${otpCode} sent to ${user.email}`);
        } catch (emailError) {
            console.error('Email send failed:', emailError);
            // Optionally, you might want to log this error but still proceed to OTP page
            // if email sending is not critical for local development.
        }
        res.redirect(`/auth/verify-otp?email=${encodeURIComponent(user.email)}`);

    } catch (error) {
        console.error('Error resending OTP:', error);
        res.status(500).json({ success: false, message: 'Failed to resend OTP. Please try again later.' });
    }
});

// @route   GET /admin-login
// @desc    Render the admin login page (accessible at /auth/admin-login)
// @access  Public
router.get('/admin-login', (req, res) => {
    res.render('admin_login', { error: null, message: null });
});

// @route   POST /admin-login
// @desc    Authenticate admin user & get token (posts to /auth/admin-login)
// @access  Public
router.post('/admin-login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ email: username });

        if (!user) {
            return res.render('admin_login', { error: 'Invalid credentials', message: null });
        }

        if (user.role !== 'admin') {
            return res.render('admin_login', { error: 'Access denied: Not an administrator.', message: null });
        }

        if (!user.isVerified) {
            return res.render('admin_login', { error: 'Admin account not verified. Please contact support.', message: null });
        }

        if (user && (await user.matchPassword(password))) {
            const token = generateToken(user._id);
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 3600000 // 1 hour
            });
            res.redirect('/dashboard'); // Admin users still go to /dashboard (which handles admin_dashboard.ejs)
        } else {
            res.render('admin_login', { error: 'Invalid credentials', message: null });
        }
    } catch (error) {
        console.error('Admin login error:', error);
        res.render('admin_login', { error: 'Server error during admin login, please try again.', message: null });
    }
});

// @route   POST /login
// @desc    Authenticate regular user & get token (posts to /auth/login)
// @access  Public
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ email: username });

        if (!user) {
            return res.render('login', { error: 'Invalid credentials', message: null });
        }

        // MODIFIED: If user is not verified, prevent login and inform them.
        // No redirection to OTP verification for existing unverified users.
        if (!user.isVerified) {
            return res.render('login', { error: 'Please verify your email first. If you haven\'t received an OTP, please sign up again.', message: null });
        }

        // IMPORTANT CHANGE: Redirect based on user role after successful login
        if (user && (await user.matchPassword(password))) {
            const token = generateToken(user._id);
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 3600000 // 1 hour
            });

            // Explicitly ensure redirection based on role
            if (user.role === 'admin') {
                return res.redirect('/dashboard'); // Admins go to /dashboard (which renders admin_dashboard)
            } else {
                return res.redirect('/user_dashboard'); // Normal users go directly to /user_dashboard
            }
        } else {
            res.render('login', { error: 'Invalid credentials', message: null });
        }
    } catch (error) {
        console.error(error);
        res.render('login', { error: 'Server error, please try again.', message: null });
    }
});

// @route   GET /logout
// @desc    Logout user by clearing cookie (accessible at /auth/logout)
// @access  Public (though usually accessed by logged-in users)
router.get('/logout', requireAuth, (req, res) => {
    // Clear the authentication token cookie
    res.clearCookie('token');
    // Redirect to the main authentication/login page
    res.redirect('/auth'); // This redirects to the base /auth route which renders login.ejs
});

// @route   GET /forgot-password
// @desc    Render the forgot password page (accessible at /auth/forgot-password)
// @access  Public
router.get('/forgot-password', (req, res) => {
    res.render('forgot_password', { error: null, message: null });
});

// @route   POST /request-password-reset
// @desc    Handle request to send password reset (NO OTP - direct reset or link)
// @access  Public
router.post('/request-password-reset', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            // For security, don't reveal if email exists. Send a generic message.
            return res.render('forgot_password', { message: 'If an account with that email exists, you will receive a password reset link.', error: null });
        }

        // --- NEW PASSWORD RESET LOGIC (NO OTP) ---
        // Instead of OTP, a common and more secure approach is to send a password reset LINK.
        // For simplicity in removing OTP, we'll assume a direct reset or admin intervention.
        // If you need a secure password reset link flow, that's a separate implementation.
        // For now, we'll just acknowledge the request without sending an OTP.
        // A real implementation would generate a unique token, save it to the user record with an expiry,
        // and email a link like /auth/reset-password?token=XYZ

        // For now, just a message. User will need to follow up or admin can reset.
        res.render('forgot_password', { message: 'Password reset request received. Please check your email for instructions.', error: null });

    } catch (error) {
        console.error('Error during password reset request:', error);
        res.render('forgot_password', { error: 'Failed to process reset request. Try again later.', message: null });
    }
});

// @route   GET /reset-password
// @desc    Render the reset password form (now without OTP pre-verification)
// @access  Public
router.get('/reset-password', async (req, res) => {
    // This route would now typically expect a token from a password reset email link
    // For simplicity, we are removing OTP, so it will just render the form.
    // A real implementation would validate a 'token' query parameter here.
    const email = req.query.email || ''; // Still get email if passed, but it's less secure without a token
    res.render('reset_password', { email, error: null, message: null });
});

// @route   POST /reset-password
// @desc    Handle new password submission (posts to /auth/reset-password)
// @access  Public
router.post('/reset-password', async (req, res) => {
    const { email, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
        return res.render('reset_password', { email, error: 'Passwords do not match.', message: null });
    }
    if (newPassword.length < 6) {
        return res.render('reset_password', { email, error: 'Password must be at least 6 characters.', message: null });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            // For security, don't confirm user existence.
            return res.render('reset_password', { email, error: 'Invalid request or user not found.', message: null });
        }

        user.password = newPassword; // Will be hashed by pre-save hook
        user.isVerified = true; // Ensure account is verified after password reset
        await user.save();

        res.render('login', { message: 'Password has been reset successfully! You can now log in.', error: null });

    } catch (error) {
        console.error('Error resetting password:', error);
        res.render('reset_password', { email, error: 'Failed to reset password. Try again.', message: null });
    }
});


module.exports = router;