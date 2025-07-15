// models/product.js - Provides access to the products collection

const { getDb } = require('../utils/db');

function getProductsCollection() {
    const db = getDb();
    return db.collection(process.env.PRODUCTS_COLLECTION_NAME || "products");
}

module.exports = { getProductsCollection };
