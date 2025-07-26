// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');

const User = require('../models/User');
const Otp = require('../models/Otp');
const { requireAuth } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs'); // Assuming bcrypt is used for password hashing

const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_fallback';
const jwtExpiresIn = '1h';
const createToken = (id) => {
    return jwt.sign({ id }, jwtSecret, {
        expiresIn: jwtExpiresIn
    });
};

// Initialize Google OAuth2Client with your client ID
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
    res.render('signup', { error: null, message: null });
});

// NEW: Google Sign-in/Sign-up handler
router.post('/google', async (req, res) => {
    const { id_token } = req.body;

    if (!id_token) {
        console.log('[GOOGLE SIGNIN] Error: Google ID token missing.');
        return res.status(400).json({ success: false, error: 'Google ID token missing.' });
    }

    try {
        // Verify the ID token with Google
        const ticket = await googleClient.verifyIdToken({
            idToken: id_token,
            audience: process.env.GOOGLE_CLIENT_ID, // Specify the CLIENT_ID of the app that accesses the backend
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email: rawEmail, given_name: firstName, family_name: lastName, picture: profilePicture } = payload;
        const email = rawEmail.toLowerCase(); // Normalize email to lowercase

        console.log(`[GOOGLE SIGNIN] Verified Google ID: ${googleId}, Email: ${email}`);

        let user;
        // 1. Try to find user by googleId OR by email
        user = await User.findOne({
            $or: [
                { googleId: googleId },
                { email: email }
            ]
        });

        if (user) {
            // User found
            console.log(`[GOOGLE SIGNIN] User found for ${email} / ${googleId}. Existing user details:`, user);

            // Case A: User found by googleId (re-login for existing Google user)
            if (user.googleId === googleId) {
                console.log(`[GOOGLE SIGNIN] User ${email} logged in successfully via existing Google account.`);
                // No update needed for basic login, but you might update lastLoginDate etc.
            }
            // Case B: User found by email, but no googleId (traditional user linking Google account)
            else if (user.email === email && !user.googleId) {
                console.log(`[GOOGLE SIGNIN] Existing email user ${email} found. Linking Google ID.`);
                user.googleId = googleId; // Link Google ID
                user.provider = 'google'; // Update provider type
                user.isVerified = true; // Google verified the email
                // Optionally update profile picture from Google if desired
                if (!user.profilePicture || user.profilePicture === '/images/default_image.png') {
                    user.profilePicture = profilePicture;
                }
                await user.save();
                console.log(`[GOOGLE SIGNIN] Existing user ${email} successfully linked with Google ID.`);
            }
            // Case C: Email exists, but linked to a DIFFERENT Google ID (conflict)
            else if (user.email === email && user.googleId && user.googleId !== googleId) {
                console.warn(`[GOOGLE SIGNIN] Conflict: Email ${email} exists but is linked to a different Google ID (${user.googleId}). Current Google ID: ${googleId}.`);
                return res.status(409).json({ success: false, error: 'This email is already registered and linked to a different Google account. Please use that account or contact support.' });
            }
            // Case D: Google ID exists, but email doesn't match (should be caught by unique:true on googleId, but as a fallback)
            else if (user.googleId === googleId && user.email !== email) {
                console.warn(`[GOOGLE SIGNIN] Conflict: Google ID ${googleId} exists but linked to different email (${user.email}). Current email: ${email}.`);
                return res.status(409).json({ success: false, error: 'This Google account is linked to a different email in our system. Please contact support.' });
            }

        } else {
            // No user found by email or googleId - This is a completely new Google signup
            console.log(`[GOOGLE SIGNIN] No existing user found for ${email} / ${googleId}. Creating new user.`);

            user = new User({
                firstName: firstName || 'Google User', // Fallback name
                lastName: lastName || '',
                email: email,
                googleId: googleId,
                provider: 'google', // Explicitly set provider
                isVerified: true, // Google email is already verified
                profilePicture: profilePicture || '/images/default_image.png',
                // Password is not required for Google signup due to schema's 'required' function
                // Mobile and Gender are also not required due to schema's 'required' function
                // You can set defaults or leave them undefined if your schema allows
                mobile: null, // Set to null or undefined if not provided by Google and not required
                gender: null, // Set to null or undefined if not provided by Google and not required
            });
            await user.save();
            console.log(`[GOOGLE SIGNIN] New user ${email} created via Google signup.`);
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
        console.error('[GOOGLE SIGNIN ERROR] Error during Google ID token verification or user operation:', error);
        if (error.code === 11000) { // Duplicate key error (e.g., email or googleId already exists)
            const field = Object.keys(error.keyValue)[0];
            const value = error.keyValue[field];
            if (field === 'email') {
                return res.status(409).json({ success: false, error: `Account with email "${value}" already exists. Please login with your existing method.` });
            } else if (field === 'googleId') {
                return res.status(409).json({ success: false, error: 'This Google account is already linked to another user. Please contact support.' });
            }
        }
        res.status(500).json({ success: false, error: 'Google sign-in failed due to a server error. Please try again.' });
    }
});


router.post('/signup', async (req, res) => {
    const { firstName, lastName, email: rawEmail, mobile, password, gender } = req.body;
    const email = rawEmail.toLowerCase(); // Normalize email to lowercase

    // --- IMPORTANT DEBUGGING LOGS ---
    console.log(`[SIGNUP] Attempting traditional signup for email: ${email}`);
    console.log(`[SIGNUP] Received request body:`, req.body);
    // --- END DEBUGGING LOGS ---

    // Basic validation
    if (!email || !password || !firstName || !lastName || !mobile || !gender) {
        return res.status(400).render('signup', { error: 'All required fields must be provided.', message: null });
    }
    if (password.length < 6) {
        return res.status(400).render('signup', { error: 'Password must be at least 6 characters long.', message: null });
    }
    if (!/^\d{10}$/.test(mobile)) {
        return res.status(400).render('signup', { error: 'Please enter a valid 10-digit mobile number.', message: null });
    }

    try {
        let user = await User.findOne({ email });

        // --- CRUCIAL DEBUGGING LOG ---
        console.log(`[SIGNUP] Database lookup result for ${email}:`, user ? 'User found' : 'No user found');
        if (user) {
            console.log(`[SIGNUP] Existing user details:`, user);
        }
        // --- END CRUCIAL DEBUGGING LOG ---

        if (user) {
            // Case 1: User exists and is linked via Google (has googleId)
            if (user.googleId) {
                console.log(`[SIGNUP] Email ${email} is linked to Google. Redirecting user.`);
                return res.render('signup', { error: 'This email is already associated with a Google account. Please use the "Sign in with Google" button to log in.', message: null });
            }
            // Case 2: User exists, is NOT linked via Google, and is already verified (traditional email/password user)
            else if (user.isVerified) {
                console.log(`[SIGNUP] Email ${email} already exists and is verified. Redirecting to login.`);
                return res.render('signup', { error: 'An account with this email already exists and is verified. Please log in.', message: null });
            }
            // Case 3: User exists, is NOT linked via Google, and is NOT verified (unverified traditional user)
            else {
                console.log(`[SIGNUP] Existing unverified user ${email} found. Resending OTP.`);
                // For an existing unverified user, we don't create a new user or update all fields.
                // We just resend the OTP for the existing account.
                // Ensure the user's data (firstName, lastName, mobile, gender) is updated if they changed it
                // during a re-signup attempt, but only if they are not verified.
                user.firstName = firstName;
                user.lastName = lastName;
                user.mobile = mobile;
                user.gender = gender;
                // Only update password if it's explicitly provided and different, or if it was null
                if (password && (!user.password || await bcrypt.compare(password, user.password) === false)) {
                     user.password = password; // Pre-save hook will hash it
                }
                await user.save();
            }
        } else {
            // Case 4: No user found - This is a completely new traditional signup
            console.log(`[SIGNUP] No existing user found for ${email}. Creating new traditional user.`);
            user = new User({
                firstName,
                lastName,
                email,
                mobile,
                password, // Pre-save hook will hash this
                gender,
                isVerified: false, // Will be verified after OTP
                provider: 'email', // Explicitly set provider
                googleId: null // Ensure googleId is null for traditional signups
            });
            await user.save();
            console.log(`[SIGNUP] New traditional user ${user.email} created.`);
        }

        // Always delete old OTPs and send a new one for signup verification
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
            console.log(`[SIGNUP] OTP ${otpCode} sent to ${user.email}`);
        } catch (emailError) {
            console.error('[SIGNUP ERROR] Email send failed:', emailError);
            // Don't block signup if email fails, but log it
        }
        res.redirect(`/auth/verify-otp?email=${encodeURIComponent(user.email)}`);

    } catch (error) {
        console.error('[SIGNUP ERROR] Error during signup or sending OTP:', error);
        if (error.code === 11000) { // Duplicate key error (e.g., email or mobile already exists)
            const field = Object.keys(error.keyValue)[0];
            const value = error.keyValue[field];
            let errorMessage = '';
            if (field === 'email') {
                errorMessage = `Email "${value}" is already registered. Please log in or use Google Sign-in.`;
            } else if (field === 'mobile') {
                errorMessage = `Mobile number "${value}" is already registered.`;
            } else {
                errorMessage = `Duplicate entry for ${field} "${value}".`;
            }
            return res.render('signup', { error: errorMessage, message: null });
        }
        res.render('signup', { error: 'Registration failed due to a server error. Please try again.', message: null });
    }
});

router.get('/verify-otp', (req, res) => {
    const email = req.query.email || '';
    res.render('verify_otp', { username: email, error: null, message: null, isPasswordReset: false });
});

router.post('/verify-otp', async (req, res) => {
    const { username, otp } = req.body;
    const email = username.toLowerCase(); // Normalize email

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
            console.error(`[VERIFY OTP] User not found for email ${email} during OTP verification.`);
            return res.render('verify_otp', {
                username: email,
                error: 'User not found for this email.',
                message: null,
                isPasswordReset: false
            });
        }

        await Otp.deleteOne({ _id: storedOtp._id });

        user.isVerified = true;
        // If a Google user somehow lands here (e.g., if isVerified was false initially)
        // and they complete OTP, ensure their provider is set correctly.
        if (!user.provider) {
            user.provider = user.googleId ? 'google' : 'email';
        }
        await user.save();
        res.render('login', { message: 'Email verified successfully! You can now log in.', error: null });

    } catch (error) {
        console.error('[VERIFY OTP ERROR] Error during OTP verification:', error);
        res.render('verify_otp', {
            username: email,
            error: 'Verification failed. Please try again.',
            message: null,
            isPasswordReset: false
        });
    }
});

router.post('/resend-otp', async (req, res) => {
    const { email: rawEmail } = req.body;
    const email = rawEmail.toLowerCase(); // Normalize email

    try {
        const user = await User.findOne({ email });
        if (!user) {
            console.log(`[RESEND OTP] User not found for email ${email}.`);
            return res.status(400).json({ success: false, message: 'User not found.' });
        }

        if (user.isVerified) {
            console.log(`[RESEND OTP] Account ${email} already verified. Cannot resend OTP.`);
            return res.status(400).json({ success: false, message: 'Account already verified. Please login.' });
        }
        // If it's a Google-linked account that somehow is unverified, tell them to use Google Sign-in
        if (user.googleId) {
            console.log(`[RESEND OTP] Account ${email} is Google-linked. Cannot resend OTP for traditional verification.`);
            return res.status(400).json({ success: false, message: 'This account is linked to Google. Please use Google Sign-in.' });
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
            console.log(`[RESEND OTP] OTP ${otpCode} sent to ${user.email}`);
            res.status(200).json({ success: true, message: 'New OTP sent successfully!' });
        } catch (emailError) {
            console.error('[RESEND OTP ERROR] Email send failed:', emailError);
            res.status(500).json({ success: false, message: 'Failed to send OTP email. Please try again later.' });
        }

    } catch (error) {
        console.error('[RESEND OTP ERROR] Error resending OTP:', error);
        res.status(500).json({ success: false, message: 'Failed to resend OTP. Please try again later.' });
    }
});

router.get('/admin-login', (req, res) => {
    res.render('admin_login', { error: null, message: null });
});

router.post('/admin-login', async (req, res) => {
    const { username, password } = req.body;
    const email = username.toLowerCase(); // Normalize email

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('admin_login', { error: 'Invalid credentials', message: null });
        }

        if (user.role !== 'admin') {
            return res.render('admin_login', { error: 'Access denied: Not an administrator.', message: null });
        }

        // Admins must have a password, not Google-linked without password
        if (user.googleId && !user.password) {
            return res.render('admin_login', { error: 'Admin account linked to Google. Please use Google Sign-in if you have not set a password.', message: null });
        }

        if (!user.isVerified) {
            return res.render('admin_login', { error: 'Admin account not verified. Please contact support.', message: null });
        }

        if (await user.matchPassword(password)) {
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
    const email = username.toLowerCase(); // Normalize email

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('login', { error: 'Invalid credentials', message: null });
        }

        // If it's a Google-signed up user and they try traditional login without a password
        if (user.googleId && !user.password) {
             return res.render('login', { error: 'This account was created with Google. Please use the "Sign in with Google" button.', message: null });
        }
        
        // If it's a traditional user but no password (shouldn't happen if schema is correct)
        if (!user.password && !user.googleId) {
            console.warn(`[LOGIN] User ${email} found with no password and no googleId. Incomplete account?`);
            return res.render('login', { error: 'Account is incomplete. Please try signing up again or contact support.', message: null });
        }

        if (!user.isVerified) {
            return res.render('login', { error: 'Please verify your email first. If you haven\'t received an OTP, please sign up again.', message: null });
        }

        if (await user.matchPassword(password)) {
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
        console.error('Login error:', error);
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
    const { email: rawEmail } = req.body;
    const email = rawEmail.toLowerCase(); // Normalize email

    try {
        const user = await User.findOne({ email });
        if (!user) {
            // Don't reveal if email exists for security
            return res.render('forgot_password', { message: 'If an account with that email exists, you will receive a password reset link.', error: null });
        }
        // If it's a Google-linked account with no password, they can't reset a non-existent password
        if (user.googleId && !user.password) {
            return res.render('forgot_password', { error: 'This account is linked to Google and does not have a password to reset. Please use Google Sign-in.', message: null });
        }

        // Proceed with OTP for password reset (assuming you'll implement this logic)
        // For now, just send a generic message
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
    const { email: rawEmail, newPassword, confirmPassword } = req.body;
    const email = rawEmail.toLowerCase(); // Normalize email

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

        // If it's a Google-linked account with no password, prevent setting one via reset
        if (user.googleId && !user.password) {
            return res.render('reset_password', { email, error: 'This account is linked to Google and does not have a password to reset. Please use Google Sign-in.', message: null });
        }

        user.password = newPassword; // Pre-save hook will hash this
        user.isVerified = true; // Mark as verified if password reset implies verification
        await user.save();

        res.render('login', { message: 'Password has been reset successfully! You can now log in.', error: null });

    } catch (error) {
        console.error('Error resetting password:', error);
        res.render('reset_password', { email, error: 'Failed to reset password. Try again.', message: null });
    }
});

module.exports = router;