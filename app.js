// C:\Users\Konda Reddy\OneDrive\Desktop\Hackfinity\app.js

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables from .env file

// --- Firebase Admin SDK Initialization ---
const admin = require('firebase-admin');

try {
    // IMPORTANT: Ensure this path EXACTLY matches your service account key file's location and name.
    // Example: './config/your-firebase-adminsdk-key.json'
    const serviceAccount = require('./config/kondareddy-452915-firebase-adminsdk-fbsvc-35bea9d588.json'); // <--- VERIFY THIS PATH CAREFULLY
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin SDK initialized successfully.');
    }
} catch (error) {
    console.error('ERROR: Failed to initialize Firebase Admin SDK. Check serviceAccountKey.json path and content:', error.message);
    // If Firebase Admin is critical for app startup, uncomment the next line to stop the process:
    // process.exit(1);
}
// --- End Firebase Admin SDK Initialization ---


const app = express();

// Set up view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies
app.use(cookieParser()); // To parse cookies

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Import authentication middleware
const { checkUser } = require('./middleware/authMiddleware');

// Apply checkUser middleware globally to all routes
app.use(checkUser);

// Make app-specific ID and Firebase client-side config available to EJS templates
app.set('appId', process.env.APP_ID || 'mygreenhome-default-app-id');
app.use((req, res, next) => {
    res.locals.__app_id = app.get('appId');
    res.locals.__firebase_config = JSON.stringify({ // THIS LINE
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID
    });
    next();
});

// Import route modules
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/admin');

// Mount routes - ORDER IS IMPORTANT
// Authentication routes should often be mounted early.
app.use('/auth', authRoutes);       // Handles /auth/login, /auth/logout, /auth/signup etc.
app.use('/admin', adminRoutes);     // Handles /admin/login, /admin/users etc.
app.use(dashboardRoutes);           // Handles /dashboard, /user_dashboard, /user/product-generator, /ai-chat etc.


// Define a basic home route that redirects to the main authentication page
app.get('/', (req, res) => {
    res.redirect('/auth');
});

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));
// --- End MongoDB Connection ---

// --- Error Handling Middleware ---
// 404 Not Found handler - MUST BE LAST ROUTE/MIDDLEWARE BEFORE GLOBAL ERROR HANDLER
app.use((req, res, next) => {
    res.status(404).render('404', { title: 'Page Not Found', user: res.locals.user });
});

// Global error handler - CATCH-ALL FOR UNHANDLED ERRORS
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the stack trace for debugging
    res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: err.message });
});
// --- End Error Handling Middleware ---

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
});