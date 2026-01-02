// C:\Users\Konda Reddy\OneDrive\Desktop\Hackfinity-TechArmy\routes\dashboardRoutes.js

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const Product = require('../models/Product'); // Mongoose Product model
const User = require('../models/User'); // Mongoose User model
const { requireAuth } = require('../middleware/authMiddleware');
const admin = require('firebase-admin');

// NEW: Firebase Storage setup
const { getStorage } = require('firebase-admin/storage');
let bucket;
try {
    // Ensure admin.apps.length is checked before calling getStorage() as admin.initializeApp is in app.js
    // Assuming Firebase Admin SDK is already initialized by app.js before this module runs.
    bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
    console.log("[dashboardRoutes] Firebase Storage bucket initialized.");
} catch (error) {
    console.error("[dashboardRoutes] ERROR: Failed to initialize Firebase Storage bucket:", error.message);
}


// --- For Excel Upload ---
const multer = require('multer');
const xlsx = require('xlsx');

// Multer setup for Excel file upload: store in memory temporarily
const uploadExcel = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        } else {
            cb(new Error('Only .xlsx and .xls files are allowed!'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for Excel files
});


// --- Mock/Placeholder Services for Audio/Image Processing (keeping your existing mocks) ---
async function transcribeAudio(audioBuffer) {
    console.log(`[Server Mock STT] Received audio buffer of size ${audioBuffer.length} bytes.`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("[Server Mock STT] Simulating transcription complete.");
    return "This is a mock transcription of your audio input. What would you like to ask Groq?";
}

async function analyzeImage(imageBuffer, userId, query) {
    console.log(`[Server Mock Image Analysis] Received image buffer of size ${imageBuffer.length} bytes for user ${userId}. Optional Query: "${query}"`);
    await new Promise(resolve => setTimeout(resolve, 2500));
    console.log("[Server Mock Image Analysis] Simulating image analysis complete.");
    const mockKeywords = ["eco-friendly", "handmade", "sustainable", "organic", "apple"];
    return {
        description: `This is a mock analysis of the image provided. It looks like a product related to natural living.`,
        keywords: mockKeywords,
        query: query
    };
}
// --- End Mock Services ---

// Groq and Gemini imports
let getGroqChatCompletion;
let generateProductDescription;

try {
    const groqAgent = require('../services/groqAgent');
    getGroqChatCompletion = groqAgent.getGroqChatCompletion;
    console.log("[dashboardRoutes] getGroqChatCompletion imported successfully.");
} catch (error) {
    console.error("[dashboardRoutes] Error importing groqAgent:", error.message);
    getGroqChatCompletion = () => "Groq AI service not available due to import error.";
}

try {
    const geminiAgent = require('../services/geminiAgent');
    generateProductDescription = geminiAgent.generateProductDescription;
    console.log("[dashboardRoutes] generateProductDescription imported successfully.");
} catch (error) {
    console.error("[dashboardRoutes] Error importing geminiAgent:", error.message);
    generateProductDescription = () => "Gemini AI service not available due to import error.";
}

// NEW: Helper function to upload buffer to Firebase Storage
async function uploadToFirebaseStorage(fileBuffer, destinationPath, mimetype) {
    if (!bucket) {
        throw new Error("Firebase Storage bucket not initialized. Check FIREBASE_STORAGE_BUCKET in .env");
    }
    const file = bucket.file(destinationPath);
    await file.save(fileBuffer, {
        metadata: { contentType: mimetype },
        public: true, // Make the file publicly accessible
        predefinedAcl: 'publicRead' // Ensure public readability
    });
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    console.log(`File uploaded to Firebase Storage: ${publicUrl}`);
    return publicUrl;
}


router.get('/api/products', requireAuth, async (req, res) => {
    console.log("[Server] /api/products route accessed.");
    const user = res.locals.user;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const searchQuery = req.query.q ? req.query.q.toLowerCase() : '';
    const categoryFilter = req.query.category ? req.query.category.toLowerCase() : '';

    const skip = (page - 1) * limit;

    try {
        let query = {};
        if (searchQuery) {
            query.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } },
                { category: { $regex: searchQuery, $options: 'i' } },
                { keywords: { $elemMatch: { $regex: searchQuery, $options: 'i' } } }
            ];
        }
        if (categoryFilter && categoryFilter !== 'all') {
            if (query.$or) {
                query = { $and: [query, { category: { $regex: categoryFilter, $options: 'i' } }] };
            } else {
                query.category = { $regex: categoryFilter, $options: 'i' };
            }
        }

        const totalProducts = await Product.countDocuments(query);
        const products = await Product.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        console.log(`[Server] MongoDB products fetched: ${products.length} (Total matching: ${totalProducts}).`);

        res.json({
            products: products,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            limit
        });

    } catch (error) {
        console.error('[Server] Error fetching products for API:', error);
        res.status(500).json({ success: false, message: 'Failed to load products. Please try again.', error: error.message });
    }
});


router.get('/dashboard', async (req, res) => {
    console.log("[Server] /dashboard route accessed.");
    try {
        const user = res.locals.user;
        if (!user) {
            console.log("[Server] /dashboard: No user, redirecting to login.");
            return res.redirect('/auth/login');
        }
        console.log(`[Server] /dashboard: User ${user.email} (${user.role}) authenticated.`);

        if (user.role === 'admin') {
            console.log("[Server] /dashboard: User is admin. Fetching admin data.");
            const totalUsers = await User.countDocuments({});
            const adminUsers = await User.countDocuments({ role: 'admin' });
            const recentSignups = await User.find({})
                .sort({ createdAt: -1 })
                .limit(5);
            console.log("[Server] /dashboard: Admin data fetched. Rendering admin_dashboard.");
            res.render('admin_dashboard', {
                user: user,
                totalUsers: totalUsers,
                adminUsers: adminUsers,
                recentSignups: recentSignups
            });
        } else {
            console.log("[Server] /dashboard: User is not admin, redirecting to user_dashboard.");
            return res.redirect('/user_dashboard');
        }

    } catch (error) {
        console.error('[Server] Error rendering dashboard:', error);
        res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: 'Failed to load dashboard data.' });
    }
});

router.get('/user_dashboard', (req, res) => {
    console.log("[Server] /user_dashboard route accessed.");
    const user = res.locals.user;
    if (!user) {
        console.log("[Server] /user_dashboard: No user, redirecting to login.");
        return res.redirect('/auth/login');
    }
    console.log(`[Server] /user_dashboard: User ${user.email} (${user.role}) authenticated.`);

    if (user.role === 'admin') {
        console.log("[Server] /user_dashboard: User is admin, redirecting to admin dashboard.");
        return res.redirect('/dashboard');
    }
    console.log("[Server] /user_dashboard: Rendering user_dashboard.");
    res.render('user_dashboard', { user: user });
});

router.get('/admin/products/add', async (req, res) => {
    console.log("[Server] /admin/products/add route accessed.");
    const user = res.locals.user;
    if (!user || user.role !== 'admin') {
        console.warn("[Server] /admin/products/add: Access denied for non-admin user.");
        return res.status(403).render('403', { title: 'Access Denied', user: user, message: 'You do not have permission to view this page.' });
    }
    console.log("[Server] /admin/products/add: Rendering add_product form.");
    res.render('add_product', { user: user, error: null, message: null });
});

// UPDATED: Use Multer memory storage and upload to Firebase Storage
router.post('/admin/products', requireAuth, async (req, res) => {
    console.log("[Server] /admin/products POST route accessed.");
    const user = res.locals.user;
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Access Denied: Only administrators can add products.' });
    }

    const uploadSingleProductImageInMemory = multer({
        storage: multer.memoryStorage(), // Store in memory
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
        fileFilter: (req, file, cb) => {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed!'), false);
            }
        }
    }).single('image');

    uploadSingleProductImageInMemory(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer error during single product image upload:', err);
            return res.status(400).json({ success: false, error: err.message || 'File upload error.' });
        } else if (err) {
            console.error('Unknown error during single product image upload:', err);
            return res.status(500).json({ success: false, error: err.message || 'Server error during file upload.' });
        }

        const { name, description, price, imageUrl, category, keywords } = req.body;
        let finalImageUrl = imageUrl; // Use provided URL if any

        // Process uploaded file (if exists) via Firebase Storage
        if (req.file && req.file.buffer) {
            const uniqueFileName = `product_images/${Date.now()}-${req.file.originalname}`; // Path inside Firebase Storage bucket
            try {
                finalImageUrl = await uploadToFirebaseStorage(req.file.buffer, uniqueFileName, req.file.mimetype);
                console.log(`[Server] Product image uploaded to Firebase Storage: ${finalImageUrl}`);
            } catch (firebaseErr) {
                console.error('Error uploading to Firebase Storage:', firebaseErr);
                return res.status(500).json({ success: false, error: `Failed to upload image to cloud storage: ${firebaseErr.message}` });
            }
        } else if (!finalImageUrl || finalImageUrl.trim() === '') {
            finalImageUrl = '/images/default_product.png'; // Fallback to local default if no file and no URL
        }


        console.log(`[Server] /admin/products POST: Attempting to add product: ${name}`);

        if (!name || !description || !price || !category) {
            console.warn("[Server] /admin/products POST: Missing required fields.");
            return res.status(400).json({ success: false, error: 'Please fill all required fields.' });
        }
        if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
            console.warn("[Server] /admin/products POST: Invalid price.");
            return res.status(400).json({ success: false, error: 'Price must be a non-negative number.' });
        }

        try {
            const newProduct = new Product({
                name,
                description,
                price: parseFloat(price),
                imageUrl: finalImageUrl, // This will now be a Firebase Storage URL or a direct URL
                category,
                keywords: keywords ? String(keywords).split(',').map(k => k.trim()).filter(k => k.length > 0) : []
            });

            await newProduct.save();
            console.log(`[Server] /admin/products POST: Product "${newProduct.name}" added successfully to MongoDB with ID: ${newProduct._id}`);
            res.status(201).json({ success: true, message: 'Product added successfully!', product: newProduct });

        } catch (error) {
            console.error('[Server] Error in /admin/products POST route:', error);
            if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
                return res.status(409).json({ success: false, error: `Product with name "${error.keyValue.name}" already exists.` });
            }
            res.status(500).json({ success: false, error: error.message || 'Failed to add product due to a server error. Please try again.' });
        }
    });
});

router.post('/api/admin/products/bulk-upload', requireAuth, uploadExcel.single('excelFile'), async (req, res) => {
    console.log("[Server] /api/admin/products/bulk-upload POST route accessed.");
    const user = res.locals.user;

    if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Access Denied: Only administrators can perform bulk uploads.' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No Excel file uploaded or invalid file type.' });
    }

    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        if (rawData.length < 2) {
            return res.status(400).json({ message: 'Excel sheet is empty or only contains headers.' });
        }

        const headers = rawData[0].map(h => String(h).trim().toLowerCase().replace(/ /g, '_'));
        const rows = rawData.slice(1);

        let insertedCount = 0;
        let updatedCount = 0;
        const errors = [];

        const missingHeaders = ['product_name', 'price', 'category'].filter(
            header => !headers.includes(header)
        );

        if (missingHeaders.length > 0) {
            return res.status(400).json({
                message: 'Missing crucial columns in Excel file. Required: "Product Name", "Price", "Category".',
                details: missingHeaders
            });
        }

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumber = i + 2;

            const productData = {};
            headers.forEach((header, colIndex) => {
                productData[header] = row[colIndex];
            });

            let hasError = false;
            const currentErrors = [];

            const name = String(productData.product_name || '').trim();
            const description = String(productData.description || '').trim();
            const price = parseFloat(productData.price);
            const category = String(productData.category || '').trim();
            // Assuming 'image_url' or 'product_image' might be present in Excel
            const imageUrl = String(productData.image_url || productData.product_image || '').trim() || '/images/default_product.png';
            const keywords = String(productData.keywords || '')
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0);


            if (!name) {
                currentErrors.push('Missing Product Name');
                hasError = true;
            }
            if (!description) {
                currentErrors.push('Missing Description');
                hasError = true;
            }
            if (isNaN(price) || price < 0) {
                currentErrors.push('Invalid Price');
                hasError = true;
            }
            if (!category) {
                currentErrors.push('Missing Category');
                hasError = true;
            }

            if (hasError) {
                errors.push({ row_number: rowNumber, reason: currentErrors.join(', ') });
                continue;
            }

            try {
                const existingProduct = await Product.findOne({ name: name });

                if (existingProduct) {
                    await Product.updateOne(
                        { name: name },
                        {
                            description: description,
                            price: price,
                            category: category,
                            imageUrl: imageUrl, // Uses URL from Excel, not uploaded file
                            keywords: keywords,
                            updatedAt: new Date()
                        }
                    );
                    updatedCount++;
                } else {
                    const newProduct = new Product({
                        name: name,
                        description: description,
                        price: price,
                        category: category,
                        imageUrl: imageUrl, // Uses URL from Excel, not uploaded file
                        keywords: keywords,
                    });
                    await newProduct.save();
                    insertedCount++;
                }
            } catch (dbError) {
                if (dbError.code === 11000 && dbError.keyPattern && dbError.keyPattern.name) {
                    errors.push({ row_number: rowNumber, reason: `Duplicate Product Name: "${name}".` });
                } else {
                    console.error(`Database operation error for row ${rowNumber} (${name}):`, dbError);
                    errors.push({ row_number: rowNumber, reason: `Database error: ${dbError.message}` });
                }
            }
        }

        res.status(200).json({
            message: 'Bulk upload processed successfully.',
            insertedCount,
            updatedCount,
            errors,
        });

    } catch (parseError) {
        console.error('Error parsing Excel file or during upload:', parseError);
        res.status(500).json({ message: 'Error processing Excel file.', details: parseError.message });
    }
});


router.get('/user/product-generator', requireAuth, async (req, res) => { // Added requireAuth
    console.log("[Server] /user/product-generator route accessed.");
    const user = res.locals.user;
    if (!user) {
        console.log("[Server] /user/product-generator: No user, redirecting to login.");
        return res.redirect('/auth/login');
    }
    console.log("[Server] /user/product-generator: Rendering product_description_generator.");
    res.render('product_description_generator', { user: user, error: null, message: null });
});

router.get('/user/my-catalog', requireAuth, async (req, res) => { // Added requireAuth
    console.log("[Server] /user/my-catalog route accessed.");
    const user = res.locals.user;
    if (!user) {
        console.log("[Server] /user/my-catalog: No user, redirecting to login.");
        return res.redirect('/auth/login');
    }
    console.log("[Server] /user/my-catalog: Rendering my_product_catalog.");
    try {
        res.render('my_product_catalog', { user: user, products: [] });
    }
    catch (error) {
        console.error('[Server] Error rendering My Product Catalog:', error);
        res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: 'Failed to load your product catalog.' });
    }
});

router.get('/user/my-catalog/edit/:productId', requireAuth, async (req, res) => { // Added requireAuth
    console.log("[Server] /user/my-catalog/edit/:productId route accessed.");
    const user = res.locals.user;
    const productId = req.params.productId;
    console.log(`[Server] Fetching product for editing: ${productId}`);

    if (!user) {
        console.log("[Server] /user/my-catalog/edit: No user, redirecting to login.");
        return res.redirect('/auth/login');
    }

    try {
        const product = await Product.findById(productId).lean();

        if (!product) {
            console.warn(`[Server] Product ${productId} not found.`);
            return res.status(404).render('404', { title: 'Product Not Found', user: res.locals.user });
        }

        console.log(`[Server] Product ${productId} data fetched. Rendering edit_product.`);
        res.render('edit_product', { user: user, product: product, error: null, message: null });

    } catch (error) {
        console.error('[Server] Error rendering edit product page:', error);
        res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: 'Failed to load product for editing.' });
    }
});

router.post('/user/my-catalog/edit/:productId', requireAuth, async (req, res) => { // Added requireAuth
    console.log("[Server] /user/my-catalog/edit/:productId POST route accessed.");
    const user = res.locals.user;
    if (!user) {
        return res.redirect('/auth/login');
    }

    const { name, description, price, category, keywords, imageUrl } = req.body;
    const productId = req.params.productId;

    console.log(`[Server] Attempting to update product ${productId} with new data: ${name}`);

    if (!name || !description || !price || !category) {
        console.warn("[Server] /user/my-catalog/edit POST: Missing required fields for update.");
        try {
            const product = await Product.findById(productId).lean();
            return res.status(400).render('edit_product', { user: user, product: product, error: 'Product name, description, price, and category are required.', message: null });
        } catch (fetchError) {
            console.error('[Server] Error re-fetching product for validation error:', fetchError);
            res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: 'Error processing update.' });
        }
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
        console.warn("[Server] /user/my-catalog/edit POST: Invalid price for update.");
        try {
            const product = await Product.findById(productId).lean();
            return res.status(400).render('edit_product', { user: user, product: product, error: 'Price must be a non-negative number.', message: null });
        } catch (fetchError) {
            console.error('[Server] Error re-fetching product for validation error:', fetchError);
            res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: 'Error processing update.' });
        }
    }

    try {
        const updatedProduct = await Product.findByIdAndUpdate(productId, {
            name: name,
            description: description,
            price: parseFloat(price),
            category: category,
            imageUrl: imageUrl || '/images/default_product.png',
            keywords: keywords ? String(keywords).split(',').map(k => k.trim()).filter(k => k.length > 0) : [],
            updatedAt: new Date()
        }, { new: true, runValidators: true });

        if (!updatedProduct) {
            console.warn(`[Server] Product ${productId} not found for update.`);
            return res.status(404).render('404', { title: 'Product Not Found', user: res.locals.user });
        }

        console.log(`[Server] Product "${updatedProduct.name}" (ID: ${productId}) updated successfully.`);
        res.redirect('/user/my-catalog?message=' + encodeURIComponent('Product updated successfully!'));

    } catch (error) {
        console.error('[Server] Error updating product:', error);
        if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
            try {
                const product = await Product.findById(productId).lean();
                return res.status(409).render('edit_product', { user: user, product: product, error: `Product with name "${name}" already exists.`, message: null });
            } catch (fetchError) {
                console.error('[Server] Error re-fetching product for unique name error:', fetchError);
            }
        }
        res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: 'Failed to update product. Please try again.', message: null });
    }
});


router.get('/user/listings/add', requireAuth, async (req, res) => { // Added requireAuth
    console.log("[Server] /user/listings/add route accessed.");
    const user = res.locals.user;
    // Original code restricted this to admin, but user_listings/add typically means for a regular user to list something.
    // If you intend for regular users to add listings, you should remove the admin check here.
    if (!user /* || user.role !== 'admin' */) { // Decide if you want only admins or all users to add listings
        console.warn("[Server] /user/listings/add: Access denied for non-admin user.");
        return res.status(403).render('403', { title: 'Access Denied', user: user, message: 'You do not have permission to view this page.' });
    }
    console.log("[Server] /user/listings/add: Rendering add_listing form.");
    res.render('add_listing', { user: user, error: null, message: null });
});

const { IncomingForm } = require('formidable');
// UPDATED: Use Multer memory storage and upload to Firebase Storage
router.post('/user/listings', requireAuth, async (req, res) => {
    console.log("[Server] /user/listings POST route accessed for image upload.");
    const user = res.locals.user;

    const uploadListingImageInMemory = multer({
        storage: multer.memoryStorage(), // Store in memory
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
        fileFilter: (req, file, cb) => {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed!'), false);
            }
        }
    }).single('image'); // Assuming the input field name is 'image'

    uploadListingImageInMemory(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer error during public listing image upload:', err);
            return res.status(400).json({ success: false, error: err.message || 'File upload error.' });
        } else if (err) {
            console.error('Unknown error during public listing image upload:', err);
            return res.status(500).json({ success: false, error: err.message || 'Server error during file upload.' });
        }

        const { name, description, price, imageUrl, category, contactInfo } = req.body; // Assuming 'contactInfo' is in your Product model
        let finalImageUrl = imageUrl; // Use provided URL if any

        // Process uploaded file (if exists) via Firebase Storage
        if (req.file && req.file.buffer) {
            const uniqueFileName = `listing_images/${Date.now()}-${req.file.originalname}`; // Path inside Firebase Storage bucket
            try {
                finalImageUrl = await uploadToFirebaseStorage(req.file.buffer, uniqueFileName, req.file.mimetype);
                console.log(`[Server] Public listing image uploaded to Firebase Storage: ${finalImageUrl}`);
            } catch (firebaseErr) {
                console.error('Error uploading to Firebase Storage:', firebaseErr);
                return res.status(500).json({ success: false, error: `Failed to upload image to cloud storage: ${firebaseErr.message}` });
            }
        } else if (!finalImageUrl || finalImageUrl.trim() === '') {
            finalImageUrl = '/images/default_product.png'; // Fallback to local default if no file and no URL
        }

        console.log(`[Server] /user/listings POST: Attempting to add product: ${name}`);

        if (!name || !description || !price || !category) {
            console.warn("[Server] /user/listings POST: Missing required fields.");
            return res.status(400).json({ success: false, error: 'Please fill all required fields.' });
        }
        if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
            console.warn("[Server] /user/listings POST: Invalid price.");
            return res.status(400).json({ success: false, error: 'Price must be a non-negative number.' });
        }

        try {
            const newProduct = new Product({
                name,
                description,
                price: parseFloat(price),
                imageUrl: finalImageUrl, // This will now be a Firebase Storage URL or a direct URL
                category,
                contactInfo: contactInfo, // Ensure this field exists in your Product model
                keywords: [], // Assuming keywords array is also handled if present in form
            });

            await newProduct.save();
            console.log(`[Server] Public listing "${newProduct.name}" added successfully to MongoDB Product collection with ID: ${newProduct._id}`);
            res.status(201).json({ success: true, message: 'Product listing added successfully!', listing: newProduct });

        } catch (error) {
            console.error('[Server] Error in /user/listings POST route:', error);
            if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
                return res.status(409).json({ success: false, error: `Product with name "${error.keyValue.name}" already exists.` });
            }
            res.status(500).json({ success: false, error: error.message || 'Failed to add product due to a server error. Please try again.' });
        }
    });
});


router.get('/user/all-products', requireAuth, async (req, res) => {
    console.log("[Server] /user/all-products route accessed.");
    const user = res.locals.user;
    if (!user) {
        console.log("[Server] /user/all-products: No user, redirecting to login.");
        return res.redirect('/auth/login');
    }
    console.log(`[Server] /user/all-products: Authenticated user ${user.email}. Rendering template.`);

    try {
        res.render('all_products', { user: user, error: null, message: null });
    } catch (error) {
        console.error('[Server] Error rendering all products page (template):', error);
        res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: 'Failed to load product page.' });
    }
});

router.get('/dashboard/profile', requireAuth, async (req, res) => { // Added requireAuth
    console.log("[Server] /dashboard/profile route accessed.");
    const user = res.locals.user;
    if (!user) {
        console.log("[Server] /dashboard/profile: No user, redirecting to login.");
        return res.redirect('/auth/login');
    }
    console.log("[Server] /dashboard/profile: Rendering profile_edit view.");
    res.render('profile_edit', { user: user, error: null, message: null });
});

// UPDATED: Use Multer memory storage and upload to Firebase Storage for profile pictures
router.post('/dashboard/profile', requireAuth, async (req, res) => {
    const user = res.locals.user;
    if (!user) {
        return res.status(401).json({ success: false, error: 'User not authenticated.' });
    }

    const uploadProfilePictureInMemory = multer({
        storage: multer.memoryStorage(), // Store in memory
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
        fileFilter: (req, file, cb) => {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed!'), false);
            }
        }
    }).single('profilePicture');

    uploadProfilePictureInMemory(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer error during profile picture upload:', err);
            return res.status(400).json({ success: false, error: err.message || 'File upload error.' });
        } else if (err) {
            console.error('Unknown error during profile picture upload:', err);
            return res.status(500).json({ success: false, error: err.message || 'Server error during file upload.' });
        }

        let firstName = req.body.firstName || '';
        let lastName = req.body.lastName || '';
        let mobile = req.body.mobile || '';
        let gender = req.body.gender || '';

        let profilePictureUrl = user.profilePicture; // Start with current URL

        // Process uploaded file (if exists) via Firebase Storage
        if (req.file && req.file.buffer) {
            const uniqueFileName = `profile_pictures/${user._id}-${Date.now()}${path.extname(req.file.originalname)}`; // Path inside Firebase Storage bucket
            try {
                profilePictureUrl = await uploadToFirebaseStorage(req.file.buffer, uniqueFileName, req.file.mimetype);
                console.log(`[Server] Profile picture uploaded to Firebase Storage: ${profilePictureUrl}`);

                // Optional: Delete old profile picture from Firebase Storage if it was also hosted there
                // This logic assumes old pictures would also be Firebase Storage URLs
                if (user.profilePicture && user.profilePicture.startsWith('https://storage.googleapis.com/')) {
                    // Extract the path from the URL for deletion (e.g., 'profile_pictures/user_id-timestamp.jpg')
                    // This assumes bucket.name is part of the URL structure right after 'storage.googleapis.com/'
                    const oldFilePathInBucket = user.profilePicture.substring(user.profilePicture.indexOf(bucket.name) + bucket.name.length + 1);
                    try {
                        await bucket.file(oldFilePathInBucket).delete();
                        console.log(`Deleted old profile picture from Firebase Storage: ${oldFilePathInBucket}`);
                    } catch (deleteErr) {
                        // Log but don't error out if old file doesn't exist or deletion fails (e.g., permissions)
                        console.warn(`Could not delete old profile picture ${oldFilePathInBucket} from Firebase Storage:`, deleteErr.message);
                    }
                }

            } catch (firebaseErr) {
                console.error('Error uploading profile picture to Firebase Storage:', firebaseErr);
                return res.status(500).json({ success: false, error: `Failed to upload profile picture to cloud storage: ${firebaseErr.message}` });
            }
        }
        // If no new file, and current profilePictureUrl from DB or form is empty (e.g. cleared by client), use default.
        else if (!profilePictureUrl || profilePictureUrl.trim() === '') {
            profilePictureUrl = '/images/default_image.png';
        }


        if (!firstName || firstName.length < 2 || !lastName || lastName.length < 2 || !mobile || !/^\d{10}$/.test(mobile) || !gender) {
            return res.status(400).json({ success: false, error: 'Validation failed: Please fill all required fields correctly.' });
        }

        try {
            const updatedUser = await User.findByIdAndUpdate(user._id, {
                firstName: firstName,
                lastName: lastName,
                mobile: mobile,
                gender: gender,
                profilePicture: profilePictureUrl // This will now be a Firebase Storage URL
            }, { new: true, runValidators: true });

            if (!updatedUser) {
                return res.status(404).json({ success: false, error: 'User not found for update.' });
            }

            res.json({
                success: true,
                message: 'Profile updated successfully!',
                data: {
                    firstName: updatedUser.firstName,
                    lastName: updatedUser.lastName,
                    email: updatedUser.email,
                    mobile: updatedUser.mobile,
                    gender: updatedUser.gender,
                    profilePicture: updatedUser.profilePicture
                },
                profilePictureUrl: updatedUser.profilePicture
            });

        } catch (error) {
            console.error('Error updating user profile in DB:', error);
            if (error.code === 11000) {
                const field = Object.keys(error.keyValue)[0];
                return res.status(400).json({ success: false, error: `This ${field} "${error.keyValue[field]}" is already in use.` });
            }
            res.status(500).json({ success: false, error: 'Failed to update profile due to a server error.' });
        }
    });
});


router.post('/api/generate-description', async (req, res) => {
    console.log("[Server] /api/generate-description POST route accessed.");
    const { productName, keywords, tone, language } = req.body;
    console.log(`[Server] Generating description for: ${productName}, keywords: ${keywords}, tone: ${tone}, language: ${language}`);

    if (!productName || !keywords) {
        return res.status(400).json({ error: 'Product name and keywords are required.' });
    }

    let description = await generateProductDescription(productName, keywords, tone, language);
    console.log(`[Server] Gemini generated description (first 50 chars): ${String(description).substring(0, Math.min(description.length, 50))}...`);

    if (description.startsWith("Failed to generate description") || description.startsWith("AI agent not configured")) {
        console.warn("[Server] /api/generate-description: Gemini generation failed. Falling back to Groq.");
        try {
            const prompt = `Generate a concise and engaging product description for a product named "${productName}". Focus on these keywords: ${keywords}. The tone should be ${tone}. The description MUST be written in ${language}. Keep it under 100 words.`;
            description = await getGroqChatCompletion(prompt);
            console.log(`[Server] Groq generated description (first 50 chars): ${String(description).substring(0, Math.min(description.length, 50))}...`);
        } catch (groqError) {
            console.error("[Server] /api/generate-description: Groq generation also failed:", groqError);
            return res.status(500).json({ error: description + " And fallback to Groq failed." });
        }
    }

    if (String(description).startsWith("Failed") || String(description).startsWith("Groq AI agent not configured")) {
        return res.status(500).json({ error: description });
    }

    res.json({ description: description });
});

router.get('/ai-chat', requireAuth, (req, res) => { // Added requireAuth
    console.log("[Server] /ai-chat route accessed.");
    const user = res.locals.user;
    if (!user) {
        return res.redirect('/auth/login');
    }
    console.log("[Server] /ai-chat: Rendering ai_chat view for user:", user.email);
    res.render('ai_chat', { user: user });
});

router.post('/api/grok-chat', requireAuth, async (req, res) => {
    console.log("[Server] /api/grok-chat POST route accessed (Text Chat).");
    const message = req.body.message;
    const userId = res.locals.user.uid;
    console.log(`[Server] Grok Chat: User ID: ${userId}, Message: "${message}"`);

    if (!message) {
        return res.status(400).json({ error: 'Message is required.' });
    }
    try {
        const lowerCaseMessage = message.toLowerCase();
        // Check for weather query for Chennai or Porumamilla
        const isWeatherQuery = (lowerCaseMessage.includes("weather") || lowerCaseMessage.includes("forecast")) &&
            (lowerCaseMessage.includes("chennai") || lowerCaseMessage.includes("porumamilla") || lowerCaseMessage.includes("today") || lowerCaseMessage.includes("tomorrow"));

        if (isWeatherQuery) {
            console.log("[Server] Grok Chat: Detected weather query. Requesting JSON from Groq.");
            const systemPrompt = `You are a helpful AI assistant specialized in providing weather information.
            When asked about weather (especially for Chennai or Porumamilla), respond ONLY with a JSON object.
            The JSON object should have the following structure. Fill with realistic, but synthetic/placeholder, data if real-time data is not available.
            Assume the current date is Tuesday, July 29, 2025.
            
            Example JSON Structure:
            {
              "location": "City, Country",
              "current_weather": {
                "temperature": { "celsius": 0, "fahrenheit": 0 },
                "humidity": 0,
                "wind_speed": { "kph": 0, "mph": 0 },
                "cloud_cover": "Description",
                "as_of": "Date and Time (e.g., Tuesday, July 29, 2025 at 1:09:10 PM IST)"
              },
              "forecast": [
                {
                  "day": "Today",
                  "date_description": "Friday",
                  "conditions": "Description",
                  "high_temperature": { "celsius": 0, "fahrenheit": 0 },
                  "low_temperature": { "celsius": 0, "fahrenheit": 0 }
                },
                { /* Saturday's forecast */ },
                { /* Sunday's forecast */ }
              ],
              "rainfall": { "chance_in_24_hours": "No chance" },
              "other_notes": {
                "sea_condition": { "description": "moderate", "wave_height": { "meters": "0-0", "feet": "0-0" } },
                "visibility": { "description": "good", "minimum": { "kilometers": 0, "miles": 0 } }
              },
              "disclaimer": "Weather conditions can change rapidly, and this information is subject to change. This data is illustrative."
            }
            `;

            const groqResponse = await getGroqChatCompletion(message, true, systemPrompt); // Pass true for returnJson

            if (typeof groqResponse === 'object') {
                console.log("[Server] Grok Chat: Received valid JSON response for weather.");
                return res.json({ reply: groqResponse }); // Send the JSON object directly
            } else {
                console.warn("[Server] Grok Chat: Groq failed to return valid JSON for weather, sending raw text.");
                return res.json({ reply: groqResponse }); // Send raw text if parsing failed
            }

        } else {
            console.log("[Server] Grok Chat: Calling getGroqChatCompletion for general message...");
            const reply = await getGroqChatCompletion(message); // Standard text response
            res.json({ reply });
        }
    } catch (error) {
        console.error('[Server] Error in /api/grok-chat (Text Chat):', error);
        res.status(500).json({ error: 'Failed to get Grok AI response.' });
    }
});

router.post('/api/grok-chat-audio', requireAuth, async (req, res) => {
    console.log("[Server] /api/grok-chat-audio POST route accessed (Audio Chat).");
    const user = res.locals.user;

    const form = new (require('formidable').IncomingForm)(); // Use formidable directly here
    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('[Server] Error parsing form data for audio:', err);
            return res.status(500).json({ error: 'Failed to process audio upload.' });
        }
        console.log("[Server] formidable parsing complete for audio.");

        const audioFile = files.audio && files.audio[0];
        const userId = user.uid; // Use user.uid for Firebase, not general userId

        if (!audioFile) {
            return res.status(400).json({ error: 'Audio file is required.' });
        }

        try {
            const audioBuffer = await fs.readFile(audioFile.filepath);
            console.log(`[Server] Audio Chat: Audio buffer size: ${audioBuffer.length} bytes.`);

            console.log("[Server] Audio Chat: Calling transcribeAudio (mock)...");
            const transcribedText = await transcribeAudio(audioBuffer);
            console.log(`[Server] Audio Chat: Mock transcribed text (first 50 chars): "${transcribedText.substring(0, Math.min(transcribedText.length, 50))}..."`);

            console.log("[Server] Audio Chat: Calling getGroqChatCompletion with transcribed text...");
            // For audio, we typically want text reply for a chat interface
            const grokReply = await getGroqChatCompletion(transcribedText, false);
            console.log(`[Server] Grok Chat: Received Groq reply (first 50 chars): "${String(grokReply).substring(0, Math.min(String(grokReply).length, 50))}..."`);

            // If grokReply is an object (due to a weather-like query from audio), convert to string
            const finalReply = typeof grokReply === 'object' ? JSON.stringify(grokReply, null, 2) : grokReply;

            res.json({ reply: finalReply });
        } catch (error) {
            console.error('[Server] Error in /api/grok-chat-audio:', error);
            res.status(500).json({ error: 'Failed to process audio or get Grok AI response.' });
        } finally {
            if (audioFile && audioFile.filepath) {
                try {
                    await fs.unlink(audioFile.filepath);
                } catch (e) {
                    console.error("Error deleting temp audio file:", e);
                }
            }
        }
    });
});

router.post('/api/grok-chat-photo', requireAuth, async (req, res) => {
    const user = res.locals.user;
    if (!user) {
        return res.status(401).json({ success: false, error: 'User not authenticated.' });
    }

    const form = new (require('formidable').IncomingForm)({ // Use formidable directly here
        uploadDir: path.join(__dirname, '../public/uploads/temp'),
        keepExtensions: true,
        maxFileSize: 5 * 1024 * 1024,
    });

    try {
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) return reject(err);
                resolve([fields, files]);
            });
        });

        const imageFile = files.image && files.image[0];
        const userId = user.uid; // Use user.uid for Firebase, not general userId
        const query = fields.query && fields.query[0] || "";

        if (!imageFile) {
            if (imageFile && imageFile.filepath) await fs.unlink(imageFile.filepath).catch(e => console.error("Error deleting temp file:", e));
            return res.status(400).json({ error: 'Image file is required for search.' });
        }

        try {
            const imageBuffer = await fs.readFile(imageFile.filepath);
            const aiAnalysis = await analyzeImage(imageBuffer, userId, query);

            const finalMessage = query ? `User provided an image. Analysis: "${aiAnalysis.description}". Original Query: "${query}"` : `User provided an image. Analysis: "${aiAnalysis.description}"`;

            // For photo queries, typically you'd want a text reply describing the image or performing a search based on it.
            // If you wanted JSON here, you'd add the `true` flag and a system prompt similar to weather.
            const grokReply = await getGroqChatCompletion(finalMessage, false); // Assuming text reply for photo chat
            const finalGrokReply = typeof grokReply === 'object' ? JSON.stringify(grokReply, null, 2) : grokReply;

            res.json({ reply: finalGrokReply, keywords: aiAnalysis.keywords });
        } catch (error) {
            console.error('[Server] Error in /api/grok-chat-photo:', error);
            res.status(500).json({ error: 'Failed to process image or get Grok AI response.' });
        } finally {
            if (imageFile && imageFile.filepath) {
                try {
                    await fs.unlink(imageFile.filepath);
                } catch (e) {
                    console.error("Error deleting temp image file:", e);
                }
            }
        }
    } catch (parseError) {
        console.error('[Server] Error during form parsing or initial setup in /api/grok-chat-photo:', parseError);
        res.status(500).json({ error: 'Failed to process image upload due to an internal server error.' });
    }
});

module.exports = router;