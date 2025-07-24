// services/groqAgent.js
require('dotenv').config();
const Groq = require('groq-sdk');

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
 * @param {boolean} [returnJson=false] - Whether to explicitly ask Groq for a JSON object.
 * @param {string} [systemPrompt="You are a helpful AI assistant."] - Custom system prompt for the AI.
 * @returns {Promise<string|object>} The AI's response (string or parsed JSON object if returnJson is true and successful).
 */
async function getGroqChatCompletion(message, returnJson = false, systemPrompt = "You are a helpful AI assistant.") {
    if (!groq) {
        return "Groq AI agent not configured: GROQ_API_KEY is missing or invalid.";
    }

    try {
        console.log(`[Groq Agent] Sending message to Groq (JSON request: ${returnJson}): "${message.substring(0, Math.min(message.length, 100))}..."`);

        const chatCompletionOptions = {
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message },
            ],
            model: "llama3-8b-8192", // You can choose other models
            temperature: returnJson ? 0.1 : 0.7, // Lower temperature for more structured JSON
            max_tokens: returnJson ? 1000 : 500, // More tokens if expecting a complex JSON
        };

        if (returnJson) {
            chatCompletionOptions.response_format = { type: "json_object" };
        }

        const chatCompletion = await groq.chat.completions.create(chatCompletionOptions);
        const rawReplyContent = chatCompletion.choices[0]?.message?.content;

        if (returnJson) {
            try {
                const parsedJson = JSON.parse(rawReplyContent);
                console.log(`[Groq Agent] Received JSON reply.`);
                return parsedJson; // Return the parsed JSON object
            } catch (parseError) {
                console.error("Error parsing Groq's JSON response:", parseError);
                // If parsing fails, return the raw text with an error prefix
                return `[JSON PARSE ERROR] Groq responded, but the JSON was invalid: ${rawReplyContent}`;
            }
        } else {
            console.log(`[Groq Agent] Received text reply (first 100 chars): "${rawReplyContent.substring(0, Math.min(rawReplyContent.length, 100))}..."`);
            return rawReplyContent || "No response from Groq AI.";
        }

    } catch (error) {
        console.error("Error communicating with Groq AI:", error);
        let errorMessage = `Failed to get response from Groq AI.`;
        if (error.response && error.response.status) {
            console.error(`Groq API Status: ${error.response.status}`);
            console.error(`Groq API Data: ${JSON.stringify(error.response.data)}`);
            if (error.response.status === 401) {
                errorMessage += " (Authentication error - check API key)";
            } else if (error.response.status === 429) {
                errorMessage += " (Rate limit exceeded - try again later)";
            } else {
                errorMessage += ` (Error: ${error.message})`;
            }
        } else {
            errorMessage += ` (Network error: ${error.message})`;
        }
        return errorMessage;
    }
}

module.exports = { getGroqChatCompletion };