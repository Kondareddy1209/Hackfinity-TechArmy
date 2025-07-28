// app.js
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
require('dotenv').config(); // Ensure this is at the very top to load .env variables
const fs = require('fs').promises;

// IMPORT THE USER MODEL HERE (Crucial for Mongoose to know about the schema)
const User = require('./models/User');

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
    res.locals.process = { env: process.env };
    next();
});

const uploadDirs = [
    path.join(__dirname, 'public', 'uploads', 'temp'),
    path.join(__dirname, 'public', 'uploads', 'profile_pictures'),
    path.join(__dirname, 'public', 'uploads', 'products')
];

async function ensureUploadDirectories() {
    for (const dir of uploadDirs) {
        try {
            await fs.mkdir(dir, { recursive: true });
            console.log(`Ensured directory exists: ${dir}`);
        } catch (err) {
            if (err.code !== 'EEXIST') {
                console.error(`Failed to create directory ${dir}:`, err);
            } else {
                console.log(`Directory already exists: ${dir} (Skipped creation)`);
            }
        }
    }
}

ensureUploadDirectories();

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/admin');

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use(dashboardRoutes);

app.get('/', (req, res) => {
    res.redirect('/auth');
});

// REVERTED: Removed the explicit User.createIndexes() call from here.
// Mongoose will create unique indexes defined in the schema automatically
// when a document is saved, if they don't already exist.
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB connected successfully');
        // No explicit index creation here.
        // Mongoose will handle unique index creation from schema on the first document save
        // if the index does not already exist.
    })
    .catch(err => console.error('MongoDB connection error:', err)); // Simplified catch for now


app.use((req, res, next) => {
    res.status(404).render('404', { title: 'Page Not Found', user: res.locals.user });
});

app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err.stack);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: err.message || 'An unexpected server error occurred.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
});
