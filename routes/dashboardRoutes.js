// C:\Users\Konda Reddy\OneDrive\Desktop\Hackfinity-TechArmy\routes\dashboardRoutes.js

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const Product = require('../models/Product'); // Mongoose Product model
const User = require('../models/User'); // Mongoose User model
const { requireAuth } = require('../middleware/authMiddleware');
const admin = require('firebase-admin'); // Already imported in app.js, ensuring it's available if needed in other routes

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
// --- End Multer setup ---


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
                query = { $and: [ query, { category: { $regex: categoryFilter, $options: 'i' } } ] };
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
    res.render('add_product', { error: null, message: null });
});

router.post('/admin/products', requireAuth, async (req, res) => {
    console.log("[Server] /admin/products POST route accessed.");
    const user = res.locals.user;
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Access Denied: Only administrators can add products.' });
    }

    // Using multer for handling single product image upload
    const uploadSingleProductImage = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, path.join(__dirname, '../public/uploads/products'));
            },
            filename: (req, file, cb) => {
                cb(null, `${Date.now()}-${file.originalname}`);
            }
        }),
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
        fileFilter: (req, file, cb) => {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed!'), false);
            }
        }
    }).single('image'); // 'image' is the name of the input field for the file

    uploadSingleProductImage(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer error during single product image upload:', err);
            return res.status(400).json({ success: false, error: err.message || 'File upload error.' });
        } else if (err) {
            console.error('Unknown error during single product image upload:', err);
            return res.status(500).json({ success: false, error: err.message || 'Server error during file upload.' });
        }

        const { name, description, price, imageUrl, category, keywords } = req.body;
        let finalImageUrl = imageUrl;

        // If a file was uploaded, use its path. Otherwise, if an imageUrl was provided, use that.
        // If neither, use default.
        if (req.file) {
            finalImageUrl = `/uploads/products/${req.file.filename}`;
            console.log(`[Server] Single product image uploaded: ${finalImageUrl}`);
        } else if (!finalImageUrl) {
            finalImageUrl = '/images/default_product.png';
        }

        console.log(`[Server] /admin/products POST: Attempting to add product: ${name}`);

        if (!name || !description || !price || !category) {
            console.warn("[Server] /admin/products POST: Missing required fields.");
            // If an image was uploaded but other fields are missing, delete the uploaded image
            if (req.file && req.file.path) {
                await fs.unlink(req.file.path).catch(e => console.error("Error deleting temp file on validation fail:", e));
            }
            return res.status(400).json({ success: false, error: 'Please fill all required fields.' });
        }
        if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
            console.warn("[Server] /admin/products POST: Invalid price.");
            if (req.file && req.file.path) {
                await fs.unlink(req.file.path).catch(e => console.error("Error deleting temp file on validation fail:", e));
            }
            return res.status(400).json({ success: false, error: 'Price must be a non-negative number.' });
        }

        try {
            const newProduct = new Product({
                name,
                description,
                price: parseFloat(price),
                imageUrl: finalImageUrl,
                category,
                keywords: keywords ? String(keywords).split(',').map(k => k.trim()).filter(k => k.length > 0) : []
            });

            await newProduct.save();
            console.log(`[Server] /admin/products POST: Product "${newProduct.name}" added successfully to MongoDB with ID: ${newProduct._id}`);
            res.status(201).json({ success: true, message: 'Product added successfully!', product: newProduct });

        } catch (error) {
            console.error('[Server] Error in /admin/products POST route:', error);
            if (req.file && req.file.path) { // If an image was processed by multer, delete it on DB error
                await fs.unlink(req.file.path).catch(e => console.error("Error deleting uploaded file on DB error:", e));
            }

            if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
                return res.status(409).json({ success: false, error: `Product with name "${error.keyValue.name}" already exists. Please choose a different name.` });
            }
            res.status(500).json({ success: false, error: error.message || 'Failed to add product due to a server error. Please try again.' });
        }
    });
});

// NEW BULK UPLOAD ENDPOINT
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
        const sheetName = workbook.SheetNames[0]; // Assume data is in the first sheet
        const sheet = workbook.Sheets[sheetName];

        // Convert sheet to JSON array, starting from the first row as headers
        const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        if (rawData.length < 2) { // Need at least header row and one data row
            return res.status(400).json({ message: 'Excel sheet is empty or only contains headers.' });
        }

        const headers = rawData[0].map(h => String(h).trim().toLowerCase().replace(/ /g, '_')); // Normalize headers
        const rows = rawData.slice(1); // Get data rows

        let insertedCount = 0;
        let updatedCount = 0;
        const errors = [];

        // Define expected headers for clarity and mapping
        const expectedHeaders = [
            'product_name', 'description', 'price', 'category', 'keywords', 'image_url'
        ];

        // Validate if all crucial headers are present
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
            const rowNumber = i + 2; // +1 for 0-indexed array, +1 for header row

            const productData = {};
            headers.forEach((header, colIndex) => {
                productData[header] = row[colIndex];
            });

            // Basic validation
            let hasError = false;
            const currentErrors = [];

            const name = String(productData.product_name || '').trim();
            const description = String(productData.description || '').trim();
            const price = parseFloat(productData.price);
            const category = String(productData.category || '').trim();
            const imageUrl = String(productData.image_url || '').trim() || '/images/default_product.png';
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
                continue; // Skip to next row
            }

            try {
                // Try to find an existing product by name (as `name` is unique in your schema)
                const existingProduct = await Product.findOne({ name: name });

                if (existingProduct) {
                    // Update existing product
                    await Product.updateOne(
                        { name: name },
                        {
                            description: description,
                            price: price,
                            category: category,
                            imageUrl: imageUrl,
                            keywords: keywords,
                            // Add other fields you want to update
                            updatedAt: new Date() // Add an update timestamp
                        }
                    );
                    updatedCount++;
                } else {
                    // Create new product
                    const newProduct = new Product({
                        name: name,
                        description: description,
                        price: price,
                        category: category,
                        imageUrl: imageUrl,
                        keywords: keywords,
                    });
                    await newProduct.save();
                    insertedCount++;
                }
            } catch (dbError) {
                if (dbError.code === 11000 && dbError.keyPattern && dbError.keyPattern.name) {
                    // This case should ideally be caught by `Product.findOne` but as a fallback
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
            errors, // Array of errors for rows that failed
        });

    } catch (parseError) {
        console.error('Error parsing Excel file or during upload:', parseError);
        res.status(500).json({ message: 'Error processing Excel file.', details: parseError.message });
    }
});


router.get('/user/product-generator', async (req, res) => {
    console.log("[Server] /user/product-generator route accessed.");
    const user = res.locals.user;
    if (!user) {
        console.log("[Server] /user/product-generator: No user, redirecting to login.");
        return res.redirect('/auth/login');
    }
    console.log("[Server] /user/product-generator: Rendering product_description_generator.");
    res.render('product_description_generator', { user: user, error: null, message: null });
});

router.get('/user/my-catalog', async (req, res) => {
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

router.get('/user/my-catalog/edit/:productId', async (req, res) => {
    console.log("[Server] /user/my-catalog/edit/:productId route accessed.");
    const user = res.locals.user;
    const productId = req.params.productId;
    console.log(`[Server] Fetching product for editing: ${productId}`);

    if (!user) {
        console.log("[Server] /user/my-catalog/edit: No user, redirecting to login.");
        return res.redirect('/auth/login');
    }

    try {
        // This part seems to be referencing Firestore, but Product model is Mongoose.
        // If Product editing is still Firebase-based, keep this. If it's MongoDB, change it.
        // For consistency with Product.js, I'm assuming you'll want to use MongoDB here.
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

router.post('/user/my-catalog/edit/:productId', async (req, res) => {
    console.log("[Server] /user/my-catalog/edit/:productId POST route accessed.");
    const user = res.locals.user;
    if (!user) {
        return res.redirect('/auth/login');
    }

    const { name, description, price, category, keywords, imageUrl } = req.body; // Added price, category, imageUrl for full edit
    const productId = req.params.productId;

    console.log(`[Server] Attempting to update product ${productId} with new data: ${name}`);

    if (!name || !description || !price || !category) { // Added price, category to validation
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
            price: parseFloat(price), // Ensure price is number
            category: category,
            imageUrl: imageUrl || '/images/default_product.png', // Allow updating image URL
            keywords: keywords ? String(keywords).split(',').map(k => k.trim()).filter(k => k.length > 0) : [],
            updatedAt: new Date()
        }, { new: true, runValidators: true }); // `new: true` returns the updated document

        if (!updatedProduct) {
            console.warn(`[Server] Product ${productId} not found for update.`);
            return res.status(404).render('404', { title: 'Product Not Found', user: res.locals.user });
        }

        console.log(`[Server] Product "${updatedProduct.name}" (ID: ${productId}) updated successfully.`);
        res.redirect('/user/my-catalog?message=' + encodeURIComponent('Product updated successfully!'));

    } catch (error) {
        console.error('[Server] Error updating product:', error);
        // Handle unique name error for update
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


// This route uses formidable, as it seems to be set up for it.
// I'm keeping it as is, but if it's meant to add products to the 'Product' model,
// you should reconsider using `Product` model instead of `User` specific collections
// if 'public listings' are indeed products for everyone.
router.get('/user/listings/add', async (req, res) => {
    console.log("[Server] /user/listings/add route accessed.");
    const user = res.locals.user;
    if (!user || user.role !== 'admin') {
        console.warn("[Server] /user/listings/add: Access denied for non-admin user.");
        return res.status(403).render('403', { title: 'Access Denied', user: user, message: 'You do not have permission to view this page.' });
    }
    console.log("[Server] /user/listings/add: Rendering add_listing form.");
    res.render('add_listing', { user: user, error: null, message: null });
});

const { IncomingForm } = require('formidable'); // Ensure formidable is imported here if used for file uploads in this route
router.post('/user/listings', requireAuth, async (req, res) => {
    console.log("[Server] /user/listings POST route accessed for image upload.");
    const user = res.locals.user;

    const form = new IncomingForm({
        uploadDir: path.join(__dirname, '../public/uploads/temp'),
        keepExtensions: true,
        maxFileSize: 10 * 1024 * 1024,
    });

    try {
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) {
                    console.error('Formidable parse error in /user/listings:', err);
                    if (err.code === 1009) {
                        return reject(new Error('Image file size too large. Max 10MB allowed.'));
                    }
                    return reject(err);
                }
                resolve([fields, files]);
            });
        });

        const name = (fields.name && fields.name[0]) || '';
        const description = (fields.description && fields.description[0]) || '';
        const price = (fields.price && fields.price[0]) || '';
        const category = (fields.category && fields.category[0]) || '';
        const contactInfo = (fields.contactInfo && fields.contactInfo[0]) || '';
        const imageFile = files.image && files.image[0];

        if (!name || !description || !price || !category) {
            console.warn("[Server] /user/listings POST: Missing required fields after parsing.");
            if (imageFile && imageFile.filepath) await fs.unlink(imageFile.filepath).catch(e => console.error("Error deleting temp file:", e));
            return res.status(400).json({ success: false, error: 'Please fill all required fields.' });
        }
        if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
            console.warn("[Server] /user/listings POST: Invalid price after parsing.");
            if (imageFile && imageFile.filepath) await fs.unlink(imageFile.filepath).catch(e => console.error("Error deleting temp file:", e));
            return res.status(400).json({ success: false, error: 'Price must be a non-negative number.' });
        }

        let finalImageUrl = '/images/default_product.png';

        if (imageFile) {
            const uploadDir = path.join(__dirname, '../public/uploads/products');
            await fs.mkdir(uploadDir, { recursive: true });

            const newFileName = `${Date.now()}-${imageFile.originalFilename}`;
            const newPath = path.join(uploadDir, newFileName);

            await fs.rename(imageFile.filepath, newPath);

            finalImageUrl = `/uploads/products/${newFileName}`;
            console.log(`[Server] Public listing image uploaded: ${finalImageUrl}`);
        } else if (fields.imageUrl && fields.imageUrl[0]) {
            finalImageUrl = fields.imageUrl[0];
            console.log(`[Server] Public listing using provided image URL: ${finalImageUrl}`);
        }

        const newProduct = new Product({
            name,
            description,
            price: parseFloat(price),
            imageUrl: finalImageUrl,
            category,
            contactInfo: contactInfo, // Note: Your Product model does not have contactInfo field
            keywords: [],
        });

        await newProduct.save();
        console.log(`[Server] Public listing "${newProduct.name}" added successfully to MongoDB Product collection with ID: ${newProduct._id}`);
        res.status(201).json({ success: true, message: 'Product listing added successfully!', listing: newProduct });

    } catch (error) {
        console.error('[Server] Error in /user/listings POST route:', error);
        if (form.openedFiles && form.openedFiles[0] && form.openedFiles[0].filepath) {
             await fs.unlink(form.openedFiles[0].filepath).catch(e => console.error("Error deleting temp file on caught error:", e));
        }

        if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
            return res.status(409).json({ success: false, error: `Product with name "${error.keyValue.name}" already exists.` });
        }
        res.status(500).json({ success: false, error: error.message || 'Failed to add product due to a server error. Please try again.' });
    } finally {
    }
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

router.get('/dashboard/profile', async (req, res) => {
    console.log("[Server] /dashboard/profile route accessed.");
    const user = res.locals.user;
    if (!user) {
        console.log("[Server] /dashboard/profile: No user, redirecting to login.");
        return res.redirect('/auth/login');
    }
    console.log("[Server] /dashboard/profile: Rendering profile_edit view.");
    res.render('profile_edit', { user: user, error: null, message: null });
});

router.post('/dashboard/profile', requireAuth, async (req, res) => {
    const user = res.locals.user;
    if (!user) {
        return res.status(401).json({ success: false, error: 'User not authenticated.' });
    }

    // Using multer for handling profile picture upload
    const uploadProfilePicture = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, path.join(__dirname, '../public/uploads/profile_pictures'));
            },
            filename: (req, file, cb) => {
                cb(null, `${user._id}-${Date.now()}${path.extname(file.originalname)}`);
            }
        }),
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
        fileFilter: (req, file, cb) => {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed!'), false);
            }
        }
    }).single('profilePicture'); // 'profilePicture' is the name of the input field

    uploadProfilePicture(req, res, async (err) => {
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
        
        let profilePictureUrl = user.profilePicture;

        if (req.file) { // If a new profile picture was uploaded
            // Delete old profile picture if it's not the default and was an uploaded one
            if (user.profilePicture && user.profilePicture !== '/images/default_image.png' && user.profilePicture.startsWith('/uploads/profile_pictures')) {
                const oldFilePath = path.join(__dirname, '../public', user.profilePicture);
                try {
                    await fs.access(oldFilePath, fs.constants.F_OK); // Check if file exists
                    await fs.unlink(oldFilePath); // Delete it
                    console.log(`Deleted old profile picture: ${oldFilePath}`);
                } catch (deleteErr) {
                    console.warn(`Could not delete old profile picture ${oldFilePath}:`, deleteErr.message);
                }
            }
            profilePictureUrl = `/uploads/profile_pictures/${req.file.filename}`;
        }

        if (!firstName || firstName.length < 2 || !lastName || lastName.length < 2 || !mobile || !/^\d{10}$/.test(mobile) || !gender) {
            // If validation fails after multer processed the file, delete the new file
            if (req.file && req.file.path) await fs.unlink(req.file.path).catch(e => console.error("Error deleting temp profile file on validation fail:", e));
            return res.status(400).json({ success: false, error: 'Validation failed: Please fill all required fields correctly.' });
        }

        try {
            const updatedUser = await User.findByIdAndUpdate(user._id, {
                firstName: firstName,
                lastName: lastName,
                mobile: mobile,
                gender: gender,
                profilePicture: profilePictureUrl
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
            if (req.file && req.file.path) { // If an image was processed by multer, delete it on DB error
                await fs.unlink(req.file.path).catch(e => console.error("Error deleting uploaded profile file on DB error:", e));
            }
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
    const { productName, keywords } = req.body;
    console.log(`[Server] Generating description for: ${productName}, keywords: ${keywords}`);

    if (!productName || !keywords) {
        return res.status(400).json({ error: 'Product name and keywords are required.' });
    }

    const description = await generateProductDescription(productName, keywords);
    console.log(`[Server] Generated description (first 50 chars): ${description.substring(0, Math.min(description.length, 50))}...`);

    if (description.startsWith("Failed to generate description") || description.startsWith("AI agent not configured")) {
        console.error("[Server] /api/generate-description: AI generation failed or not configured.");
        return res.status(500).json({ error: description });
    }

    res.json({ description: description });
});

router.get('/ai-chat', (req, res) => {
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
        console.log("[Server] Grok Chat: Calling getGroqChatCompletion...");
        const reply = await getGroqChatCompletion(message);
        console.log(`[Server] Grok Chat: Received reply (first 50 chars): "${reply.substring(0, Math.min(reply.length, 50))}..."`);
        res.json({ reply });
    } catch (error) {
        console.error('[Server] Error in /api/grok-chat (Text Chat):', error);
        res.status(500).json({ error: 'Failed to get Grok AI response.' });
    }
});

router.post('/api/grok-chat-audio', requireAuth, async (req, res) => {
    console.log("[Server] /api/grok-chat-audio POST route accessed (Audio Chat).");
    const user = res.locals.user;

    const form = new IncomingForm(); // Keep formidable for this route if it's the intended parser
    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('[Server] Error parsing form data for audio:', err);
            return res.status(500).json({ error: 'Failed to process audio upload.' });
        }
        console.log("[Server] formidable parsing complete for audio.");

        const audioFile = files.audio && files.audio[0];
        const userId = user.uid;

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
            const grokReply = await getGroqChatCompletion(transcribedText);
            console.log(`[Server] Grok Chat: Received Groq reply (first 50 chars): "${grokReply.substring(0, Math.min(grokReply.length, 50))}..."`);

            res.json({ reply: grokReply });
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

    const form = new IncomingForm({ // Keep formidable for this route
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
        const userId = user.uid;
        const query = fields.query && fields.query[0] || "";

        if (!imageFile) {
            if (imageFile && imageFile.filepath) await fs.unlink(imageFile.filepath).catch(e => console.error("Error deleting temp file:", e));
            return res.status(400).json({ error: 'Image file is required for search.' });
        }

        try {
            const imageBuffer = await fs.readFile(imageFile.filepath);
            const aiAnalysis = await analyzeImage(imageBuffer, userId, query);

            const finalMessage = query ? `User provided an image. Analysis: "${aiAnalysis.description}". Original Query: "${query}"` : `User provided an image. Analysis: "${aiAnalysis.description}"`;

            const grokReply = await getGroqChatCompletion(finalMessage);

            res.json({ reply: grokReply, keywords: aiAnalysis.keywords });
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