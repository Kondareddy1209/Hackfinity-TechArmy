// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For password hashing and comparison

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true, // First name is always required for all users
        trim: true // Trim whitespace from the beginning and end
    },
    lastName: {
        type: String,
        // lastName is required ONLY IF a googleId is NOT provided.
        // This accommodates Google users who might not have a family_name in their profile.
        required: function() {
            return !this.googleId;
        },
        trim: true,
        default: '' // Provides a default empty string if not required and not explicitly provided
    },
    email: {
        type: String,
        required: true, // Email is always required
        unique: true, // Ensures email addresses are unique across all users
        match: [/.+@.+\..+/, 'Please enter a valid email address'], // Regex for email format validation
        lowercase: true, // Stores email addresses in lowercase for consistent lookups and uniqueness checks
        trim: true
    },
    mobile: {
        type: String,
        // Mobile is required ONLY IF a googleId is NOT provided (for traditional signup).
        required: function() {
            return !this.googleId;
        },
        unique: true, // Ensures mobile numbers are unique.
        // IMPORTANT: sparse: true allows multiple documents to have a null value for this field
        // without violating the unique constraint. This is crucial for Google Sign-ins
        // where mobile numbers are not provided.
        sparse: true,
        match: [/^\d{10}$/, 'Please enter a valid 10-digit mobile number'], // Regex for 10-digit mobile validation
        trim: true
    },
    password: {
        type: String,
        // Password is required ONLY IF a googleId is NOT provided.
        required: function() {
            return !this.googleId;
        },
        minlength: 6 // Minimum length for the password
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'], // Allowed values for gender
        // Gender is required ONLY IF a googleId is NOT provided (for traditional signup).
        required: function() {
            return !this.googleId;
        }
    },
    role: {
        type: String,
        enum: ['user', 'admin'], // Allowed roles for users
        default: 'user' // Default role is 'user'
    },
    isVerified: {
        type: Boolean,
        default: false // Default to false, typically set to true after email/OTP verification or Google sign-in
    },
    profilePicture: {
        type: String,
        default: '/images/default_image.png' // Default profile image path
    },
    createdAt: {
        type: Date,
        default: Date.now // Automatically sets the creation timestamp
    },
    // Field to store Google's unique user ID for Google Sign-In
    googleId: {
        type: String,
        unique: true, // Ensures each Google ID is unique.
        // sparse: true allows null values (for non-Google users) without violating the unique constraint.
        sparse: true
    },
    // Field to explicitly track the authentication provider (e.g., 'email' or 'google')
    provider: {
        type: String,
        enum: ['email', 'google'],
        default: 'email' // Default provider is 'email'
    }
}, {
    timestamps: true // Adds `createdAt` and `updatedAt` fields automatically
});

// Mongoose pre-save hook to hash the password before saving a user document.
// This runs only if the password field is present AND has been modified (or is new).
userSchema.pre('save', async function(next) {
    if (this.password && this.isModified('password')) {
        const salt = await bcrypt.genSalt(10); // Generate a salt for hashing
        this.password = await bcrypt.hash(this.password, salt); // Hash the password
    }
    next(); // Proceed to the next middleware or save operation
});

// Instance method to compare an entered password with the hashed password stored in the database.
userSchema.methods.matchPassword = async function(enteredPassword) {
    // If the user has no password stored (e.g., a Google-only account), it cannot match
    if (!this.password) {
        return false;
    }
    return await bcrypt.compare(enteredPassword, this.password); // Compare the entered password with the stored hash
};

module.exports = mongoose.model('User', userSchema); // Export the User model
