// utils/db.js - MongoDB Connection and Database Instance Export

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

let _db; // Private variable to hold the database instance

async function connectToMongoDB() {
    if (!_db) { // Only connect if not already connected
        try {
            const client = new MongoClient(MONGO_URI);
            await client.connect();
            _db = client.db(DB_NAME);
            console.log("MongoDB connection established successfully.");
        } catch (error) {
            console.error("MongoDB connection failed:", error);
            throw error; // Propagate error to app.js
        }
    }
    return _db;
}

function getDb() {
    if (!_db) {
        throw new Error("Database not initialized. Call connectToMongoDB first.");
    }
    return _db;
}

// Export ObjectId for use in other modules
module.exports = { connectToMongoDB, getDb, ObjectId };
