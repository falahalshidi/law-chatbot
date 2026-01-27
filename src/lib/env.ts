// Environment variables for API configuration
// In production, these should be set via environment variables

// ChromaDB Configuration
export const CHROMADB_API_KEY = import.meta.env.VITE_CHROMADB_API_KEY;
export const CHROMADB_TENANT = import.meta.env.VITE_CHROMADB_TENANT;
export const CHROMADB_DATABASE = import.meta.env.VITE_CHROMADB_DATABASE;

// OpenRouter Configuration
export const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
export const OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || process.env.OPENROUTER_MODEL || "z-ai/glm-4.5-air:free";
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Legacy Pinecone (kept for backward compatibility, can be removed later)
export const PINECONE_API_KEY = import.meta.env.VITE_PINECONE_API_KEY || "pcsk_64kjYg_Di6xiwQfc7ojDHAtJfuC7ZLyP7y2Thgh2FEJnr8qGK1QHnUTPaZqx8XDttF8SUy";
export const PINECONE_HOST = import.meta.env.VITE_PINECONE_HOST || "https://prod-1-data.ke.pinecone.io";
export const PINECONE_ASSISTANT_NAME = "lawchatbot";
export const PINECONE_CHAT_ENDPOINT = `${PINECONE_HOST}/assistant/chat/${PINECONE_ASSISTANT_NAME}`;

// Alternative: Direct OpenAI API (if you have OpenAI API key)
export const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";
export const USE_OPENAI_DIRECT = import.meta.env.VITE_USE_OPENAI_DIRECT === "true" || false;

