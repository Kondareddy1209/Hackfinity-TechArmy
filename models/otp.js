// models/otp.js - Provides access to the OTP verifications collection

const { getDb } = require('../utils/db');

function getOtpCollection() {
    const db = getDb();
    // Ensure the collection name is correctly retrieved from .env
    return db.collection(process.env.OTP_COLLECTION_NAME || "otp_verifications");
}

module.exports = { getOtpCollection };
