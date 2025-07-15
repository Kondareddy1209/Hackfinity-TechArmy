// routes/admin.js - Handles admin-specific functionalities

const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAdmin } = require('../utils/authMiddleware'); // Import auth middleware
const { getProductsCollection } = require('../models/product'); // Import product collection access
const { getUsersCollection } = require('../models/user'); // Import user collection access

// Admin route to view all catalog entries (requires admin role)
router.get('/admin/all_products', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const productsCollection = getProductsCollection();
        const products = await productsCollection.find({}).toArray(); // Get all products
        const formattedProducts = products.map(product => ({
            id: product._id.toString(),
            userId: product.userId.toString(), // Also return userId for admin view
            name: product.name,
            category: product.category,
            quantity: product.quantity,
            description: product.description,
            createdAt: product.createdAt
        }));
        res.json(formattedProducts);
    } catch (error) {
        console.error("Error fetching all products for admin:", error);
        res.status(500).json({ success: false, message: 'Failed to retrieve all products.' });
    }
});

// Admin route to view all registered users (requires admin role)
router.get('/admin/users', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const usersCollection = getUsersCollection();
        // Exclude password hash from results for security
        const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
        const formattedUsers = users.map(user => ({
            id: user._id.toString(),
            username: user.username,
            role: user.role,
            createdAt: user.createdAt
        }));
        res.json(formattedUsers);
    } catch (error) {
        console.error("Error fetching users for admin:", error);
        res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
    }
});

module.exports = router;
