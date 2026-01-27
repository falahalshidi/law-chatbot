// Polyfill for import.meta.url in Netlify Functions (serverless environment)
// This must be done BEFORE importing @xenova/transformers
if (typeof import.meta === "undefined" || typeof import.meta.url === "undefined") {
  // @ts-ignore
  globalThis.import = globalThis.import || {};
  // @ts-ignore
  globalThis.import.meta = globalThis.import.meta || {};
  // @ts-ignore
  globalThis.import.meta.url = `file://${process.cwd()}/netlify/functions/chat.ts`;
}

import type { HandlerEvent, HandlerContext } from "@netlify/functions";
import { CloudClient } from "chromadb";
import { pipeline, env } from "@xenova/transformers";

// Disable local model files for serverless
env.allowLocalModels = false;
// Fix for Netlify Functions - prevent fileURLToPath error
// Configure environment to avoid using import.meta.url
if (typeof process !== "undefined") {
  // Prevent fileURLToPath errors in serverless environment
  // Set paths that don't require import.meta.url
  (env as any).localModelPath = "/tmp";
  (env as any).cacheDir = "/tmp";
  (env as any).useBrowserCache = false;
  (env as any).useCustomCache = false;
  // Try to set a fake import.meta.url if possible
  try {
    // @ts-ignore - attempt to set import.meta.url
    if (typeof import.meta !== "undefined" && !import.meta.url) {
      // @ts-ignore
      import.meta.url = `file:///tmp/netlify/functions/chat.ts`;
    }
  } catch (e) {
    // Ignore - import.meta is read-only in some environments
    console.log("Could not set import.meta.url polyfill:", e);
  }
}

const CHROMADB_API_KEY = process.env.CHROMADB_API_KEY || process.env.VITE_CHROMADB_API_KEY || "ck-3EDSUCED38no4aLq8rgMXzTwe14fvnATpGEkwWMgrkEV";
const CHROMADB_TENANT = process.env.CHROMADB_TENANT || process.env.VITE_CHROMADB_TENANT || "bf8e9ba0-6e6f-4365-a930-2c5ef360f292";
const CHROMADB_DATABASE = process.env.CHROMADB_DATABASE || process.env.VITE_CHROMADB_DATABASE || "lawchat";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama2";

const COLLECTION_NAME = "law_documents";

// Initialize ChromaDB client
const chromaClient = new CloudClient({
  apiKey: CHROMADB_API_KEY,
  tenant: CHROMADB_TENANT,
  database: CHROMADB_DATABASE,
});

// Initialize embedding model (cached)
let embeddingModel: any = null;

async function getEmbeddingModel() {
  if (!embeddingModel) {
    embeddingModel = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      {
        progress_callback: (progress: any) => {
          if (progress.status === "downloading") {
            console.log(`Downloading model: ${Math.round(progress.progress || 0)}%`);
          }
        },
      }
    );
  }
  return embeddingModel;
}

/**
 * Create embedding for text
 */
async function createEmbedding(text: string): Promise<number[]> {
  const model = await getEmbeddingModel();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data) as number[];
}

/**
 * Search ChromaDB for relevant documents
 */
async function searchRelevantDocuments(queryEmbedding: number[], nResults: number = 5) {
  try {
    const collection = await chromaClient.getCollection({
      name: COLLECTION_NAME,
    } as any);

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: nResults,
    });

    return results;
  } catch (error) {
    console.error("Error searching ChromaDB:", error);
    return null;
  }
}

/**
 * Call Ollama API
 */
async function callOllama(messages: Array<{ role: string; content: string }>) {
  try {
    console.log("Calling Ollama at:", OLLAMA_URL);
    console.log("Using model:", OLLAMA_MODEL);
    
    // Check if Ollama URL is localhost and we're in production
    if (OLLAMA_URL.includes("localhost") && process.env.NETLIFY) {
      throw new Error("Ollama على localhost لا يمكن الوصول إليه من Netlify Functions. استخدم URL عام أو استخدم Netlify Dev محلياً.");
    }
    
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: messages,
        stream: false,
      }),
      // Add timeout
      signal: AbortSignal.timeout(60000), // 60 seconds timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ollama API error:", response.status, errorText);
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.message?.content || data.response || "لا يمكن الحصول على رد من Ollama";
  } catch (error) {
    console.error("Error calling Ollama:", error);
    if (error instanceof Error) {
      // Provide more helpful error messages
      if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        throw new Error(`لا يمكن الاتصال بـ Ollama على ${OLLAMA_URL}. تأكد من أن Ollama يعمل وأن URL صحيح.`);
      }
      if (error.message.includes("timeout")) {
        throw new Error("انتهت مهلة الاتصال بـ Ollama. حاول مرة أخرى.");
      }
    }
    throw error;
  }
}

const handler = async (event: HandlerEvent, _context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const messages = body.messages || [];
    
    if (messages.length === 0) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "No messages provided" }),
      };
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    const userQuery = lastMessage.content || "";

    if (!userQuery.trim()) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "Empty query" }),
      };
    }

    console.log("Processing query:", userQuery);

    // Create embedding for the query
    const queryEmbedding = await createEmbedding(userQuery);
    console.log("Query embedding created, length:", queryEmbedding.length);

    // Search ChromaDB for relevant documents
    const searchResults = await searchRelevantDocuments(queryEmbedding, 5);

    // Build context from retrieved documents
    let context = "";
    if (searchResults && searchResults.documents && searchResults.documents[0]) {
      const relevantDocs = searchResults.documents[0];
      const distances = searchResults.distances?.[0] || [];
      
      context = relevantDocs
        .map((doc: string | null, index: number) => {
          if (!doc) return null;
          const distance = distances[index] || 1;
          // Only include documents with reasonable similarity (distance < 0.8)
          if (distance < 0.8) {
            return `[مستند ${index + 1}]:\n${doc}`;
          }
          return null;
        })
        .filter((doc): doc is string => doc !== null)
        .join("\n\n");
    }

    // Build messages for Ollama
    const systemPrompt = context
      ? `أنت مساعد قانوني ذكي. استخدم المعلومات التالية من قاعدة البيانات القانونية للإجابة على السؤال. إذا كانت المعلومات غير كافية، استخدم معرفتك العامة.

المعلومات من قاعدة البيانات:
${context}

أجب على السؤال بناءً على المعلومات المتوفرة أعلاه.`
      : `أنت مساعد قانوني ذكي. أجب على السؤال القانوني بشكل واضح ومفيد.`;

    const ollamaMessages = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...messages.slice(0, -1), // All messages except the last one
      {
        role: "user",
        content: userQuery,
      },
    ];

    console.log("Calling Ollama with", ollamaMessages.length, "messages");

    // Call Ollama
    const ollamaResponse = await callOllama(ollamaMessages);

    console.log("Ollama response received");

    // Return response in the expected format
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          content: ollamaResponse,
        },
      }),
    };
  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
    };
  }
};

export { handler };
