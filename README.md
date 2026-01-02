# Agent Seller (Hackfinity-TechArmy)

**Agent Seller** is a powerful AI-driven e-commerce dashboard and product management system designed to empower sellers with advanced tools for content generation and localized user experiences.

## 🚀 Key Features

### 🤖 AI-Powered Content Generation
-   **Product Description Generator**: Creates engaging, SEO-friendly product descriptions using Google Gemini 1.5 Flash (with Groq/Llama 3.1 fallback).
-   **Multi-Tone Support**: Choose from various tones like Professional, Casual, Luxurious, Urgent, Friendly, and Witty.
-   **Multi-Language Generation**: Generate descriptions in English, Spanish, French, German, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, and Gujarati.

### 🗣️ Indian Language Voice Support
-   **Localized Voice Experience**:  Full voice navigation and feedback support for Indian languages.
-   **Voice Search**: Search for products using voice commands in your native language (e.g., Hindi, Telugu, Tamil).
-   **Smart Language Selection**: Voice-activated language selection overlay. Just say "Telugu" or "Hindi" to switch the entire experience.

### 🛠️ Seller Dashboard
-   **Product Management**: Add, edit, delete, and list products easily.
-   **Bulk Upload**: Upload multiple products via Excel sheets.
-   **Analytics**: Visualize sales and product performance (using Charts.js).
-   **Authentication**: Secure login and signup powered by Firebase Authentication.

### 🔍 Advanced Search & Filter
-   **Text, Voice, and Image Search**: Find products using keywords, voice commands, or by uploading an image.
-   **Smart Filtering**: Filter by category, price range, and more.

## 🏗️ Tech Stack

-   **Backend**: Node.js, Express.js
-   **Database**: MongoDB (Mongoose), Firestore (User Catalog)
-   **Authentication**: Firebase Admin SDK
-   **AI Services**: 
    -   Google Generative AI (Gemini 1.5 Flash)
    -   Groq SDK (Llama 3.1)
-   **Frontend**: EJS Templating, Tailwind CSS, Lucide Icons
-   **Testing**: Jest, Supertest

## ⚙️ Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Kondareddy1209/Hackfinity-TechArmy.git
    cd Hackfinity-TechArmy
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory and add the following keys:
    ```env
    PORT=3000
    MONGO_URI=your_mongodb_connection_string
    SESSION_SECRET=your_session_secret
    JWT_SECRET=your_jwt_secret
    
    # Firebase
    FIREBASE_STORAGE_BUCKET=your_firebase_bucket_name
    
    # AI Services
    GOOGLE_API_KEY=your_gemini_api_key
    GROQ_API_KEY=your_groq_api_key
    
    # Email (Optional)
    EMAIL_USER=your_email@example.com
    EMAIL_PASS=your_email_password
    ```

4.  **Firebase Setup:**
    -   Place your Firebase Service Account JSON file in the `config/` directory.
    -   Update `app.js` to point to your specific service account file path if necessary.

5.  **Run the application:**
    ```bash
    node app.js
    ```
    Access the app at `http://localhost:3000`.

## 🧪 Running Tests

To run the automated integration tests:
```bash
npm test
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
