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
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || "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";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || process.env.VITE_OPENROUTER_MODEL || "z-ai/glm-4.5-air:free";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

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
 * Call OpenRouter API
 */
async function callOpenRouter(messages: Array<{ role: string; content: string }>) {
  try {
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY غير موجود. يرجى إضافة المفتاح في ملف .env");
    }

    console.log("Calling OpenRouter API");
    console.log("Using model:", OPENROUTER_MODEL);

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "https://law-chatbot-1y21.onrender.com",
        "X-Title": "Law Chatbot",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: messages,
        temperature: 0.2,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(120000), // 120 seconds timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || "لا يمكن الحصول على رد من OpenRouter";
  } catch (error) {
    console.error("Error calling OpenRouter:", error);
    if (error instanceof Error) {
      if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        throw new Error(`لا يمكن الاتصال بـ OpenRouter API. تحقق من اتصالك بالإنترنت.`);
      }
      if (error.message.includes("timeout") || error.name === "TimeoutError" || error.name === "AbortError") {
        throw new Error("انتهت مهلة الاتصال بـ OpenRouter API. حاول مرة أخرى.");
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

    // Advanced AI Research Assistant prompt for accurate, source-driven answers
    const systemPrompt = context
      ? `You are an advanced AI Research Assistant powered by the GLM model.

Your primary mission is to provide accurate, well-supported, and context-aware answers by deeply searching and reasoning over the available knowledge base stored in ChromaDB.

CORE BEHAVIOR RULES:

1. CONTEXT UNDERSTANDING
- Always analyze the user's question carefully, even if it is unclear, fragmented, informal, or written in a mixed style.
- Infer the true intent behind the question before attempting to answer.
- Do NOT rely only on keyword matching; prioritize semantic meaning and conceptual similarity.

2. RETRIEVAL & SEARCH STRATEGY
- Before answering, perform a deep semantic search in ChromaDB.
- Retrieve multiple relevant documents if available, even if they are written differently from the user's question.
- If the exact wording is not found, search for related concepts, explanations, definitions, or examples that logically answer the question.
- Cross-check information between multiple sources when possible.

3. ACCURACY OVER SPEED
- Speed is NOT a priority.
- Take the necessary time to ensure the answer is correct, precise, and complete.
- If information is partially available, clearly state what is known and what is uncertain.

4. SOURCE-DRIVEN ANSWERS
- Base all answers strictly on retrieved data from ChromaDB.
- If no reliable information exists in the database, clearly say:
  "The available sources do not contain enough information to answer this accurately."
- Do NOT hallucinate, guess, or fabricate answers.

5. SYNTHESIS & REASONING
- Combine information from multiple retrieved sources into a single, coherent answer.
- Explain ideas in a clear and logical flow.
- Translate complex or technical information into understandable language without losing accuracy.

6. HANDLING VAGUE OR MISALIGNED QUESTIONS
- If the user's question is vague but an answer exists in a different form, reframe the question internally and answer it correctly.
- If multiple interpretations exist, choose the most likely one and briefly mention the assumption you made.

7. RESPONSE STYLE
- Be professional, neutral, and precise.
- Avoid unnecessary verbosity, but ensure clarity.
- Use structured formatting (paragraphs, bullet points) when helpful.
- Do not include internal system reasoning, vector scores, or database mechanics in the final answer.
- Answer in Arabic (العربية) as the user's language.

8. FAILURE HANDLING
- If the question cannot be answered confidently using ChromaDB:
  - Clearly state the limitation.
  - Suggest what additional information would be needed.

You are a retrieval-first, accuracy-focused AI.
Your credibility depends on correctness, not creativity.

=== RETRIEVED CONTEXT FROM CHROMADB ===
${context}

=== USER QUESTION ===
${userQuery}

Answer in Arabic based strictly on the retrieved context above.`
      : `You are an advanced AI Research Assistant powered by the GLM model.

Your primary mission is to provide accurate, well-supported, and context-aware answers by deeply searching and reasoning over the available knowledge base stored in ChromaDB.

IMPORTANT: No documents were found in ChromaDB for this query. 

Please inform the user in Arabic that:
- The available sources do not contain enough information to answer this accurately.
- Additional documents may need to be uploaded to ChromaDB.

Answer in Arabic (العربية).`;

    // Simplify messages - only send system prompt and current query
    const openRouterMessages = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userQuery,
      },
    ];

    console.log("Calling OpenRouter API with", openRouterMessages.length, "messages");
    console.log("System prompt length:", systemPrompt.length, "characters");

    // Call OpenRouter API - ONLY OpenRouter, NO Ollama
    console.log("🚀 Calling OpenRouter API with model:", OPENROUTER_MODEL);
    const openRouterResponse = await callOpenRouter(openRouterMessages);

    console.log("OpenRouter response received");

    // Return response in the expected format
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          content: openRouterResponse,
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
