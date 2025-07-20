const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
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
    res.render('signup', { error: null });
});

router.post('/signup', async (req, res) => {
    const { firstName, lastName, email, mobile, password, gender } = req.body;

    try {
        let user = await User.findOne({ email });

        if (user) {
            if (user.isVerified) {
                return res.render('signup', { error: 'User with this email already exists and is verified. Please log in.', message: null });
            } else {
                user.firstName = firstName;
                user.lastName = lastName;
                user.mobile = mobile;
                user.gender = gender;
                user.password = password;
                await user.save();
            }
        } else {
            user = new User({ firstName, lastName, email, mobile, password, gender });
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
            res.cookie('jwt', token, { // <<< IMPORTANT CHANGE: 'token' to 'jwt'
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

        if (!user.isVerified) {
            return res.render('login', { error: 'Please verify your email first. If you haven\'t received an OTP, please sign up again.', message: null });
        }

        if (user && (await user.matchPassword(password))) {
            const token = createToken(user._id);
            res.cookie('jwt', token, { // <<< IMPORTANT CHANGE: 'token' to 'jwt'
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
    res.clearCookie('jwt'); // <<< IMPORTANT CHANGE: 'token' to 'jwt'
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