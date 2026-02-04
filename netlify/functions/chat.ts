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
