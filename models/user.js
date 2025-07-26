// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true, // First name is always required
        trim: true
    },
    lastName: {
        type: String,
        required: true, // Last name is always required
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true, // Enforces unique emails
        match: [/.+@.+\..+/, 'Please enter a valid email address'],
        lowercase: true, // Store email in lowercase for consistent lookups
        trim: true
    },
    mobile: {
        type: String,
        required: function() {
            // Mobile is required only if googleId is NOT provided (for traditional signup)
            return !this.googleId;
        },
        unique: function() {
            // Mobile is unique only if it's provided (not null/undefined)
            // This prevents multiple Google users (who might not have mobile) from conflicting on a null unique value
            return this.mobile != null;
        },
        match: [/^\d{10}$/, 'Please enter a valid 10-digit mobile number'],
        trim: true
    },
    password: {
        type: String,
        required: function() {
            // Password is required only if googleId is NOT provided
            return !this.googleId;
        },
        minlength: 6
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        required: function() {
            // Gender is required only if googleId is NOT provided (for traditional signup)
            return !this.googleId;
        }
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    isVerified: { // Added for email verification
        type: Boolean,
        default: false
    },
    profilePicture: {
        type: String,
        default: '/images/default_image.png' // Default profile image
    },
    // NEW FIELD FOR GOOGLE SIGNUP
    googleId: {
        type: String,
        unique: true, // Enforces unique Google IDs
        sparse: true // Allows null values, so users without googleId don't violate unique constraint
    },
    // NEW FIELD: To explicitly track the authentication provider
    provider: {
        type: String,
        enum: ['email', 'google'],
        default: 'email'
    }
}, { timestamps: true }); // Adds createdAt and updatedAt

// Hash password before saving
userSchema.pre('save', async function(next) {
    // Only hash if password field is present and has been modified
    if (this.password && this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

// Method to compare passwords
userSchema.methods.matchPassword = async function(enteredPassword) {
    // Only attempt to compare if a password exists for this user
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);