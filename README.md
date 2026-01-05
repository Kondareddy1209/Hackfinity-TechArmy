# 🚀 Agent Seller (Hackfinity-TechArmy)

> **Empowering E-commerce Sellers with AI-Driven Tools & Hyper-Localized Experiences.**

![Agent Seller Banner](https://via.placeholder.com/1200x400.png?text=Agent+Seller+Platform)

**Agent Seller** is a cutting-edge platform designed to revolutionize how sellers manage their online presence. By integrating advanced **Artificial Intelligence (Google Gemini & Groq)** and **Voice Technologies**, we provide a seamless, multilingual, and intuitive dashboard for product management, content generation, and customer engagement.

---

## 🌟 Key Features

### 🤖 AI Product Powerhouse
*   **Smart Description Generator**: Automatically generates SEO-friendly, persuasive product descriptions using **Google Gemini 1.5 Flash**.
*   **Multi-Tone Support**: Customize the description tone (Professional, Witty, Urgent, Luxury, etc.) to match your brand voice.
*   **Multilingual Magic**: Generate content instantly in 12+ languages including **Hindi, Telugu, Tamil, Kannada, Spanish, French,** and more.

### 🧠 Intelligent AI Assistant (Grok Integration)
*   **Chat with AI**: A dedicated AI assistant powered by **Groq (Llama 3.1)** to answer seller queries.
*   **Image Analysis**: Upload product images, and the AI will analyze them to suggest improvements, descriptions, or categorization.
*   **Voice-Enabled Chat**: Talk to the assistant directly using your microphone.

### 🗣️ Voice-First Navigation
*   **Voice Search**: Users can search for products simply by speaking in their native language.
*   **Language Switcher**: Voice-activated commands (e.g., "Switch to Telugu") to instantly change the platform's language.

### 🔐 Secure Authentication & User Management
*   **Dual Login Methods**:
    *   **Google OAuth**: Use your Google account for one-click sign-in.
    *   **Email + OTP**: Secure traditional login with One-Time Password verification via Email.
*   **Role-Based Access**: Distinct dashboards for **Admins** and **Users**.

### 🎨 Modern UI/UX
*   **Responsive Design**: Fully optimized for Desktop, Tablet, and Mobile devices.
*   **Dark/Light Mode**: Toggle between themes for visual comfort.
*   **Floating Particles & 3D Animations**: A visually stunning signup/login experience.

---

## 🛠️ Technology Stack

| Component | Tech |
| :--- | :--- |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB (Data), Firebase (Storage) |
| **Templating** | EJS (Embedded JavaScript) |
| **Styling** | Tailwind CSS, Vanilla CSS |
| **AI LLMs** | Google Gemini 1.5 Flash, Llama 3.1 (via Groq) |
| **Auth** | JWT, Google OAuth, Nodemailer (OTP) |
| **Icons** | Lucide Icons, FontAwesome |

---

## 📂 Project Structure

```bash
Hackfinity-TechArmy/
├── config/              # Firebase & Database configurations
├── middleware/          # Auth & file upload middleware
├── models/              # Mongoose database schemas (User, Product)
├── public/              # Static assets (CSS, images, uploads)
├── routes/              # Express routes (Auth, Admin, Dashboard)
├── utils/               # Helper functions (AI wrappers, email sender)
├── views/               # EJS Templates
│   ├── partials/        # Reusable headers/footers
│   ├── admin_dashboard  # Admin views
│   ├── user_dashboard   # User views
│   └── ...
├── app.js               # Main application entry point
└── package.json         # Dependencies & scripts
```

---

## ⚙️ Installation & Setup

Follow these steps to get the project running on your local machine.

### 1. Clone the Repository
```bash
git clone https://github.com/Kondareddy1209/Hackfinity-TechArmy.git
cd Hackfinity-TechArmy
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory and populate it with your credentials:

```env
# Server
PORT=3000

# Database
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/agent-seller

# Security
SESSION_SECRET=your_super_secret_session_key
JWT_SECRET=your_jwt_signing_key

# Google Auth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI Services
GOOGLE_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key

# Firebase Storage
FIREBASE_API_KEY=xxx
FIREBASE_AUTH_DOMAIN=xxx
FIREBASE_PROJECT_ID=xxx
FIREBASE_STORAGE_BUCKET=xxx
FIREBASE_MESSAGING_SENDER_ID=xxx
FIREBASE_APP_ID=xxx

# Email Service (For OTP)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password
```

### 4. Firebase Admin Setup
1.  Download your **Service Account Key** JSON from Firebase Console.
2.  Save it inside the `config/` folder.
3.  Ensure `app.js` points to the correct filename.

### 5. Run the Application
```bash
# Development Mode (with Nodemon)
npm run dev

# Production Mode
node app.js
```

Visit `http://localhost:3000` to see the app in action!

---

## 📸 Screenshots

| Login Page | Dashboard | AI Chat |
| :---: | :---: | :---: |
| *(Add Login Image)* | *(Add Dashboard Image)* | *(Add Chat Image)* |

---

## 🤝 Contributing

We welcome contributions!
1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

### 👨‍💻 Developed by **Hackfinity TechArmy**
*Empowering the next generation of e-commerce.*
