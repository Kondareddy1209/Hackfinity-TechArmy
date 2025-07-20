// C:\Users\Konda Reddy\OneDrive\Desktop\Hackfinity-TechArmy\app.js

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
require('dotenv').config();
const fs = require('fs').promises; // Import fs.promises for async file system operations

const admin = require('firebase-admin');

try {
    const serviceAccount = require('./config/kondareddy-452915-firebase-adminsdk-fbsvc-35bea9d588.json');
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin SDK initialized successfully.');
    }
} catch (error) {
    console.error('ERROR: Failed to initialize Firebase Admin SDK. Check serviceAccountKey.json path and content:', error.message);
}


const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

const { checkUser } = require('./middleware/authMiddleware');
app.use(checkUser);

app.set('appId', process.env.APP_ID || 'mygreenhome-default-app-id');
app.use((req, res, next) => {
    res.locals.__app_id = app.get('appId');
    res.locals.__firebase_config = JSON.stringify({
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

// *******************************************************************
// MODIFIED: Ensure upload directories exist on application startup
// Using `force: false` with `recursive: true` will prevent EEXIST error.
// *******************************************************************
const uploadDirs = [
    path.join(__dirname, 'public', 'uploads', 'temp'),
    path.join(__dirname, 'public', 'uploads', 'profile_pictures'),
    path.join(__dirname, 'public', 'uploads', 'products')
];

async function ensureUploadDirectories() {
    for (const dir of uploadDirs) {
        try {
            // Using `fs.mkdir(dir, { recursive: true })` by itself will often not throw EEXIST
            // in modern Node.js versions (v10.12.0+).
            // However, to explicitly handle it and ensure no errors for existing directories,
            // we can catch the specific 'EEXIST' error code if it somehow still propagates.
            await fs.mkdir(dir, { recursive: true });
            console.log(`Ensured directory exists: ${dir}`);
        } catch (err) {
            // If the error is not EEXIST, then it's a real problem.
            if (err.code !== 'EEXIST') {
                console.error(`Failed to create directory ${dir}:`, err);
                // In a production app, you might want to process.exit(1) here
                // if directory creation is absolutely essential and fails for other reasons.
            } else {
                console.log(`Directory already exists: ${dir} (Skipped creation)`);
            }
        }
    }
}
// Call this function before starting the server or connecting to DB
ensureUploadDirectories(); // Run the async function


const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/admin');

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use(dashboardRoutes);

app.get('/', (req, res) => {
    res.redirect('/auth');
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

app.use((req, res, next) => {
    // This is the global 404 handler
    res.status(404).render('404', { title: 'Page Not Found', user: res.locals.user });
});

app.use((err, req, res, next) => {
    // This is the global 500 error handler
    console.error('Unhandled server error:', err.stack); // Log the stack trace for debugging
    if (res.headersSent) { // Check if headers have already been sent to prevent crash
        return next(err); // Pass to next error handler or let Express handle it
    }

    // Try to render the 500 page.
    res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: err.message || 'An unexpected server error occurred.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
});