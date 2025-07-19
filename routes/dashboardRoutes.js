// C:\Users\Konda Reddy\OneDrive\Desktop\Hackfinity-TechArmy\routes\dashboardRoutes.js

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const { IncomingForm } = require('formidable');
const path = require('path'); // ADDED: Ensure path is imported for file operations

const { generateProductDescription } = require('../services/geminiAgent');
const { getGroqChatCompletion } = require('../services/groqAgent');

const User = require('../models/User');
const Product = require('../models/Product');

const admin = require('firebase-admin');
const { requireAuth } = require('../middleware/authMiddleware');

// --- Mock/Placeholder Services for Audio/Image Processing ---
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
    const mockKeywords = ["eco-friendly", "handmade", "sustainable", "organic"];
    return {
        description: `This is a mock analysis of the image provided. It looks like a product related to natural living.`,
        keywords: mockKeywords,
        query: query
    };
}
// --- End Mock Services ---


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

// Admin POST Product Route (Returns JSON response for client-side fetch)
router.post('/admin/products', requireAuth, async (req, res) => { // Added requireAuth for consistency
    console.log("[Server] /admin/products POST route accessed.");
    const user = res.locals.user; // User from requireAuth
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Access Denied: Only administrators can add products.' });
    }

    const { name, description, price, imageUrl, category, keywords } = req.body;
    console.log(`[Server] /admin/products POST: Attempting to add product: ${name}`);

    // Basic server-side validation
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
            imageUrl: imageUrl || '/images/default_product.png',
            category,
            keywords: keywords ? String(keywords).split(',').map(k => k.trim()).filter(k => k.length > 0) : [] // Ensure keywords is string before split
        });

        await newProduct.save();
        console.log(`[Server] /admin/products POST: Product "${newProduct.name}" added successfully with ID: ${newProduct._id}`);
        // Send JSON success response
        res.status(201).json({ success: true, message: 'Product added successfully!', product: newProduct });

    } catch (error) {
        console.error('[Server] Error adding product:', error);
        if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
            return res.status(409).json({ success: false, error: `Product with name "${error.keyValue.name}" already exists. Please choose a different name.` });
        }
        res.status(500).json({ success: false, error: 'Failed to add product due to a server error. Please try again.' });
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
        const productDocRef = admin.firestore().collection('artifacts').doc(req.app.get('appId')).collection('users').doc(user.uid).collection('products').doc(productId);
        const productDoc = await productDocRef.get();

        if (!productDoc.exists) {
            console.warn(`[Server] Product ${productId} not found for user ${user.uid}.`);
            return res.status(404).render('404', { title: 'Product Not Found', user: res.locals.user });
        }

        const productData = { id: productDoc.id, ...productDoc.data() };
        console.log(`[Server] Product ${productId} data fetched. Rendering edit_product.`);
        res.render('edit_product', { user: user, product: productData, error: null, message: null });

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

    const { name, description, keywords } = req.body;
    const productId = req.params.productId; // Make sure productId is extracted

    console.log(`[Server] Attempting to update product ${productId} with new data: ${name}`);

    if (!name || !description) {
        console.warn("[Server] /user/my-catalog/edit POST: Missing required fields for update.");
        try {
            const productDocRef = admin.firestore().collection('artifacts').doc(req.app.get('appId')).collection('users').doc(user.uid).collection('products').doc(productId);
            const productDoc = await productDocRef.get();
            const productData = { id: productDoc.id, ...productDoc.data() };
            return res.status(400).render('edit_product', { user: user, product: productData, error: 'Product name and description are required.', message: null });
        } catch (fetchError) {
            console.error('[Server] Error re-fetching product for validation error:', fetchError);
            res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: 'Error processing update.' });
        }
    }

    try {
        const productDocRef = admin.firestore().collection('artifacts').doc(req.app.get('appId')).collection('users').doc(user.uid).collection('products').doc(productId);
        await productDocRef.update({
            name: name,
            description: description,
            keywords: keywords ? String(keywords).split(',').map(k => k.trim()).filter(k => k.length > 0) : [],
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[Server] Product "${name}" (ID: ${productId}) updated successfully.`);
        res.redirect('/user/my-catalog?message=' + encodeURIComponent('Product updated successfully!'));

    } catch (error) {
        console.error('[Server] Error updating product:', error);
        try {
            const productDocRef = admin.firestore().collection('artifacts').doc(req.app.get('appId')).collection('users').doc(user.uid).collection('products').doc(productId);
            const productDoc = await productDocRef.get();
            const productData = { id: productDoc.id, ...productDoc.data() };
            res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: 'Failed to update product. Please try again.', message: null });
        } catch (fetchError) {
            console.error('[Server] Error re-fetching product for update error:', fetchError);
            res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: 'Error processing update.' });
        }
    }
});

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

router.post('/user/listings', async (req, res) => {
    console.log("[Server] /user/listings POST route accessed.");
    const user = res.locals.user;
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Access Denied: Only administrators can add public listings.' });
    }

    const { name, description, price, imageUrl, category, contactInfo } = req.body;
    console.log(`[Server] /user/listings POST: Received listing data: ${name}, ${category}`);

    if (!name || !description || !price || !category) {
        return res.status(400).json({ success: false, error: 'Please fill all required fields for public listing.' });
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
        return res.status(400).json({ success: false, error: 'Price must be a non-negative number for public listing.' });
    }

    try {
        const appId = req.app.get('appId');
        const publicListingsCollectionRef = admin.firestore()
                                                .collection('artifacts')
                                                .doc(appId)
                                                .collection('publicListings');

        const newListing = {
            name,
            description,
            price: parseFloat(price),
            category,
            imageUrl: imageUrl || '/images/default_product.png',
            contactInfo,
            listedBy: user.uid,
            listedByName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email,
            listedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await publicListingsCollectionRef.add(newListing);
        console.log(`[Server] Public listing "${name}" added successfully to Firestore.`);
        res.status(201).json({ success: true, message: 'Product listing added successfully!', listing: newListing });

    } catch (error) {
        console.error('[Server] Error adding public listing:', error);
        res.status(500).json({ success: false, error: 'Failed to add public listing due to a server error. Please try again.' });
    }
});

router.get('/user/all-products', async (req, res) => {
    console.log("[Server] /user/all-products route accessed.");
    const user = res.locals.user;
    if (!user) {
        console.log("[Server] /user/all-products: No user, redirecting to login.");
        return res.redirect('/auth/login');
    }
    console.log(`[Server] /user/all-products: Authenticated user ${user.email}. Fetching products.`);

    try {
        console.log("[Server] Fetching Mongoose products...");
        const mongooseProducts = await Product.find({}).lean();
        console.log(`[Server] Mongoose products fetched: ${mongooseProducts.length}`);

        console.log("[Server] Fetching Firestore public listings...");
        const appId = req.app.get('appId');
        const publicListingsCollectionRef = admin.firestore()
                                                .collection('artifacts')
                                                .doc(appId)
                                                .collection('publicListings');
        const firestoreSnapshot = await publicListingsCollectionRef.get();
        const firestoreProducts = firestoreSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));
        console.log(`[Server] Firestore public listings fetched: ${firestoreProducts.length}`);

        const allCombinedProducts = [
            ...mongooseProducts.map(p => ({ ...p, source: 'admin-product', id: p._id.toString() })),
            ...firestoreProducts.map(p => ({ ...p, source: 'user-listing', id: p.id }))
        ].sort((a, b) => {
            const dateA = a.listedAt ? a.listedAt.toDate() : a.createdAt;
            const dateB = b.listedAt ? b.listedAt.toDate() : b.createdAt;
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateB.getTime() - dateA.getTime();
        });
        console.log(`[Server] Total combined products: ${allCombinedProducts.length}`);

        res.render('all_products', { user: user, products: allCombinedProducts, error: null, message: null });
    } catch (error) {
        console.error('[Server] Error fetching all products for display:', error);
        res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: 'Failed to load all products. Please try again.' });
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

    const form = new IncomingForm({
        uploadDir: path.join(__dirname, '../public/uploads/temp'),
        keepExtensions: true,
        maxFileSize: 5 * 1024 * 1024
    });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('Error parsing profile update form:', err);
            return res.status(400).json({ success: false, error: 'Failed to process form data.' });
        }

        let firstName = (fields.firstName && fields.firstName[0]) || '';
        let lastName = (fields.lastName && fields.lastName[0]) || '';
        let mobile = (fields.mobile && fields.mobile[0]) || '';
        let gender = (fields.gender && fields.gender[0]) || '';
        const profilePictureFile = files.profilePicture && files.profilePicture[0];

        if (!firstName || firstName.length < 2 || !lastName || lastName.length < 2 || !mobile || !/^\d{10}$/.test(mobile) || !gender) {
            return res.status(400).json({ success: false, error: 'Validation failed: Please fill all required fields correctly.' });
        }

        try {
            let profilePictureUrl = user.profilePicture;

            if (profilePictureFile) {
                const uploadDir = path.join(__dirname, '../public/uploads/profile_pictures');
                await fs.mkdir(uploadDir, { recursive: true });

                const newFileName = `${user._id}-${Date.now()}${path.extname(profilePictureFile.originalFilename)}`;
                const newPath = path.join(uploadDir, newFileName);
                const publicUrl = `/uploads/profile_pictures/${newFileName}`;

                await fs.rename(profilePictureFile.filepath, newPath);

                if (user.profilePicture && user.profilePicture !== '/images/default_image.png' && user.profilePicture.startsWith('/uploads/profile_pictures')) {
                    const oldFilePath = path.join(__dirname, '../public', user.profilePicture);
                    try {
                        await fs.access(oldFilePath, fs.constants.F_OK);
                        await fs.unlink(oldFilePath);
                        console.log(`Deleted old profile picture: ${oldFilePath}`);
                    } catch (deleteErr) {
                        console.warn(`Could not delete old profile picture ${oldFilePath}:`, deleteErr.message);
                    }
                }
                profilePictureUrl = publicUrl;
            }

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

        } catch (dbError) {
            console.error('Error updating user profile in DB:', dbError);
            if (dbError.code === 11000) {
                const field = Object.keys(dbError.keyValue)[0];
                return res.status(400).json({ success: false, error: `This ${field} "${dbError.keyValue[field]}" is already in use.` });
            }
            res.status(500).json({ success: false, error: 'Failed to update profile due to a server error.' });
        } finally {
            if (profilePictureFile && profilePictureFile.filepath) {
                try {
                    await fs.unlink(profilePictureFile.filepath);
                } catch (e) {
                    console.error("Error deleting temp formidable file:", e);
                }
            }
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

router.post('/api/grok-chat', async (req, res) => {
    console.log("[Server] /api/grok-chat POST route accessed (Text Chat).");
    const { userId, message } = req.body;
    console.log(`[Server] Grok Chat: User ID: ${userId}, Message: "${message}"`);

    if (!userId || !message) {
        return res.status(400).json({ error: 'User ID and message are required.' });
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

router.post('/api/grok-chat-audio', async (req, res) => {
    console.log("[Server] /api/grok-chat-audio POST route accessed (Audio Chat).");
    const form = new IncomingForm();
    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('[Server] Error parsing form data for audio:', err);
            return res.status(500).json({ error: 'Failed to process audio upload.' });
        }
        console.log("[Server] formidable parsing complete for audio.");

        const audioFile = files.audio && files.audio[0];
        const userId = fields.userId && fields.userId[0];

        if (!audioFile || !userId) {
            return res.status(400).json({ error: 'Audio file and User ID are required.' });
        }

        try {
            console.log(`[Server] Audio Chat: Reading temporary audio file from ${audioFile.filepath}`);
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

    const form = new IncomingForm({
        uploadDir: path.join(__dirname, '../public/uploads/temp'),
        keepExtensions: true,
        maxFileSize: 5 * 1024 * 1024,
    });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('Error parsing form data for image:', err);
            return res.status(500).json({ error: 'Failed to process image upload.' });
        }

        const imageFile = files.image && files.image[0];
        const userId = fields.userId && fields.userId[0];
        const query = fields.query && fields.query[0] || "";

        if (!imageFile || !userId) {
            return res.status(400).json({ error: 'Image file and User ID are required.' });
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
    });
});

module.exports = router;