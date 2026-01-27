import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "./env";
import { chromaClient } from "./chromadb";
import { createEmbedding } from "./embeddings";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const COLLECTION_NAME = "law_documents";

/**
 * Search for relevant documents in ChromaDB
 */
async function searchRelevantDocuments(
  queryEmbedding: number[],
  nResults: number = 5
) {
  try {
    const collection = await chromaClient.getCollection({
      name: COLLECTION_NAME,
    });

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
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": window.location.origin,
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
    return (
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.text ||
      "لا يمكن الحصول على رد من OpenRouter"
    );
  } catch (error) {
    console.error("Error calling OpenRouter:", error);
    if (error instanceof Error) {
      if (
        error.message.includes("fetch failed") ||
        error.message.includes("ECONNREFUSED")
      ) {
        throw new Error(
          `لا يمكن الاتصال بـ OpenRouter API. تحقق من اتصالك بالإنترنت.`
        );
      }
      if (
        error.message.includes("timeout") ||
        error.name === "TimeoutError" ||
        error.name === "AbortError"
      ) {
        throw new Error("انتهت مهلة الاتصال بـ OpenRouter API. حاول مرة أخرى.");
      }
    }
    throw error;
  }
}

/**
 * Send a chat message and get response
 */
export async function sendChatMessage(
  userQuery: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<string> {
  try {
    if (!userQuery.trim()) {
      throw new Error("الرسالة فارغة");
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

      console.log(`Found ${relevantDocs.length} relevant documents`);
      console.log(`Distances: ${distances.map((d: number) => d.toFixed(3)).join(", ")}`);

      const maxContextLength = 2500;
      let contextLength = 0;

      // Sort documents by distance (most relevant first)
      const docsWithDistances = relevantDocs
        .map((doc: string, index: number) => ({
          doc,
          distance: distances[index] || 1,
          index,
        }))
        .sort((a, b) => a.distance - b.distance);

      context = docsWithDistances
        .map(({ doc, distance, index }) => {
          if (contextLength < maxContextLength) {
            const truncatedDoc =
              doc.length > 600 ? doc.substring(0, 600) + "..." : doc;
            const docText = `[مستند ${index + 1} - مسافة: ${distance.toFixed(3)}]:\n${truncatedDoc}`;
            if (contextLength + docText.length > maxContextLength) {
              const remaining = maxContextLength - contextLength;
              contextLength = maxContextLength;
              return docText.substring(0, remaining) + "...";
            }
            contextLength += docText.length;
            return docText;
          }
          return null;
        })
        .filter((doc) => doc !== null)
        .join("\n\n");

      if (context.length === 0 && docsWithDistances.length > 0) {
        console.log("⚠️ WARNING: No context generated. Including top 3 documents anyway...");
        context = docsWithDistances
          .slice(0, 3)
          .map(({ doc, distance, index }) => {
            const truncatedDoc = doc.length > 600 ? doc.substring(0, 600) + "..." : doc;
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
    }

    // Build system prompt
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

    // Prepare messages for OpenRouter
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
    console.log("User query length:", userQuery.length, "characters");

    // Call OpenRouter API
    console.log("🚀 Calling OpenRouter API with model:", OPENROUTER_MODEL);
    const openRouterResponse = await callOpenRouter(openRouterMessages);

    console.log("OpenRouter response received");

    return openRouterResponse;
  } catch (error) {
    console.error("Error in sendChatMessage:", error);
    throw error;
  }
}
