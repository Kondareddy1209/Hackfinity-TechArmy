// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');

const User = require('../models/User');
const Otp = require('../models/Otp');
const { requireAuth } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs'); // Ensure bcrypt is imported if matchPassword uses it

const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_fallback';
const jwtExpiresIn = '1h'; // Example: 1 hour token expiration
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
    secure: false, // Use 'true' if you're on port 465 (SSL/TLS), 'false' for 587 (STARTTLS)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// --- GET Routes (Rendering Views) ---
router.get('/', (req, res) => {
    res.render('login', { error: null, message: null });
});

router.get('/login', (req, res) => {
    console.log('[DEBUG] Google Client ID in Env:', process.env.GOOGLE_CLIENT_ID ? 'Exists' : 'Missing');
    res.render('login', {
        error: null,
        message: null,
        googleClientId: process.env.GOOGLE_CLIENT_ID
    });
});

router.get('/signup', (req, res) => {
    res.render('signup', { error: null, message: null, googleClientId: process.env.GOOGLE_CLIENT_ID });
});

router.get('/verify-otp', (req, res) => {
    const email = req.query.email || '';
    res.render('verify_otp', { username: email, error: null, message: null, isPasswordReset: false });
});

router.get('/admin-login', (req, res) => {
    res.render('admin_login', { error: null, message: null });
});

router.get('/forgot-password', (req, res) => {
    res.render('forgot_password', { error: null, message: null });
});

router.get('/reset-password', async (req, res) => {
    const email = req.query.email || '';
    res.render('reset_password', { email, error: null, message: null });
});

// --- POST Routes (API Logic) ---

// Google Sign-in/Sign-up handler
router.post('/google', async (req, res) => {
    const { id_token } = req.body;

    if (!id_token) {
        console.log('[GOOGLE SIGNIN] Error: Google ID token missing from request body.');
        return res.status(400).json({ success: false, error: 'Google ID token missing.' });
    }

    try {
        // Verify the ID token with Google
        const ticket = await googleClient.verifyIdToken({
            idToken: id_token,
            audience: process.env.GOOGLE_CLIENT_ID, // Specify the CLIENT_ID of the app that accesses the backend
        });

        const payload = ticket.getPayload();
        // Extract required fields from payload, normalize email
        const { sub: googleId, email: rawEmail, given_name: firstName, family_name: lastName, picture: profilePicture } = payload;
        const email = rawEmail.toLowerCase(); // Normalize email to lowercase for consistency

        console.log(`[GOOGLE SIGNIN] Verified Google ID: ${googleId}, Email: ${email}`);

        let user;
        // 1. Try to find user by googleId OR by email. $or allows searching by either field.
        user = await User.findOne({
            $or: [
                { googleId: googleId },
                { email: email }
            ]
        });

        if (user) {
            // User found in database
            console.log(`[GOOGLE SIGNIN] User found for ${email} / ${googleId}. Existing user details:`, user);

            // Case A: User found by the exact googleId (this is a returning Google user)
            if (user.googleId === googleId) {
                console.log(`[GOOGLE SIGNIN] User ${email} logged in successfully via existing Google account.`);
                // No update needed for basic login flow. Update lastLoginDate if desired.
            }
            // Case B: User found by email, but did NOT have a googleId (traditional user linking Google account)
            else if (user.email === email && !user.googleId) {
                console.log(`[GOOGLE SIGNIN] Existing email user ${email} found. Linking Google ID.`);
                user.googleId = googleId; // Link Google ID
                user.provider = 'google'; // Set provider to Google
                user.isVerified = true; // Google verified the email, so this account is now verified
                // Optionally update profile picture from Google if the existing one is default or missing
                if (!user.profilePicture || user.profilePicture === '/images/default_image.png') {
                    user.profilePicture = profilePicture || '/images/default_image.png';
                }
                await user.save();
                console.log(`[GOOGLE SIGNIN] Existing user ${email} successfully linked with Google ID.`);
            }
            // Case C: Email exists, but linked to a DIFFERENT Google ID (conflict)
            // This is an edge case and might indicate data inconsistency or an attempt to link
            // an email already taken by another Google account.
            else if (user.email === email && user.googleId && user.googleId !== googleId) {
                console.warn(`[GOOGLE SIGNIN] Conflict: Email ${email} exists but is linked to a different Google ID (${user.googleId}). Current Google ID: ${googleId}.`);
                return res.status(409).json({ success: false, error: 'This email is already registered and linked to a different Google account. Please use that account or contact support.' });
            }
            // Case D: Google ID exists, but email doesn't match (should be prevented by `unique: true` on `googleId`)
            // This would only happen if `googleId` was not unique or `sparse` was causing issues.
            else if (user.googleId === googleId && user.email !== email) {
                console.warn(`[GOOGLE SIGNIN] Conflict: Google ID ${googleId} exists but linked to different email (${user.email}). Current email: ${email}.`);
                return res.status(409).json({ success: false, error: 'This Google account is linked to a different email in our system. Please contact support.' });
            }

        } else {
            // No user found by email or googleId - This is a completely new Google signup
            console.log(`[GOOGLE SIGNIN] No existing user found for ${email} / ${googleId}. Creating new user.`);

            user = new User({
                firstName: firstName || 'Google User', // Provide a fallback if Google's payload lacks it
                lastName: lastName || '', // Provide a fallback, as schema allows empty string for Google users
                email: email,
                googleId: googleId,
                provider: 'google', // Explicitly set provider
                isVerified: true, // Google's email is considered verified
                profilePicture: profilePicture || '/images/default_image.png',
                // password, mobile, gender are not explicitly set here for Google users
                // because the schema's 'required' function will make them optional based on googleId presence.
                // You can set them to null/undefined if you want to explicitly store null.
                mobile: null, // Will be stored as null if not provided
                gender: null, // Will be stored as null if not provided
            });
            await user.save(); // Save the new user document
            console.log(`[GOOGLE SIGNIN] New user ${email} created via Google signup.`);
        }

        // --- Common success path for both existing and new Google users ---
        const token = createToken(user._id); // Create JWT for the user
        res.cookie('jwt', token, {
            httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
            secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
            maxAge: 1000 * 60 * 60, // Cookie expires in 1 hour
            path: '/', // Cookie accessible across the entire domain
            sameSite: 'Lax' // Protection against CSRF attacks
        });

        // Determine redirect URL based on user role
        const redirectUrl = user.role === 'admin' ? '/dashboard' : '/user_dashboard';
        res.status(200).json({ success: true, message: 'Google sign-in successful', redirectUrl });

    } catch (error) {
        console.error('[GOOGLE SIGNIN ERROR] Detailed Error:', error);

        if (error.response) {
            console.error('[GOOGLE SIGNIN] Google API Error Data:', error.response.data);
        }

        if (error.code === 11000) { // Mongoose/MongoDB duplicate key error
            const field = Object.keys(error.keyValue)[0]; // Get the field that caused the duplicate error
            const value = error.keyValue[field];
            if (field === 'email') {
                return res.status(409).json({ success: false, error: `Account with email "${value}" already exists. Please login with your existing method.` });
            } else if (field === 'googleId') {
                return res.status(409).json({ success: false, error: 'This Google account is already linked to another user. Please contact support.' });
            }
        }
        res.status(500).json({ success: false, error: 'Google sign-in failed. Check server logs for details.' });
    }
});


// Traditional Email/Password Sign-up route
router.post('/signup', async (req, res) => {
    const { firstName, lastName, email: rawEmail, mobile, password, gender } = req.body;
    const email = rawEmail.toLowerCase(); // Normalize email to lowercase

    // --- IMPORTANT DEBUGGING LOGS ---
    console.log(`[SIGNUP] Attempting traditional signup for email: ${email}`);
    console.log(`[SIGNUP] Received request body:`, req.body);
    // --- END DEBUGGING LOGS ---

    // Basic validation (Frontend should also do this, but backend must re-validate)
    if (!email || !password || !firstName || !lastName || !mobile || !gender) {
        return res.status(400).render('signup', { error: 'All required fields must be provided.', message: null });
    }
    if (password.length < 6) {
        return res.status(400).render('signup', { error: 'Password must be at least 6 characters long.', message: null });
    }
    if (!/^\d{10}$/.test(mobile)) { // Validate 10-digit mobile number
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
                console.log(`[SIGNUP] Email ${email} is linked to Google. Prompting Google Sign-in.`);
                return res.render('signup', { error: 'This email is already associated with a Google account. Please use the "Sign in with Google" button to log in.', message: null });
            }
            // Case 2: User exists, is NOT linked via Google, and is already verified (traditional email/password user)
            else if (user.isVerified) {
                console.log(`[SIGNUP] Email ${email} already exists and is verified. Prompting login.`);
                return res.render('signup', { error: 'An account with this email already exists and is verified. Please log in.', message: null });
            }
            // Case 3: User exists, is NOT linked via Google, and is NOT verified (unverified traditional user trying to re-signup)
            else {
                console.log(`[SIGNUP] Existing unverified traditional user ${email} found. Updating data and resending OTP.`);
                // Update user details if they've re-entered the form data
                user.firstName = firstName;
                user.lastName = lastName;
                user.mobile = mobile;
                user.gender = gender;
                // Only update password if a new one is provided or if the existing one is missing
                if (password && (!user.password || !(await user.matchPassword(password)))) { // Check if new password is different or if no password exists
                    user.password = password; // Pre-save hook will hash it
                }
                user.isVerified = false; // Remains false until OTP verification
                user.provider = 'email'; // Ensure provider is 'email'
                user.googleId = null; // Ensure googleId is null
                await user.save(); // Save updated details
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
            await user.save(); // Save the new user document
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
            // Redirect to OTP verification page ONLY after successful email send
            res.redirect(`/auth/verify-otp?email=${encodeURIComponent(user.email)}`);
        } catch (emailError) {
            console.error('[SIGNUP ERROR] Email send failed:', emailError);
            // Inform the user that email failed
            return res.render('signup', { error: 'Registration incomplete: Failed to send OTP email. Please check your email address or contact support.', message: null });
        }

    } catch (error) {
        console.error('[SIGNUP ERROR] Error during signup or sending OTP:', error);
        if (error.code === 11000) { // Mongoose/MongoDB duplicate key error
            const field = Object.keys(error.keyValue)[0]; // Get the field that caused the duplicate error
            const value = error.keyValue[field];
            let errorMessage = '';
            if (field === 'email') {
                errorMessage = `Email "${value}" is already registered. Please log in or use Google Sign-in.`;
            } else if (field === 'mobile') {
                errorMessage = `Mobile number "${value}" is already registered. Please use another number or contact support.`;
            } else {
                errorMessage = `Duplicate entry for ${field} "${value}".`;
            }
            return res.render('signup', { error: errorMessage, message: null });
        }
        res.render('signup', { error: 'Registration failed due to a server error. Please try again.', message: null });
    }
});

// Verify OTP route
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

        await Otp.deleteOne({ _id: storedOtp._id }); // Delete the used OTP

        user.isVerified = true; // Mark user as verified
        // Ensure provider is correctly set if it wasn't during initial Google sign-in
        if (!user.provider) {
            user.provider = user.googleId ? 'google' : 'email';
        }
        await user.save(); // Save the updated user status

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

// Resend OTP route
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
            // If email fails, you might want to consider if the frontend should still indicate success
            // or if it should show an error, depending on how critical the email sending is.
            res.status(500).json({ success: false, message: 'Failed to send OTP email. Please try again later.' });
        }

    } catch (error) {
        console.error('[RESEND OTP ERROR] Error resending OTP:', error);
        res.status(500).json({ success: false, message: 'Failed to resend OTP. Please try again later.' });
    }
});

// Admin Login route
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

        // Admins must have a password for this route; Google-linked accounts need special handling
        if (user.googleId && !user.password) {
            return res.render('admin_login', { error: 'This Admin account is linked to Google and does not have a traditional password. Please use Google Sign-in if applicable, or contact support to set a password.', message: null });
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

// Traditional Email/Password Login route
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

        // If it's a traditional user with no password (should ideally not happen due to schema's required:true)
        if (!user.password && !user.googleId) {
            console.warn(`[LOGIN] User ${email} found with no password and no googleId. Incomplete or corrupted account?`);
            return res.render('login', { error: 'Account is incomplete or corrupted. Please try signing up again or contact support.', message: null });
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

// Request Password Reset OTP route
router.post('/request-password-reset', async (req, res) => {
    const { email: rawEmail } = req.body;
    const email = rawEmail.toLowerCase(); // Normalize email

    try {
        const user = await User.findOne({ email });
        if (!user) {
            // For security, don't reveal if email exists. Always send a generic message.
            return res.render('forgot_password', { message: 'If an account with that email exists, you will receive password reset instructions.', error: null });
        }
        // If it's a Google-linked account with no password, they can't reset a non-existent password
        if (user.googleId && !user.password) {
            return res.render('forgot_password', { error: 'This account is linked to Google and does not have a password to reset. Please use Google Sign-in.', message: null });
        }

        // Logic to send a password reset OTP/link would go here.
        // For now, it sends a generic message.
        res.render('forgot_password', { message: 'Password reset request received. Please check your email for instructions.', error: null });

    } catch (error) {
        console.error('Error during password reset request:', error);
        res.render('forgot_password', { error: 'Failed to process reset request. Try again later.', message: null });
    }
});

// Set New Password route
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
        user.isVerified = true; // Mark as verified if password reset implies verification (common practice)
        await user.save();

        res.render('login', { message: 'Password has been reset successfully! You can now log in.', error: null });

    } catch (error) {
        console.error('Error resetting password:', error);
        res.render('reset_password', { email, error: 'Failed to reset password. Try again.', message: null });
    }
});

module.exports = router;
