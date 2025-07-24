// C:\Users\Konda Reddy\OneDrive\Desktop\Hackfinity-TechArmy\middleware\authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../Models/User');

const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_fallback';

const requireAuth = (req, res, next) => {
    const token = req.cookies.jwt;
    const isApiRequest = req.originalUrl.startsWith('/api/') || req.originalUrl.startsWith('/admin/products') || req.originalUrl.startsWith('/user/listings');

    if (token) {
        jwt.verify(token, jwtSecret, async (err, decodedToken) => {
            if (err) {
                console.log('JWT verification error in requireAuth:', err.message);
                if (isApiRequest) {
                    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token.' });
                }
                res.redirect('/auth/login');
            } else {
                try {
                    const user = await User.findById(decodedToken.id);
                    if (!user) {
                        console.log('User not found in DB for decoded token ID:', decodedToken.id);
                        if (isApiRequest) {
                            return res.status(401).json({ success: false, error: 'Unauthorized: User not found.' });
                        }
                        return res.redirect('/auth/login');
                    }
                    res.locals.user = user;

                    if (req.originalUrl.startsWith('/admin') && user.role !== 'admin') {
                        console.warn(`Access denied: User ${user.email} (Role: ${user.role}) attempted to access admin route: ${req.originalUrl}`);
                        if (isApiRequest) {
                            return res.status(403).json({ success: false, error: 'Access Denied: You do not have administrator privileges.' });
                        }
                        return res.status(403).render('403', { title: 'Access Denied', user: user, message: 'You do not have permission to view this page.' });
                    }

                    next();
                } catch (dbError) {
                    console.error('Database error during user lookup in requireAuth:', dbError);
                    if (isApiRequest) {
                        return res.status(500).json({ success: false, error: 'Server error during authentication check.' });
                    }
                    res.redirect('/auth/login');
                }
            }
        });
    } else {
        console.log('No JWT token found in cookies for requireAuth.');
        if (isApiRequest) {
            return res.status(401).json({ success: false, error: 'Unauthorized: No authentication token provided.' });
        }
        res.redirect('/auth/login');
    }
};

const checkUser = (req, res, next) => {
    const token = req.cookies.jwt;

    if (token) {
        jwt.verify(token, jwtSecret, async (err, decodedToken) => {
            if (err) {
                console.log('checkUser JWT verification error:', err.message);
                res.locals.user = null;
                next();
            } else {
                try {
                    const user = await User.findById(decodedToken.id);
                    res.locals.user = user;
                } catch (dbErr) {
                    console.error('Database error fetching user in checkUser:', dbErr);
                    res.locals.user = null;
                }
                next();
            }
        });
    } else {
        res.locals.user = null;
        next();
    }
};

module.exports = { requireAuth, checkUser };
