const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true // Product names should ideally be unique
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    imageUrl: {
        type: String,
        default: '/images/default_product.png' // Default image for products
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    keywords: {
        type: [String], // Array of strings for keywords
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Product', productSchema);