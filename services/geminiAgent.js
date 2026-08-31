const { GoogleGenerativeAI } = require('@google/generative-ai');

// IMPORTANT: Use the actual model name that works for you.
// From your `listModels` output, "models/gemini-pro" or "models/gemini-1.5-pro-latest"
// are good candidates.
// Update model name to not include 'models/' prefix, SDK handles it.
const GEMINI_MODEL_NAME = "gemini-1.5-flash";

/**
 * Generates a concise product description using the Google Gemini AI.
 * @param {string} productName - The name of the product.
 * @param {string} keywords - Comma-separated keywords related to the product.
 * @param {string} tone - The desired tone of the description (e.g., Professional, Fun).
 * @param {string} language - The language for the description.
 * @returns {Promise<string>} The generated product description or an error message.
 */
async function generateProductDescription(productName, keywords, tone = 'Professional', language = 'English') {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return "AI agent not configured: Google API Key is missing or invalid.";
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const tryGenerate = async (modelName) => {
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `Generate a concise and engaging product description for a product named "${productName}". Focus on these keywords: ${keywords}. The tone should be ${tone}. The description MUST be written in ${language}. Keep it under 100 words.`;
    console.log(`Sending prompt to Gemini (${modelName}): "${prompt}"`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  };

  try {
    return await tryGenerate(GEMINI_MODEL_NAME);
  } catch (error) {
    console.warn(`Gemini generation failed with ${GEMINI_MODEL_NAME}. Trying fallback 'gemini-pro'. Error:`, error.message);
    try {
      return await tryGenerate("gemini-pro");
    } catch (fallbackError) {
      console.error("Error generating product description with Gemini (Fallback):", fallbackError.message);
      return "Failed to generate description. Please try again later. (AI Error: " + fallbackError.message + ")";
    }
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