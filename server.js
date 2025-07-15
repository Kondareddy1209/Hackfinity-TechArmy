// server.js - Node.js Backend for Digital Catalog Agent with Login/Signup & MongoDB (EJS Version)

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For JSON Web Tokens

const app = express();
const PORT = process.env.PORT || 5000;

// --- MongoDB Connection Details ---
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "digital_catalog_db";
const PRODUCTS_COLLECTION_NAME = process.env.COLLECTION_NAME || "products";
const USERS_COLLECTION_NAME = process.env.USERS_COLLECTION_NAME || "users";

// --- JWT Secret ---
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined. Please set it in your .env file.");
    process.exit(1);
}

let db; // Variable to hold the connected database instance

// Connect to MongoDB Atlas
async function connectToMongoDB() {
    try {
        const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        db = client.db(DB_NAME);
        console.log("Successfully connected to MongoDB Atlas!");
    } catch (error) {
        console.error("Could not connect to MongoDB Atlas:", error);
        process.exit(1); // Exit the process if unable to connect to DB
    }
}

// --- Express Configuration ---
// Set EJS as the view engine
app.set('view engine', 'ejs');
// Specify the directory where EJS templates are located
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve static files (CSS, client-side JS) from the 'public' directory
// Note: index.html is now index.ejs and served via res.render
app.use(express.static(path.join(__dirname, 'public')));

// --- Authentication Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Middleware to check for Admin role
function authorizeAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: Admin role required.' });
    }
    next();
}

// --- Core Logic: Product Description Generation (Simulated AI) ---
function generateDescription(name, category) {
    const templates = {
        "vegetables": `Farm-fresh ${name}, perfect for healthy meals and cooking.`,
        "fruits": `Juicy, ripe ${name} for a sweet treat or healthy snack.`,
        "handicrafts": `Beautifully handmade ${name}, a unique piece of art.`,
        "grains": `High-quality ${name}, essential for a balanced diet.`,
        "dairy": `Fresh ${name} products, rich in nutrients.`,
        "spices": `Aromatic ${name}, adding flavor to your dishes.`,
        "clothing": `Comfortable and stylish ${name} for everyday wear.`,
        "electronics": `Innovative ${name} with cutting-edge features.`
    };
    return templates[category.toLowerCase()] || `Quality ${name} available now. A versatile product for various uses.`;
}

// --- API Routes ---

// Route to render the main EJS template
app.get('/', (req, res) => {
    res.render('index'); // Renders views/index.ejs
});

// --- User Authentication Routes ---

// Signup Route
app.post('/api/signup', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: 'Please provide username, password, and role.' });
    }
    if (role !== 'user' && role !== 'admin') {
        return res.status(400).json({ success: false, message: 'Invalid role. Must be "user" or "admin".' });
    }

    try {
        const usersCollection = db.collection(USERS_COLLECTION_NAME);
        const existingUser = await usersCollection.findOne({ username });

        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            username,
            password: hashedPassword,
            role,
            createdAt: new Date()
        };

        await usersCollection.insertOne(newUser);
        res.status(201).json({ success: true, message: 'User registered successfully!' });

    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Please provide username and password.' });
    }

    try {
        const usersCollection = db.collection(USERS_COLLECTION_NAME);
        const user = await usersCollection.findOne({ username });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const token = jwt.sign(
            { id: user._id.toString(), username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ success: true, message: 'Login successful!', token, role: user.role });

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});


// --- Protected Routes (Require Authentication) ---

// User-specific Product Routes
app.post('/api/products/add', authenticateToken, async (req, res) => {
    const { name, category, quantity, customDescription } = req.body;
    const userId = req.user.id;

    if (!name || !category || quantity === undefined || quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Missing or invalid product details.' });
    }

    const description = customDescription || generateDescription(name, category);

    const productDoc = {
        userId: new ObjectId(userId),
        name,
        category,
        quantity: parseInt(quantity),
        description,
        createdAt: new Date()
    };

    try {
        const productsCollection = db.collection(PRODUCTS_COLLECTION_NAME);
        const result = await productsCollection.insertOne(productDoc);
        const insertedProduct = { ...productDoc, id: result.insertedId.toString() };
        res.status(201).json({ success: true, product: insertedProduct });
    } catch (error) {
        console.error("Error adding product to MongoDB:", error);
        res.status(500).json({ success: false, message: 'Failed to add product to database.' });
    }
});

app.get('/api/products/my', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const productsCollection = db.collection(PRODUCTS_COLLECTION_NAME);
        const products = await productsCollection.find({ userId: new ObjectId(userId) }).toArray();
        const formattedProducts = products.map(product => ({
            id: product._id.toString(),
            name: product.name,
            category: product.category,
            quantity: product.quantity,
            description: product.description
        }));
        res.json(formattedProducts);
    } catch (error) {
        console.error("Error fetching user catalog from MongoDB:", error);
        res.status(500).json({ success: false, message: 'Failed to retrieve catalog from database.' });
    }
});

app.post('/api/products/update', authenticateToken, async (req, res) => {
    const { id, name, category, quantity, description } = req.body;
    const userId = req.user.id;

    if (!id || !name || !category || quantity === undefined || quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Missing or invalid product details for update.' });
    }

    try {
        const objectId = new ObjectId(id);
        const productsCollection = db.collection(PRODUCTS_COLLECTION_NAME);

        const updateResult = await productsCollection.updateOne(
            { _id: objectId, userId: new ObjectId(userId) },
            { $set: { name, category, quantity: parseInt(quantity), description } }
        );

        if (updateResult.matchedCount > 0) {
            const updatedProductDoc = await productsCollection.findOne({ _id: objectId });
            if (updatedProductDoc) {
                const formattedProduct = { ...updatedProductDoc, id: updatedProductDoc._id.toString() };
                delete formattedProduct._id;
                res.json({ success: true, product: formattedProduct });
            } else {
                res.status(500).json({ success: false, message: 'Product updated but not found for retrieval.' });
            }
        } else {
            return res.status(404).json({ success: false, message: 'Product not found or unauthorized.' });
        }
    } catch (error) {
        console.error("Error updating product in MongoDB:", error);
        res.status(500).json({ success: false, message: 'Failed to update product in database.' });
    }
});

app.post('/api/products/delete', authenticateToken, async (req, res) => {
    const { id } = req.body;
    const userId = req.user.id;

    if (!id) {
        return res.status(400).json({ success: false, message: 'Missing product ID for deletion.' });
    }

    try {
        const objectId = new ObjectId(id);
        const productsCollection = db.collection(PRODUCTS_COLLECTION_NAME);

        const deleteResult = await productsCollection.deleteOne({ _id: objectId, userId: new ObjectId(userId) });

        if (deleteResult.deleted_count > 0) {
            res.json({ success: true, message: 'Product deleted successfully.' });
        } else {
            return res.status(404).json({ success: false, message: 'Product not found or unauthorized.' });
        }
    } catch (error) {
        console.error("Error deleting product from MongoDB:", error);
        res.status(500).json({ success: false, message: 'Failed to delete product from database.' });
    }
});

// Admin-specific Routes
app.get('/api/admin/all_products', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const productsCollection = db.collection(PRODUCTS_COLLECTION_NAME);
        const products = await productsCollection.find({}).toArray();
        const formattedProducts = products.map(product => ({
            id: product._id.toString(),
            userId: product.userId.toString(),
            name: product.name,
            category: product.category,
            quantity: product.quantity,
            description: product.description,
            createdAt: product.createdAt
        }));
        res.json(formattedProducts);
    } catch (error) {
        console.error("Error fetching all products for admin:", error);
        res.status(500).json({ success: false, message: 'Failed to retrieve all products.' });
    }
});

app.get('/api/admin/users', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const usersCollection = db.collection(USERS_COLLECTION_NAME);
        const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray(); // Exclude password hash
        const formattedUsers = users.map(user => ({
            id: user._id.toString(),
            username: user.username,
            role: user.role,
            createdAt: user.createdAt
        }));
        res.json(formattedUsers);
    } catch (error) {
        console.error("Error fetching users for admin:", error);
        res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
    }
});

// Start the server after connecting to MongoDB
connectToMongoDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Node.js server running on http://localhost:${PORT}`);
        console.log(`Access the application at http://localhost:${PORT}`);
    });
});
