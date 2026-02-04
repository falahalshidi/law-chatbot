import type { HandlerEvent, HandlerContext } from "@netlify/functions";
import { CloudClient } from "chromadb";
import { localHashEmbeddingFunction } from "./_lib/hash-embedding";

// ChromaDB Cloud automatically generates embeddings - no need for @xenova/transformers
// This reduces function size from >250MB to <50MB

const CHROMADB_API_KEY =
  process.env.CHROMADB_API_KEY ||
  process.env.CHROMA_API_KEY ||
  process.env.VITE_CHROMADB_API_KEY ||
  process.env.VITE_CHROMA_API_KEY;
const CHROMADB_TENANT =
  process.env.CHROMADB_TENANT ||
  process.env.CHROMA_TENANT ||
  process.env.VITE_CHROMADB_TENANT ||
  process.env.VITE_CHROMA_TENANT;
const CHROMADB_DATABASE =
  process.env.CHROMADB_DATABASE ||
  process.env.CHROMA_DATABASE ||
  process.env.VITE_CHROMADB_DATABASE ||
  process.env.VITE_CHROMA_DATABASE;
const CHAT_API_KEY =
  process.env.APIFREE_API_KEY ||
  process.env.OPENROUTER_API_KEY ||
  process.env.VITE_OPENROUTER_API_KEY;
const CHAT_MODEL =
  process.env.APIFREE_MODEL ||
  process.env.OPENROUTER_MODEL ||
  process.env.VITE_OPENROUTER_MODEL ||
  "openai/gpt-5-mini";
const CHAT_API_URL =
  (process.env.APIFREE_API_URL || "https://api.apifree.ai/v1/chat/completions")
    .replace("https://www.apifree.ai/", "https://api.apifree.ai/");

const COLLECTION_NAME = "law_documents";

// Validate ChromaDB configuration
if (!CHROMADB_API_KEY || !CHROMADB_TENANT || !CHROMADB_DATABASE) {
  console.error("❌ ChromaDB configuration is missing!");
  console.error("Required environment variables:", {
    CHROMADB_API_KEY: !!CHROMADB_API_KEY,
    CHROMADB_TENANT: !!CHROMADB_TENANT,
    CHROMADB_DATABASE: !!CHROMADB_DATABASE,
  });
}

let chromaClient: CloudClient | null = null;

// ChromaDB Cloud automatically generates embeddings from query text
// No need to create embeddings manually

/**
 * Get or create collection
 */
async function getCollection() {
  if (!CHROMADB_API_KEY || !CHROMADB_TENANT || !CHROMADB_DATABASE) {
    throw new Error("Missing ChromaDB environment variables (CHROMADB_API_KEY, CHROMADB_TENANT, CHROMADB_DATABASE)");
  }

  if (!chromaClient) {
    chromaClient = new CloudClient({
      apiKey: CHROMADB_API_KEY,
      tenant: CHROMADB_TENANT,
      database: CHROMADB_DATABASE,
    });
  }

  try {
    const collection = await chromaClient.getCollection({
      name: COLLECTION_NAME,
      embeddingFunction: localHashEmbeddingFunction as any,
    } as any);
    return collection;
  } catch (error) {
    console.log("Collection not found, creating new one...");
    try {
      const collection = await chromaClient.createCollection({
        name: COLLECTION_NAME,
        embeddingFunction: localHashEmbeddingFunction as any,
      });
      return collection;
    } catch (createError) {
      console.error("Error creating collection:", createError);
      throw new Error(`Failed to get or create ChromaDB collection: ${createError instanceof Error ? createError.message : "Unknown error"}`);
    }
  }
}

/**
 * Search ChromaDB for relevant documents
 * ChromaDB Cloud automatically generates embeddings from query text
 */
async function searchRelevantDocuments(queryText: string, nResults: number = 5) {
  try {
    const collection = await getCollection();
    
    console.log("Querying ChromaDB with query text:", queryText.substring(0, 100) + "...");
    console.log("ChromaDB Cloud will automatically generate embeddings from the query text");
    
    // Use queryTexts instead of queryEmbeddings - ChromaDB Cloud generates embeddings automatically
    const results = await collection.query({
      queryTexts: [queryText],
      nResults: nResults,
    });

    console.log("ChromaDB query results:", {
      documentsCount: results.documents?.[0]?.length || 0,
      idsCount: results.ids?.[0]?.length || 0,
      distancesCount: results.distances?.[0]?.length || 0,
    });

    return results;
  } catch (error) {
    console.error("Error searching ChromaDB:", error);
    console.error("Error details:", error instanceof Error ? error.stack : error);
    return null;
  }
}

/**
 * Call chat completion API (apifree.ai)
 */
async function callChatApi(messages: Array<{ role: string; content: string }>) {
  try {
    if (!CHAT_API_KEY) {
      throw new Error("APIFREE_API_KEY غير موجود. يرجى إضافة المفتاح في ملف .env");
    }

    console.log("Calling chat API");
    console.log("Using model:", CHAT_MODEL);

    const response = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CHAT_API_KEY}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages,
        stream: false,
        temperature: 0.2,
        max_tokens: 1000,
        max_completion_tokens: 1000,
      }),
      signal: AbortSignal.timeout(120000), // 120 seconds timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Chat API error:", response.status, errorText);
      throw new Error(`Chat API error (${response.status}): ${errorText}`);
    }

    const raw = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(raw);
    } catch {
      if (raw.trim()) return raw.trim();
      throw new Error("Empty response body from provider");
    }

    const content =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      data?.message?.content ||
      data?.message ||
      data?.content ||
      data?.response ||
      data?.output?.[0]?.content?.[0]?.text ||
      data?.output_text ||
      "";

    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }

    console.error("Unexpected chat API response format:", JSON.stringify(data).slice(0, 1000));
    throw new Error("صيغة الاستجابة من مزود الذكاء غير متوقعة");
  } catch (error) {
    console.error("Error calling chat API:", error);
    if (error instanceof Error) {
      if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        throw new Error(`لا يمكن الاتصال بخدمة الذكاء الاصطناعي. تحقق من اتصالك بالإنترنت.`);
      }
      if (error.message.includes("timeout") || error.name === "TimeoutError" || error.name === "AbortError") {
        throw new Error("انتهت مهلة الاتصال بالخدمة. حاول مرة أخرى.");
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

    // Search ChromaDB for relevant documents
    // ChromaDB Cloud will automatically generate embeddings from the query text
    console.log("Searching ChromaDB (embeddings will be generated automatically)...");
    const searchResults = await searchRelevantDocuments(userQuery, 5);

    // Build context from retrieved documents
    let context = "";
    if (searchResults && searchResults.documents && searchResults.documents[0]) {
      const relevantDocs = searchResults.documents[0];
      const distances = searchResults.distances?.[0] || [];
      
      console.log(`Found ${relevantDocs.length} relevant documents`);
      console.log(`Distances: ${distances.map((d) => Number(d ?? 0).toFixed(3)).join(', ')}`);
      
      // Increase context length for better answers
      const maxContextLength = 2500; // Increase to 2500 chars for better context
      let contextLength = 0;
      
      // Sort documents by distance (most relevant first)
      const docsWithDistances = relevantDocs.map((doc, index) => ({
        doc,
        distance: distances[index] || 1,
        index
      })).sort((a, b) => a.distance - b.distance);
      
      context = docsWithDistances
        .map(({ doc, distance, index }) => {
          // Very lenient distance threshold - include all documents (distance can be > 1.0)
          // Lower distance = more relevant, but we'll include all found documents
          if (!doc) return null;
          if (contextLength < maxContextLength) {
            // Increase document size to 600 chars for better context
            const truncatedDoc = doc.length > 600 ? doc.substring(0, 600) + "..." : doc;
            const docText = `[مستند ${index + 1} - مسافة: ${distance.toFixed(3)}]:\n${truncatedDoc}`;
            if (contextLength + docText.length > maxContextLength) {
              // Truncate if needed
              const remaining = maxContextLength - contextLength;
              contextLength = maxContextLength;
              return docText.substring(0, remaining) + "...";
            }
            contextLength += docText.length;
            return docText;
          }
          return null;
        })
        .filter((doc): doc is string => doc !== null)
        .join("\n\n");
      
      if (context.length === 0 && docsWithDistances.length > 0) {
        console.log("⚠️ WARNING: No context generated. Including top 3 documents anyway...");
        // Include top 3 documents if no context was generated
        context = docsWithDistances
          .slice(0, 3)
          .filter(({ doc }) => doc !== null)
          .map(({ doc, distance, index }) => {
            const truncatedDoc = doc!.length > 600 ? doc!.substring(0, 600) + "..." : doc!;
            return `[مستند ${index + 1} - مسافة: ${distance.toFixed(3)}]:\n${truncatedDoc}`;
          })
          .join("\n\n");
      }
      
      console.log(`Context length: ${context.length} characters`);
      if (context.length > 0) {
        console.log(`Context preview: ${context.substring(0, 300)}...`);
      }
    } else {
      console.log("⚠️ No relevant documents found in ChromaDB");
      console.log("Search results:", JSON.stringify(searchResults, null, 2));
    }

    // Strict RAG system prompt (Arabic-only answers, concise when needed)
    const systemPrompt = context
      ? `You are an AI assistant operating as a Retrieval-Augmented Generation (RAG) system.

Your primary task is to answer user questions strictly and exclusively based on the content available in the provided documents.

Rules:
1) Do not use any external knowledge, assumptions, general information, or personal reasoning beyond what is explicitly stated in the provided context.
2) If the documents do not contain sufficient or clear information, state clearly that there is not enough information in the documents to provide an answer. Do not guess or infer.
3) All final responses must be written in Arabic, while preserving the original meaning accurately and without adding new information.
4) Do not mention document names or references unless the user explicitly requests this.
5) Use a professional and clear style. You may use short, simple headings when useful, without excessive formatting.
6) Keep responses directly proportional to the user's input. For very short or social inputs (e.g., "السلام عليكم"), reply briefly and only as needed (e.g., "وعليكم السلام") without extra details.
7) Do not add information outside the user's question or outside the provided context.

=== RETRIEVED CONTEXT ===
${context}

=== USER QUESTION ===
${userQuery}

Answer in Arabic based only on the retrieved context above.`
      : `You are an AI assistant operating as a Retrieval-Augmented Generation (RAG) system.

Rules:
1) Answer only in Arabic.
2) If the required answer is not in the provided documents/context, say clearly that there is not enough information in the documents to answer.
3) Do not guess or add external knowledge.
4) Keep responses proportional to the user input; for greetings or very short social text, respond briefly only (e.g., "وعليكم السلام").

No retrieved context is available for this question. Respond accordingly in Arabic.`;

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

    console.log("Calling chat API with", openRouterMessages.length, "messages");
    console.log("System prompt length:", systemPrompt.length, "characters");

    console.log("🚀 Calling chat API with model:", CHAT_MODEL);
    const openRouterResponse = await callChatApi(openRouterMessages);

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
