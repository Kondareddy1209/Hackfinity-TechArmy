// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: {
        type: String,
        unique: true,
        sparse: true // Allows null values, so users without pending verification don't need this field
    },
    verificationTokenExpires: {
        type: Date
    },
    isAdmin: { // Add this if you plan to implement the 'admin' role from your flowchart
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', UserSchema);