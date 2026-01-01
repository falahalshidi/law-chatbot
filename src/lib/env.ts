// Environment variables for API configuration
// In production, these should be set via environment variables

export const PINECONE_API_KEY = import.meta.env.VITE_PINECONE_API_KEY || "pcsk_64kjYg_Di6xiwQfc7ojDHAtJfuC7ZLyP7y2Thgh2FEJnr8qGK1QHnUTPaZqx8XDttF8SUy";
export const PINECONE_HOST = import.meta.env.VITE_PINECONE_HOST || "https://prod-1-data.ke.pinecone.io";
export const PINECONE_ASSISTANT_NAME = "lawchatbot";
export const PINECONE_CHAT_ENDPOINT = `${PINECONE_HOST}/assistant/chat/${PINECONE_ASSISTANT_NAME}`;

// Alternative: Direct OpenAI API (if you have OpenAI API key)
export const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";
export const USE_OPENAI_DIRECT = import.meta.env.VITE_USE_OPENAI_DIRECT === "true" || false;

