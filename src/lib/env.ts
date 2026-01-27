// Environment variables for API configuration
// In production, these should be set via environment variables

// ChromaDB Configuration
export const CHROMADB_API_KEY = import.meta.env.VITE_CHROMADB_API_KEY || "ck-3EDSUCED38no4aLq8rgMXzTwe14fvnATpGEkwWMgrkEV";
export const CHROMADB_TENANT = import.meta.env.VITE_CHROMADB_TENANT || "bf8e9ba0-6e6f-4365-a930-2c5ef360f292";
export const CHROMADB_DATABASE = import.meta.env.VITE_CHROMADB_DATABASE || "lawchat";

// OpenRouter Configuration
export const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || "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";
export const OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || "z-ai/glm-4.5-air:free";

