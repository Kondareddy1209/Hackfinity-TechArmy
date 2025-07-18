// services/groqAgent.js
require('dotenv').config();
const Groq = require('groq-sdk'); // Make sure you've run: npm install groq-sdk

const GROQ_API_KEY = process.env.GROQ_API_KEY;

let groq = null;
if (GROQ_API_KEY) {
    groq = new Groq({ apiKey: GROQ_API_KEY });
    console.log("[Groq Agent] Groq SDK initialized.");
} else {
    console.error("Warning: GROQ_API_KEY is not set in your .env file. Groq AI features will be disabled.");
}

/**
 * Sends a text message to Groq AI and gets a response.
 * @param {string} message - The user's message.
 * @returns {Promise<string>} The AI's response.
 */
async function getGroqChatCompletion(message) {
    if (!groq) {
        return "Groq AI agent not configured: GROQ_API_KEY is missing or invalid.";
    }

    try {
        console.log(`[Groq Agent] Sending message to Groq: "${message.substring(0, Math.min(message.length, 100))}..."`);
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: message,
                },
            ],
            model: "llama3-8b-8192", // You can choose other models like "mixtral-8x7b-32768", "llama3-70b-8192"
            temperature: 0.7, // Adjust creativity (0.0 - 1.0)
            max_tokens: 500, // Max tokens in the AI's response
        });

        const reply = chatCompletion.choices[0]?.message?.content;
        console.log(`[Groq Agent] Received reply (first 100 chars): "${reply.substring(0, Math.min(reply.length, 100))}..."`);
        return reply || "No response from Groq AI.";
    } catch (error) {
        console.error("Error communicating with Groq AI:", error);
        if (error.response && error.response.status) {
            console.error(`Groq API Status: ${error.response.status}`);
            console.error(`Groq API Data: ${JSON.stringify(error.response.data)}`);
            if (error.response.status === 401) {
                return "Failed to get response from Groq AI. (Authentication error - check API key)";
            }
            if (error.response.status === 429) {
                return "Failed to get response from Groq AI. (Rate limit exceeded - try again later)";
            }
        }
        return `Failed to get response from Groq AI. (Error: ${error.message})`;
    }
}

module.exports = { getGroqChatCompletion };