// app.js - Main application entry point

require('dotenv').config(); // Load environment variables first

const express = require('express');
const path = require('path');
const { connectToMongoDB, getDb } = require('./utils/db'); // Import DB connection utility

// Import route modules
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Express Configuration ---
// Set EJS as the view engine
app.set('view engine', 'ejs');
// Specify the directory where EJS templates are located
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve static files (client-side JS, CSS, images) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- Routes for rendering EJS templates ---
// Route for the user login page (default entry)
app.get('/', (req, res) => {
    res.render('login'); // Renders views/login.ejs
});

// Route for the signup page
app.get('/signup', (req, res) => {
    res.render('signup'); // Renders views/signup.ejs
});

// Route for the OTP verification page (NEW)
app.get('/verify-otp', (req, res) => {
    res.render('otpVerification'); // Renders views/otpVerification.ejs
});

// Route for the admin login page (can be same as user login, but different URL for clarity)
app.get('/admin-login', (req, res) => {
    res.render('login'); // Re-use login.ejs, client-side JS will handle admin-specific logic
});

// Routes for dashboards (these will be rendered by client-side JS after successful auth)
// We still need server-side routes for direct access/refresh
app.get('/user-dashboard', (req, res) => {
    res.render('userDashboard'); // Renders views/userDashboard.ejs
});

app.get('/admin-dashboard', (req, res) => {
    res.render('adminDashboard'); // Renders views/adminDashboard.ejs
});


// --- Mount API routes ---
app.use('/api', authRoutes);    // Authentication routes (signup, login, OTP)
app.use('/api', productRoutes); // Product management routes (user-specific)
app.use('/api', adminRoutes);   // Admin-specific routes

// Start the server after successfully connecting to MongoDB
connectToMongoDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Node.js server running on http://localhost:${PORT}`);
        console.log(`Access the application at http://localhost:${PORT}`);
    });
}).catch(error => {
    console.error("Failed to start server due to MongoDB connection error:", error);
    process.exit(1);
});
