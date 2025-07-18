import os
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file (recommended for API keys)
load_dotenv()

# Get your Grok API key from environment variables
# Make sure you have XAI_API_KEY="your_api_key_here" in your .env file
XAI_API_KEY = os.getenv("XAI_API_KEY")

if XAI_API_KEY is None:
    raise ValueError("XAI_API_KEY environment variable not set. Please set it in your .env file or system environment.")

# Initialize the OpenAI client with Grok's base URL and your API key
client = OpenAI(
    api_key=XAI_API_KEY,
    base_url="https://api.x.ai/v1",
)

try:
    # Send a chat completion request
    response = client.chat.completions.create(
        model="grok-3",  # Or other available models like "grok-4", "grok-3-mini-beta", etc.
        messages=[
            {"role": "system", "content": "You are a helpful and witty AI assistant."},
            {"role": "user", "content": "Tell me a fun fact about the universe."},
        ],
        max_tokens=150,
        temperature=0.7, # Adjust for creativity vs. determinism
    )

    # Print the model's response
    print(response.choices[0].message.content)

except Exception as e:
    print(f"An error occurred: {e}")