const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    otp: {
        type: String,
        required: true
    },
    type: { // To differentiate between signup OTPs and password reset OTPs
        type: String,
        enum: ['signup', 'password_reset'],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // OTP expires in 5 minutes (300 seconds)
    }
});

module.exports = mongoose.model('Otp', otpSchema);