// routes/products.js - Handles user-specific product management

const express = require('express');
const router = express.Router();
const { ObjectId } = require('../utils/db'); // Import ObjectId from db utility
const { authenticateToken } = require('../utils/authMiddleware'); // Import auth middleware
const { getProductsCollection } = require('../models/product'); // Import product collection access
const { generateDescription } = require('../utils/helpers'); // Import helper function

// Add Product Route
router.post('/products/add', authenticateToken, async (req, res) => {
    const { name, category, quantity, customDescription } = req.body;
    const userId = req.user.id; // Get user ID from JWT payload

    if (!name || !category || quantity === undefined || quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Missing or invalid product details.' });
    }

    const description = customDescription || generateDescription(name, category);

    const productDoc = {
        userId: new ObjectId(userId), // Link product to the user
        name,
        category,
        quantity: parseInt(quantity),
        description,
        createdAt: new Date()
    };

    try {
        const productsCollection = getProductsCollection();
        const result = await productsCollection.insertOne(productDoc);
        const insertedProduct = { ...productDoc, id: result.insertedId.toString() };
        res.status(201).json({ success: true, product: insertedProduct });
    } catch (error) {
        console.error("Error adding product to MongoDB:", error);
        res.status(500).json({ success: false, message: 'Failed to add product to database.' });
    }
});

// Get User's Products Route
router.get('/products/my', authenticateToken, async (req, res) => {
    const userId = req.user.id; // Get user ID from JWT payload

    try {
        const productsCollection = getProductsCollection();
        // Find products only for the authenticated user
        const products = await productsCollection.find({ userId: new ObjectId(userId) }).toArray();
        const formattedProducts = products.map(product => ({
            id: product._id.toString(),
            name: product.name,
            category: product.category,
            quantity: product.quantity,
            description: product.description
        }));
        res.json(formattedProducts);
    } catch (error) {
        console.error("Error fetching user catalog from MongoDB:", error);
        res.status(500).json({ success: false, message: 'Failed to retrieve catalog from database.' });
    }
});

// Update Product Route
router.post('/products/update', authenticateToken, async (req, res) => {
    const { id, name, category, quantity, description } = req.body;
    const userId = req.user.id;

    if (!id || !name || !category || quantity === undefined || quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Missing or invalid product details for update.' });
    }

    try {
        const objectId = new ObjectId(id);
        const productsCollection = getProductsCollection();
        
        // Ensure user can only update their own products
        const updateResult = await productsCollection.updateOne(
            { _id: objectId, userId: new ObjectId(userId) },
            { $set: { name, category, quantity: parseInt(quantity), description } }
        );

        if (updateResult.matchedCount > 0) {
            const updatedProductDoc = await productsCollection.findOne({ _id: objectId });
            if (updatedProductDoc) {
                const formattedProduct = { ...updatedProductDoc, id: updatedProductDoc._id.toString() };
                delete formattedProduct._id;
                res.json({ success: true, product: formattedProduct });
            } else {
                res.status(500).json({ success: false, message: 'Product updated but not found for retrieval.' });
            }
        } else {
            return res.status(404).json({ success: false, message: 'Product not found or unauthorized.' });
        }
    } catch (error) {
        console.error("Error updating product in MongoDB:", error);
        res.status(500).json({ success: false, message: 'Failed to update product in database.' });
    }
});

// Delete Product Route
router.post('/products/delete', authenticateToken, async (req, res) => {
    const { id } = req.body;
    const userId = req.user.id;

    if (!id) {
        return res.status(400).json({ success: false, message: 'Missing product ID for deletion.' });
    }

    try {
        const objectId = new ObjectId(id);
        const productsCollection = getProductsCollection();

        // Ensure user can only delete their own products
        const deleteResult = await productsCollection.deleteOne({ _id: objectId, userId: new ObjectId(userId) });

        if (deleteResult.deletedCount > 0) {
            res.json({ success: true, message: 'Product deleted successfully.' });
        } else {
            return res.status(404).json({ success: false, message: 'Product not found or unauthorized.' });
        }
    } catch (error) {
        console.error("Error deleting product from MongoDB:", error);
        res.status(500).json({ success: false, message: 'Failed to delete product from database.' });
    }
});

module.exports = router;
