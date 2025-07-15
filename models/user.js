// models/user.js - Provides access to the users collection

const { getDb } = require('../utils/db');

function getUsersCollection() {
    const db = getDb();
    // Ensure the collection name is correctly retrieved from .env
    return db.collection(process.env.USERS_COLLECTION_NAME || "users");
}

module.exports = { getUsersCollection };
