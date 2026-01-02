require('dotenv').config(); // Load environment variables from .env file
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Access your API key as an environment variable
const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error("Error: GOOGLE_API_KEY is not set in your .env file.");
  console.error("Please ensure your .env file has GOOGLE_API_KEY=\"YOUR_GEMINI_API_KEY_HERE\"");
  process.exit(1); // Exit the process if API key is missing
}

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(API_KEY);

// Use a model name that was listed as available and supports 'generateContent'.
// "models/gemini-pro" is listed as available.
// If this still gives 404, try "models/gemini-1.5-pro-latest" or "models/gemini-1.5-flash-latest".
const MODEL_NAME = "models/gemini-pro"; // <--- Updated based on your `listModels` output

async function runGeminiAgent(query) {
  try {
    // For text-only input, use the appropriate model name
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    console.log(`Agent processing query: "${query}" using Google Gemini model: ${MODEL_NAME}`);

    const result = await model.generateContent(query);
    const response = await result.response;
    const text = response.text();
    return text;

  } catch (error) {
    console.error("Error communicating with Google Gemini API:", error.message);
    if (error.status) { // Check if error has a status property for API errors
        console.error("Google API Error Status:", error.status);
    }
    return "Sorry, I couldn't process your request with Google Gemini at the moment.";
  }
}

// Example usage:
(async () => {
  console.log("\n--- Agent Responses ---");

  try {
    const response1 = await runGeminiAgent("What is the capital of Canada?");
    console.log("Response 1:", response1);
  } catch (err) {
    console.error("Error with Response 1 example:", err.message);
  }

  try {
    const response2 = await runGeminiAgent("Write a short, encouraging message for someone starting a new coding project.");
    console.log("Response 2:", response2);
  } catch (err) {
    console.error("Error with Response 2 example:", err.message);
  }

  try {
    const response3 = await runGeminiAgent("Explain the concept of recursion in programming simply.");
    console.log("Response 3:", response3);
  } catch (err) {
    console.error("Error with Response 3 example:", err.message);
  }

})();

// --- Optional: The listModels function (now commented out as we have the list) ---
/*
async function listModels() {
  console.log("\n--- Listing available Google Gemini models ---");
  try {
    const { models: modelList } = await genAI.listModels(); // Corrected method

    for (const model of modelList) {
      console.log(`- Model Name: ${model.name}`);
      console.log(`  Description: ${model.description || 'N/A'}`);
      console.log(`  Input Token Limit: ${model.inputTokenLimit || 'N/A'}`);
      console.log(`  Output Token Limit: ${model.outputTokenLimit || 'N/A'}`);
      console.log(`  Supported Methods: ${model.supportedGenerationMethods ? model.supportedGenerationMethods.join(', ') : 'N/A'}`);
      console.log('---');
    }
  } catch (error) {
    console.error("Error listing models:", error.message);
    if (error.status) {
        console.error("Google API Error Status:", error.status);
    }
  }
}

// Do NOT uncomment this line unless you need to list models again
// listModels();
*/