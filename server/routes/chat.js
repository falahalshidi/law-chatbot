import { CloudClient } from "chromadb";
import { pipeline, env } from "@xenova/transformers";

// Configure transformers
env.allowLocalModels = false;
env.remoteURL = "https://huggingface.co";
env.remotePathTemplate = "{model}/resolve/{revision}/{file}";

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
let embeddingModel = null;

async function getEmbeddingModel() {
  if (!embeddingModel) {
    try {
      console.log("Loading embedding model (this may take a minute on first run)...");
      embeddingModel = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        {
          progress_callback: (progress) => {
            if (progress.status === "downloading") {
              console.log(`Downloading model: ${progress.progress || 0}%`);
            }
          },
        }
      );
      console.log("Embedding model loaded successfully");
    } catch (error) {
      console.error("Error loading embedding model:", error);
      throw new Error(`فشل تحميل نموذج embeddings. تحقق من اتصالك بالإنترنت: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  return embeddingModel;
}

async function createEmbedding(text) {
  const model = await getEmbeddingModel();
  const output = await model(text, { pooling: "mean", normalize: true });
  if (!output || !output.data) {
    throw new Error("Failed to create embedding: no output data");
  }
  return Array.from(output.data);
}

async function searchRelevantDocuments(queryEmbedding, nResults = 5) {
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

// Check available models in Ollama
async function getAvailableModels() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (response.ok) {
      const data = await response.json();
      return data.models?.map(m => m.name) || [];
    }
    return [];
  } catch (error) {
    console.error("Error fetching available models:", error);
    return [];
  }
}

async function callOllama(messages) {
  try {
    console.log("Calling Ollama at:", OLLAMA_URL);
    console.log("Using model:", OLLAMA_MODEL);
    
    // First, check if model exists
    const availableModels = await getAvailableModels();
    console.log("Available models:", availableModels);
    
    if (availableModels.length === 0) {
      throw new Error("لا توجد نماذج مثبتة في Ollama. قم بتحميل نموذج أولاً باستخدام: ollama pull llama2");
    }
    
    // Try to find a suitable model
    let modelToUse = OLLAMA_MODEL;
    if (!availableModels.includes(OLLAMA_MODEL)) {
      // Try common alternatives
      const alternatives = ['llama2', 'llama3', 'mistral', 'phi', 'gemma', 'qwen'];
      const foundModel = alternatives.find(m => availableModels.includes(m));
      
      if (foundModel) {
        console.log(`⚠️ Model '${OLLAMA_MODEL}' not found, using '${foundModel}' instead`);
        modelToUse = foundModel;
      } else if (availableModels.length > 0) {
        console.log(`⚠️ Model '${OLLAMA_MODEL}' not found, using '${availableModels[0]}' instead`);
        modelToUse = availableModels[0];
      } else {
        throw new Error(`النموذج '${OLLAMA_MODEL}' غير موجود. النماذج المتاحة: ${availableModels.join(', ') || 'لا يوجد'}. قم بتحميل نموذج باستخدام: ollama pull ${OLLAMA_MODEL}`);
      }
    }
    
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: messages,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ollama API error:", response.status, errorText);
      
      if (response.status === 404) {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.includes("not found")) {
          throw new Error(`النموذج '${modelToUse}' غير موجود في Ollama. قم بتحميله باستخدام: ollama pull ${modelToUse}`);
        }
      }
      
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.message?.content || data.response || "لا يمكن الحصول على رد من Ollama";
  } catch (error) {
    console.error("Error calling Ollama:", error);
    if (error instanceof Error) {
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

export async function chatHandler(req, res) {
  try {
    const { messages } = req.body;
    
    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: "No messages provided" });
    }

    const lastMessage = messages[messages.length - 1];
    const userQuery = lastMessage.content || "";

    if (!userQuery.trim()) {
      return res.status(400).json({ error: "Empty query" });
    }

    console.log("Processing query:", userQuery);

    const queryEmbedding = await createEmbedding(userQuery);
    console.log("Query embedding created, length:", queryEmbedding.length);

    const searchResults = await searchRelevantDocuments(queryEmbedding, 5);

    let context = "";
    if (searchResults && searchResults.documents && searchResults.documents[0]) {
      const relevantDocs = searchResults.documents[0];
      const distances = searchResults.distances?.[0] || [];
      
      context = relevantDocs
        .map((doc, index) => {
          const distance = distances[index] || 1;
          if (distance < 0.8) {
            return `[مستند ${index + 1}]:\n${doc}`;
          }
          return null;
        })
        .filter((doc) => doc !== null)
        .join("\n\n");
    }

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
      ...messages.slice(0, -1),
      {
        role: "user",
        content: userQuery,
      },
    ];

    console.log("Calling Ollama with", ollamaMessages.length, "messages");

    const ollamaResponse = await callOllama(ollamaMessages);

    console.log("Ollama response received");

    res.json({
      message: {
        content: ollamaResponse,
      },
    });
  } catch (error) {
    console.error("Function error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

