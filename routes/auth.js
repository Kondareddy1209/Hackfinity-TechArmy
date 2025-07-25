const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library'); // NEW: Import Google OAuth2Client

const User = require('../models/User');
const Otp = require('../models/Otp');
const { requireAuth } = require('../middleware/authMiddleware');

const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_fallback';
const jwtExpiresIn = '1h';
const createToken = (id) => {
    return jwt.sign({ id }, jwtSecret, {
        expiresIn: jwtExpiresIn
    });
};

// NEW: Initialize Google OAuth2Client with your client ID
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

router.get('/', (req, res) => {
    res.render('login', { error: null, message: null });
});

router.get('/login', (req, res) => {
    res.render('login', { error: null, message: null });
});

router.get('/signup', (req, res) => {
    res.render('signup', { error: null, message: null }); // Pass message as well for consistent display
});

// NEW: Google Sign-in/Sign-up handler
router.post('/google', async (req, res) => {
    const { id_token } = req.body;

    if (!id_token) {
        return res.status(400).json({ success: false, error: 'Google ID token missing.' });
    }

    try {
        // Verify the ID token with Google
        const ticket = await googleClient.verifyIdToken({
            idToken: id_token,
            audience: process.env.GOOGLE_CLIENT_ID, // Specify the CLIENT_ID of the app that accesses the backend
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, given_name: firstName, family_name: lastName, picture: profilePicture } = payload;

        console.log(`Google authenticated: ${email}, Google ID: ${googleId}`);

        let user;
        // 1. Try to find user by googleId
        user = await User.findOne({ googleId });

        if (user) {
            // User found via Google ID - Existing Google account login
            console.log(`User ${email} found by Google ID. Logging in.`);
        } else {
            // 2. Try to find user by email (might be a traditional user connecting Google)
            user = await User.findOne({ email });

            if (user) {
                // User found by email, but no googleId (was a traditional signup)
                // Link Google account to existing user
                if (user.googleId) {
                    // This email is already linked to a different Google account.
                    // This case is tricky: two different Google accounts or user email changed on Google?
                    // For simplicity, we assume one email one Google account link
                    return res.status(409).json({ success: false, error: 'This email is already registered with a different Google account. Please use Google Sign-in or log in directly.' });
                }
                user.googleId = googleId; // Link Google ID
                user.isVerified = true; // Google verified the email
                await user.save();
                console.log(`Existing user ${email} linked with Google ID.`);
            } else {
                // 3. No user found - New Google signup
                // Create a new user entry
                user = new User({
                    firstName: firstName || 'Google User', // Fallback name
                    lastName: lastName || '',
                    email: email,
                    googleId: googleId,
                    isVerified: true, // Google email is already verified
                    profilePicture: profilePicture || '/images/default_image.png',
                    // Password and mobile are not required for Google signup
                    password: 'google_oauth_no_password', // Placeholder. Will not be saved if required: function() is used.
                    mobile: '0000000000', // Placeholder or make optional in schema
                    gender: 'Other' // Placeholder or make optional in schema
                });
                await user.save();
                console.log(`New user ${email} created via Google signup.`);
            }
        }

        // Successful login/signup, create JWT and set cookie
        const token = createToken(user._id);
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 1000 * 60 * 60, // 1 hour
            path: '/',
            sameSite: 'Lax'
        });

        // Redirect based on role or to a default dashboard
        const redirectUrl = user.role === 'admin' ? '/dashboard' : '/user_dashboard';
        res.status(200).json({ success: true, message: 'Google sign-in successful', redirectUrl });

    } catch (error) {
        console.error('Error during Google ID token verification or user operation:', error);
        if (error.code === 11000) { // Duplicate key error (e.g., email or googleId already exists)
            return res.status(409).json({ success: false, error: 'Account already exists. Please login with your existing method or contact support.' });
        }
        res.status(500).json({ success: false, error: 'Google sign-in failed due to a server error. Please try again.' });
    }
});


router.post('/signup', async (req, res) => {
    const { firstName, lastName, email, mobile, password, gender } = req.body;

    try {
        let user = await User.findOne({ email });

        if (user) {
            if (user.isVerified) {
                // If user exists and is verified (could be a Google user), prevent re-signup
                if (user.googleId) {
                    return res.render('signup', { error: 'This email is already associated with a Google account. Please use Google Sign-in or log in directly.', message: null });
                }
                return res.render('signup', { error: 'User with this email already exists and is verified. Please log in.', message: null });
            } else {
                // Existing unverified user, update their details
                user.firstName = firstName;
                user.lastName = lastName;
                user.mobile = mobile;
                user.gender = gender;
                user.password = password; // This will trigger pre-save hook for hashing
                await user.save();
                // Ensure googleId is null for traditional users if it was somehow set
                if (user.googleId) {
                    user.googleId = undefined; // unset the field
                    await user.save();
                }
            }
        } else {
            // New traditional signup
            user = new User({ firstName, lastName, email, mobile, password, gender, isVerified: false });
            await user.save();
        }

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

router.get('/verify-otp', (req, res) => {
    const email = req.query.email || '';
    res.render('verify_otp', { username: email, error: null, message: null, isPasswordReset: false });
});

router.post('/verify-otp', async (req, res) => {
    const { username, otp } = req.body;
    const email = username;

    try {
        const storedOtp = await Otp.findOne({ email, otp, type: 'signup' });

        if (!storedOtp) {
            return res.render('verify_otp', {
                username: email,
                error: 'Invalid or expired OTP. Please try again or resend.',
                message: null,
                isPasswordReset: false
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

        await Otp.deleteOne({ _id: storedOtp._id });

        user.isVerified = true;
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

router.post('/resend-otp', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, message: 'User not found.' });
        }

        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'Account already verified. Please login.' });
        }

        await Otp.deleteMany({ email, type: 'signup' });
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const newOtp = new Otp({ email: user.email, otp: otpCode, type: 'signup' });
        await newOtp.save();

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Resend OTP for MyGreenHome Account Verification',
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
        }
        res.redirect(`/auth/verify-otp?email=${encodeURIComponent(user.email)}`);

    } catch (error) {
        console.error('Error resending OTP:', error);
        res.status(500).json({ success: false, message: 'Failed to resend OTP. Please try again later.' });
    }
});

router.get('/admin-login', (req, res) => {
    res.render('admin_login', { error: null, message: null });
});

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
            const token = createToken(user._id);
            res.cookie('jwt', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 1000 * 60 * 60, // 1 hour
                path: '/',
                sameSite: 'Lax'
            });
            res.redirect('/dashboard');
        } else {
            res.render('admin_login', { error: 'Invalid credentials', message: null });
        }
    } catch (error) {
        console.error('Admin login error:', error);
        res.render('admin_login', { error: 'Server error during admin login, please try again.', message: null });
    }
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ email: username });

        if (!user) {
            return res.render('login', { error: 'Invalid credentials', message: null });
        }

        // If it's a Google-signed up user and they try traditional login
        if (user.googleId && !user.password) {
             return res.render('login', { error: 'This account was created with Google. Please use the "Sign in with Google" button.', message: null });
        }
        
        if (!user.isVerified) {
            return res.render('login', { error: 'Please verify your email first. If you haven\'t received an OTP, please sign up again.', message: null });
        }

        if (user && (await user.matchPassword(password))) {
            const token = createToken(user._id);
            res.cookie('jwt', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 1000 * 60 * 60, // 1 hour
                path: '/',
                sameSite: 'Lax'
            });

            if (user.role === 'admin') {
                return res.redirect('/dashboard');
            } else {
                return res.redirect('/user_dashboard');
            }
        } else {
            res.render('login', { error: 'Invalid credentials', message: null });
        }
    } catch (error) {
        console.error(error);
        res.render('login', { error: 'Server error, please try again.', message: null });
    }
});

router.get('/logout', requireAuth, (req, res) => {
    res.clearCookie('jwt');
    res.redirect('/auth');
});

router.get('/forgot-password', (req, res) => {
    res.render('forgot_password', { error: null, message: null });
});

router.post('/request-password-reset', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('forgot_password', { message: 'If an account with that email exists, you will receive a password reset link.', error: null });
        }
        res.render('forgot_password', { message: 'Password reset request received. Please check your email for instructions.', error: null });

    } catch (error) {
        console.error('Error during password reset request:', error);
        res.render('forgot_password', { error: 'Failed to process reset request. Try again later.', message: null });
    }
});

router.get('/reset-password', async (req, res) => {
    const email = req.query.email || '';
    res.render('reset_password', { email, error: null, message: null });
});

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
            return res.render('reset_password', { email, error: 'Invalid request or user not found.', message: null });
        }

        user.password = newPassword;
        user.isVerified = true;
        await user.save();

        res.render('login', { message: 'Password has been reset successfully! You can now log in.', error: null });

    } catch (error) {
        console.error('Error resetting password:', error);
        res.render('reset_password', { email, error: 'Failed to reset password. Try again.', message: null });
    }
});

module.exports = router;