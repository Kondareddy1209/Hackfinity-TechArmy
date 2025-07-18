const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    username: { type: String, required: true },
    otp: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now, expires: 300 } // expires after 5 minutes
});

module.exports = mongoose.model('Otp', otpSchema);