// C:\Users\Konda Reddy\OneDrive\Desktop\Hackfinity\services\geminiAgent.js

require('dotenv').config(); // Load environment variables from .env file
const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error("Warning: GOOGLE_API_KEY is not set in your .env file. AI features will be disabled.");
  // We'll return an error from the function instead of exiting the process here.
}

// IMPORTANT: Use the actual model name that works for you.
// From your `listModels` output, "models/gemini-pro" or "models/gemini-1.5-pro-latest"
// are good candidates.
const GEMINI_MODEL_NAME = "models/gemini-pro"; // Or "models/gemini-1.5-pro-latest"

// Initialize the Google Generative AI client only if API key exists
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

/**
 * Generates a concise product description using the Google Gemini AI.
 * @param {string} productName - The name of the product.
 * @param {string} keywords - Comma-separated keywords related to the product.
 * @returns {Promise<string>} The generated product description or an error message.
 */
async function generateProductDescription(productName, keywords) {
    if (!genAI) {
        return "AI agent not configured: Google API Key is missing or invalid.";
    }

    try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME });
        const prompt = `Generate a concise and engaging product description for a product named "${productName}". Focus on these keywords: ${keywords}. Keep it under 100 words.`;

        console.log(`Sending prompt to Gemini: "${prompt}"`); // Log the prompt

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return text;

    } catch (error) {
        console.error("Error generating product description with Gemini:", error.message);
        return "Failed to generate description. Please try again later. (AI Error: " + error.message + ")";
    }
}

/**
 * Lists available Google Gemini models. For debugging/selection.
 * @returns {Promise<Array<Object>>} An array of model objects or an empty array on error.
 */
async function listAvailableGeminiModels() {
  if (!genAI) {
    console.error("Warning: Cannot list models, Google API Key is not set.");
    return [];
  }
  try {
    const { models } = await genAI.listModels();
    return models;
  } catch (error) {
    console.error("Error listing models from Gemini API:", error.message);
    return [];
  }
}

module.exports = { generateProductDescription, listAvailableGeminiModels };