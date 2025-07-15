// utils/helpers.js - General Helper Functions

function generateDescription(name, category) {
    /**
     * Generates a basic product description based on name and category.
     * This is a rule-based simulation of AI for the hackathon MVP.
     * In a real application, this would involve a call to an LLM like GPT.
     */
    const templates = {
        "vegetables": `Farm-fresh ${name}, perfect for healthy meals and cooking.`,
        "fruits": `Juicy, ripe ${name} for a sweet treat or healthy snack.`,
        "handicrafts": `Beautifully handmade ${name}, a unique piece of art.`,
        "grains": `High-quality ${name}, essential for a balanced diet.`,
        "dairy": `Fresh ${name} products, rich in nutrients.`,
        "spices": `Aromatic ${name}, adding flavor to your dishes.`,
        "clothing": `Comfortable and stylish ${name} for everyday wear.`,
        "electronics": `Innovative ${name} with cutting-edge features.`
    };
    // Convert category to lowercase for consistent lookup
    return templates[category.toLowerCase()] || `Quality ${name} available now. A versatile product for various uses.`;
}

module.exports = { generateDescription };
