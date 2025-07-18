// server.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // For authentication after login
const path = require('path'); // Needed for setting view directory

// Import models and utils
const User = require('./models/User');
const sendVerificationEmail = require('./utils/emailSender');

const app = express();

// --- EJS Setup ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Specify the directory where your .ejs files will live

app.use(express.json()); // Middleware to parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Middleware to parse URL-encoded bodies for form submissions

// --- Serve Static Files (if you have CSS/JS in a public folder) ---
app.use(express.static(path.join(__dirname, 'public')));


// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected!'))
.catch(err => console.error('MongoDB connection error:', err));

// --- JWT Secret ---
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';

// --- Routes ---

// @route   GET /
// @desc    Render the login/signup page
// @access  Public
app.get('/', (req, res) => {
    res.render('auth', { message: null, type: null }); // Render the auth.ejs template
});

// @route   POST /api/register
// @desc    Register new user (API endpoint for AJAX requests from frontend)
// @access  Public
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpires = new Date(Date.now() + 24 * 3600 * 1000);

        user = new User({
            email,
            password: hashedPassword,
            verificationToken,
            verificationTokenExpires
        });

        await user.save();
        await sendVerificationEmail(user.email, verificationToken);

        // For AJAX requests, still return JSON
        res.status(201).json({ msg: 'User registered! Please check your email to verify your account.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error during registration.' });
    }
});

// @route   GET /verify-email
// @desc    Verify user email with token (renders an EJS page)
// @access  Public
app.get('/verify-email', async (req, res) => {
    const { token } = req.query;
    let message, type; // For EJS template

    if (!token) {
        message = 'Verification token is missing.';
        type = 'error';
        return res.render('verification_status', { message, type });
    }

    try {
        const user = await User.findOne({ verificationToken: token });

        if (!user) {
            message = 'Invalid or already used verification link.';
            type = 'error';
            return res.render('verification_status', { message, type });
        }

        if (user.verificationTokenExpires < Date.now()) {
            message = 'Verification link has expired. Please re-register or request a new one.';
            type = 'error';
            return res.render('verification_status', { message, type });
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        await user.save();

        message = 'Email successfully verified! You can now log in.';
        type = 'success';
        res.render('verification_status', { message, type });

    } catch (err) {
        console.error(err.message);
        message = 'Server error during email verification.';
        type = 'error';
        res.render('verification_status', { message, type });
    }
});

// @route   POST /api/login
// @desc    Authenticate user & get token (API endpoint for AJAX requests)
// @access  Public
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        if (!user.isVerified) {
            return res.status(401).json({ msg: 'Please verify your email to log in.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const payload = {
            user: {
                id: user.id,
                email: user.email,
                isAdmin: user.isAdmin
            }
        };

        jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, msg: 'Logged in successfully!' });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error during login' });
    }
});


// Basic protected dashboard route (requires an auth middleware, which is an advanced topic for hackathon MVP)
// For a hackathon MVP, you can just redirect after successful login
app.get('/dashboard', (req, res) => {
    // In a real app, you'd verify JWT token here to ensure user is logged in
    res.render('dashboard', { userEmail: 'Logged In User' }); // Example: Pass user data to dashboard
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));