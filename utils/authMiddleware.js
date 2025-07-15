// utils/authMiddleware.js - JWT Authentication and Authorization Middleware

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in authMiddleware. Please set it in your .env file.");
    process.exit(1); // Exit if secret is missing, as security is compromised
}

// Middleware to check for a valid JWT in the request header
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

    if (token == null) {
        return res.status(401).json({ message: 'Authentication token required.' }); // If no token, unauthorized
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT verification failed:", err.message);
            return res.status(403).json({ message: 'Invalid or expired token.' }); // If token is invalid/expired, forbidden
        }
        req.user = user; // Attach user payload (e.g., { id: userId, role: userRole }) to request
        next(); // Proceed to the next middleware/route handler
    });
}

// Middleware to check for Admin role
function authorizeAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: Admin role required.' });
    }
    next();
}

module.exports = { authenticateToken, authorizeAdmin };
