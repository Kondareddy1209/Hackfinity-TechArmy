const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/.+@.+\..+/, 'Please enter a valid email address'],
        lowercase: true,
        trim: true
    },
    mobile: {
        type: String,
        required: true,
        unique: true,
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
    createdAt: {
        type: Date,
        default: Date.now
    },
    // NEW FIELD FOR GOOGLE SIGNUP
    googleId: {
        type: String,
        unique: true,
        sparse: true // Allows null values, so users without googleId don't violate unique constraint
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (this.password && this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

// Method to compare passwords
userSchema.methods.matchPassword = async function(enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);