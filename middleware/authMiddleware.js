// This is a basic placeholder for your authentication middleware.
// You'll need to fill this with your actual authentication logic (e.g., JWT verification).

const jwt = require('jsonwebtoken'); // You'll need to install jsonwebtoken: npm install jsonwebtoken
const User = require('../models/User'); // Add this import if not present

// Replace with your actual JWT secret key
const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_fallback';

const requireAuth = (req, res, next) => {
    const token = req.cookies.jwt; // Assuming your JWT is stored in a cookie named 'jwt'

    // Check json web token exists & is verified
    if (token) {
        jwt.verify(token, jwtSecret, (err, decodedToken) => {
            if (err) {
                console.log(err.message);
                // Redirect to login or send unauthorized status
                res.redirect('/auth/login'); // Example: redirect to login page
            } else {
                console.log(decodedToken); // Log the decoded token payload
                // You can attach user info to req.user here if needed
                next(); // Proceed to the next middleware/route handler
            }
        });
    } else {
        // No token found, redirect to login or send unauthorized status
        res.redirect('/auth/login'); // Example: redirect to login page
    }
};

// Add other middleware functions here if needed, e.g., checkUser
const checkUser = (req, res, next) => {
    const token = req.cookies.token || req.cookies.jwt; // Support both possible cookie names

    if (token) {
        jwt.verify(token, jwtSecret, async (err, decodedToken) => {
            if (err) {
                console.log(err.message);
                res.locals.user = null; // No user
                next();
            } else {
                try {
                    // Fetch the full user from DB
                    const user = await User.findById(decodedToken.id);
                    res.locals.user = user;
                } catch (dbErr) {
                    console.log('Error fetching user in checkUser:', dbErr);
                    res.locals.user = null;
                }
                next();
            }
        });
    } else {
        res.locals.user = null; // No user
        next();
    }
};


module.exports = { requireAuth, checkUser };