// C:\Users\Konda Reddy\OneDrive\Desktop\Hackfinity\routes\dashboardRoutes.js

const express = require('express');
const router = express.Router();
const fs = require('fs').promises; // Required for reading and deleting uploaded files
const { IncomingForm } = require('formidable'); // Make sure you've run: npm install formidable

// Import AI agent functions
const { generateProductDescription } = require('../services/geminiAgent'); // For product description
const { getGroqChatCompletion } = require('../services/groqAgent'); // For Groq AI chat

// Import Mongoose models
const User = require('../models/User');
const Product = require('../models/Product');

// Firebase Admin SDK for server-side Firestore access
const admin = require('firebase-admin'); // Assumed to be initialized in app.js

// --- Mock/Placeholder Services for Audio/Image Processing (Replace with real APIs) ---
async function transcribeAudio(audioBuffer) {
    console.log(`[Server Mock STT] Received audio buffer of size ${audioBuffer.length} bytes.`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call delay
    console.log("[Server Mock STT] Simulating transcription complete.");
    return "This is a mock transcription of your audio input. What would you like to ask Groq?";
}

async function analyzeImage(imageBuffer, userId, query) {
    console.log(`[Server Mock Image] Received image buffer of size ${imageBuffer.length} bytes for user ${userId}. Optional Query: "${query}"`);
    await new Promise(resolve => setTimeout(resolve, 2500)); // Simulate API call delay
    console.log("[Server Mock Image] Simulating image analysis complete.");
    const analysisText = `Based on the image, it appears to be a mock analysis result.`;
    return query ? `${analysisText} The user also provided a query: "${query}". How can Groq help with this visual context?` : `${analysisText} What would you like to know about it?`;
}
// --- End Mock Services ---


// Route to render the main dashboard page (handles both admin and user based on role)
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

router.post('/admin/products', async (req, res) => {
    console.log("[Server] /admin/products POST route accessed.");
    const user = res.locals.user;
    if (!user || user.role !== 'admin') {
        console.warn("[Server] /admin/products POST: Access denied for non-admin user.");
        return res.status(403).send('Access Denied');
    }

    const { name, description, price, imageUrl, category, keywords } = req.body;
    console.log(`[Server] /admin/products POST: Received product data: ${name}, ${category}`);

    if (!name || !description || !price || !category) {
        console.warn("[Server] /admin/products POST: Missing required fields.");
        return res.render('add_product', { error: 'Please fill all required fields.', message: null });
    }

    try {
        const newProduct = new Product({
            name,
            description,
            price: parseFloat(price),
            imageUrl: imageUrl || '/images/default_product.png',
            category,
            keywords: keywords ? keywords.split(',').map(k => k.trim()) : []
        });

        await newProduct.save();
        console.log(`[Server] /admin/products POST: Product "${name}" added successfully.`);
        res.render('add_product', { message: 'Product added successfully!', error: null });

    } catch (error) {
        console.error('[Server] Error adding product:', error);
        if (error.code === 11000) {
            return res.render('add_product', { error: 'Product with this name already exists.', message: null });
        }
        res.render('add_product', { error: 'Failed to add product. Please try again.', message: null });
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
        const productDocRef = admin.firestore().collection(`artifacts/${req.app.get('appId')}/users/${user.uid}/products`).doc(productId);
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
    const productId = req.params.productId;
    const { name, description, keywords } = req.body;
    console.log(`[Server] Attempting to update product ${productId} with new data: ${name}`);

    if (!user) {
        console.log("[Server] /user/my-catalog/edit POST: No user, redirecting to login.");
        return res.redirect('/auth/login');
    }

    if (!name || !description) {
        console.warn("[Server] /user/my-catalog/edit POST: Missing required fields for update.");
        try {
            const productDocRef = admin.firestore().collection(`artifacts/${req.app.get('appId')}/users/${user.uid}/products`).doc(productId);
            const productDoc = await productDocRef.get();
            const productData = { id: productDoc.id, ...productDoc.data() };
            return res.status(400).render('edit_product', { user: user, product: productData, error: 'Product name and description are required.', message: null });
        } catch (fetchError) {
            console.error('[Server] Error re-fetching product for validation error:', fetchError);
            res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: 'Error processing update.' });
        }
    }

    try {
        const productDocRef = admin.firestore().collection(`artifacts/${req.app.get('appId')}/users/${user.uid}/products`).doc(productId);
        await productDocRef.update({
            name: name,
            description: description,
            keywords: keywords ? keywords.split(',').map(k => k.trim()) : [],
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[Server] Product ${productId} updated successfully.`);
        res.redirect('/user/my-catalog?message=' + encodeURIComponent('Product updated successfully!'));

    } catch (error) {
        console.error('[Server] Error updating product:', error);
        try {
            const productDocRef = admin.firestore().collection(`artifacts/${req.app.get('appId')}/users/${user.uid}/products`).doc(productId);
            const productDoc = await productDocRef.get();
            const productData = { id: productDoc.id, ...productDoc.data() };
            res.status(500).render('edit_product', { user: user, product: productData, error: 'Failed to update product. Please try again.', message: null });
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
        console.warn("[Server] /user/listings POST: Access denied for non-admin user.");
        return res.status(403).send('Access Denied: Only administrators can add public listings.');
    }

    const { name, description, price, category, imageUrl, contactInfo } = req.body;
    console.log(`[Server] /user/listings POST: Received listing data: ${name}, ${category}`);

    if (!name || !description || !price || !category) {
        console.warn("[Server] /user/listings POST: Missing required fields.");
        return res.render('add_listing', { user: user, error: 'Please fill all required fields.', message: null });
    }

    try {
        const appId = req.app.get('appId');
        const publicListingsCollectionRef = admin.firestore()
                                                .collection('artifacts')
                                                .doc(appId)
                                                .collection('public')
                                                .collection('listings');

        await publicListingsCollectionRef.add({
            name,
            description,
            price: parseFloat(price),
            category,
            imageUrl: imageUrl || '/images/default_product.png',
            contactInfo,
            listedBy: user.uid,
            listedByName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email,
            listedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[Server] Public listing "${name}" added successfully to Firestore.`);
        res.render('add_listing', { user: user, message: 'Product listing added successfully!', error: null });

    } catch (error) {
        console.error('[Server] Error adding public listing:', error);
        res.render('add_listing', { user: user, error: 'Failed to add product listing. Please try again.', message: null });
    }
});

router.get('/user/all-products', async (req, res) => {
    console.log("[Server] /user/all-products route accessed.");
    const user = res.locals.user;
    if (!user) {
        console.log("[Server] /user/all-products: No user, redirecting to login.");
        return res.redirect('/auth/login');
    }
    console.log("[Server] /user/all-products: Authenticated user. Fetching products.");

    try {
        console.log("[Server] Fetching Mongoose products...");
        const mongooseProducts = await Product.find({}).lean();
        console.log(`[Server] Mongoose products fetched: ${mongooseProducts.length}`);

        console.log("[Server] Fetching Firestore public listings...");
        const appId = req.app.get('appId');
        const publicListingsCollectionRef = admin.firestore()
                                                .collection('artifacts')
                                                .doc(appId)
                                                .collection('public')
                                                .collection('listings');
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
        console.error('[Server] Error fetching all products:', error);
        res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: 'Failed to load all products.' });
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


router.post('/api/generate-description', async (req, res) => {
    console.log("[Server] /api/generate-description POST route accessed.");
    const { productName, keywords } = req.body;
    console.log(`[Server] Generating description for: ${productName}, keywords: ${keywords}`);

    if (!productName || !keywords) {
        console.warn("[Server] /api/generate-description: Missing product name or keywords.");
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
        console.log("[Server] /ai-chat: No user, redirecting to login.");
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
        console.warn("[Server] Grok Chat: Missing user ID or message.");
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
    const form = new IncomingForm(); // Initialize formidable
    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('[Server] Error parsing form data for audio:', err);
            return res.status(500).json({ error: 'Failed to process audio upload.' });
        }
        console.log("[Server] formidable parsing complete for audio.");

        // formidable 3.x returns arrays for fields and files
        const audioFile = files.audio && files.audio[0];
        const userId = fields.userId && fields.userId[0];

        if (!audioFile || !userId) {
            console.warn("[Server] Audio Chat: Missing audio file or User ID.");
            return res.status(400).json({ error: 'Audio file and User ID are required.' });
        }

        try {
            console.log(`[Server] Audio Chat: Reading temporary audio file from ${audioFile.filepath}`);
            const audioBuffer = await fs.readFile(audioFile.filepath); // Read the audio file into a buffer
            console.log(`[Server] Audio Chat: Audio buffer size: ${audioBuffer.length} bytes.`);

            console.log("[Server] Audio Chat: Calling transcribeAudio (mock)...");
            const transcribedText = await transcribeAudio(audioBuffer); // Mock STT service
            console.log(`[Server] Audio Chat: Mock transcribed text (first 50 chars): "${transcribedText.substring(0, Math.min(transcribedText.length, 50))}..."`);
            
            console.log("[Server] Audio Chat: Calling getGroqChatCompletion with transcribed text...");
            const grokReply = await getGroqChatCompletion(transcribedText); // Call Groq AI service
            console.log(`[Server] Audio Chat: Received Groq reply (first 50 chars): "${grokReply.substring(0, Math.min(grokReply.length, 50))}..."`);

            res.json({ reply: grokReply });
        } catch (error) {
            console.error('[Server] Error in /api/grok-chat-audio:', error);
            res.status(500).json({ error: 'Failed to process audio or get Grok AI response.' });
        } finally {
            if (audioFile && audioFile.filepath) {
                console.log(`[Server] Audio Chat: Deleting temporary audio file: ${audioFile.filepath}`);
                await fs.unlink(audioFile.filepath).catch(e => console.error("[Server] Error deleting temp audio file:", e));
            }
        }
    });
});

router.post('/api/grok-chat-photo', async (req, res) => {
    console.log("[Server] /api/grok-chat-photo POST route accessed (Photo Chat).");
    const form = new IncomingForm(); // Initialize formidable
    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('[Server] Error parsing form data for image:', err);
            return res.status(500).json({ error: 'Failed to process image upload.' });
        }
        console.log("[Server] formidable parsing complete for image.");

        const imageFile = files.image && files.image[0];
        const userId = fields.userId && fields.userId[0];
        const query = fields.query && fields.query[0] || "";
        console.log(`[Server] Photo Chat: User ID: ${userId}, Image file received: ${imageFile ? imageFile.originalFilename : 'None'}, Query: "${query}"`);

        if (!imageFile || !userId) {
            console.warn("[Server] Photo Chat: Missing image file or User ID.");
            return res.status(400).json({ error: 'Image file and User ID are required.' });
        }

        try {
            console.log(`[Server] Photo Chat: Reading temporary image file from ${imageFile.filepath}`);
            const imageBuffer = await fs.readFile(imageFile.filepath); // Read the image file into a buffer
            console.log(`[Server] Photo Chat: Image buffer size: ${imageBuffer.length} bytes.`);

            console.log("[Server] Photo Chat: Calling analyzeImage (mock)...");
            const imageAnalysis = await analyzeImage(imageBuffer, userId, query); // Mock image analysis service
            console.log(`[Server] Photo Chat: Mock image analysis (first 50 chars): "${imageAnalysis.substring(0, Math.min(imageAnalysis.length, 50))}..."`);
            
            const finalMessage = query ? `User provided an image. Analysis: "${imageAnalysis}". Original Query: "${query}"` : `User provided an image. Analysis: "${imageAnalysis}"`;
            
            console.log("[Server] Photo Chat: Calling getGroqChatCompletion with analysis...");
            const grokReply = await getGroqChatCompletion(finalMessage); // Call Groq AI service
            console.log(`[Server] Photo Chat: Received Groq reply (first 50 chars): "${grokReply.substring(0, Math.min(grokReply.length, 50))}..."`);

            res.json({ reply: grokReply });
        } catch (error) {
            console.error('[Server] Error in /api/grok-chat-photo:', error);
            res.status(500).json({ error: 'Failed to process image or get Grok AI response.' });
        } finally {
            if (imageFile && imageFile.filepath) {
                console.log(`[Server] Photo Chat: Deleting temporary image file: ${imageFile.filepath}`);
                await fs.unlink(imageFile.filepath).catch(e => console.error("[Server] Error deleting temp image file:", e));
            }
        }
    });
});

module.exports = router;