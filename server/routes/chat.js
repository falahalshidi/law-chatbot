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

// Helper function to call Ollama with a specific model
async function callOllamaWithModel(messages, modelName) {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      messages: messages,
      stream: false,
      options: {
        num_predict: 512,
        temperature: 0.7,
        num_ctx: 1024,
        num_thread: 4,
      },
    }),
    signal: AbortSignal.timeout(300000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.message?.content || data.response || "لا يمكن الحصول على رد من Ollama";
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
    
    // Helper function to check if a model name matches (handles :latest, :7b, etc.)
    const modelMatches = (modelName, availableModel) => {
      const baseName = modelName.split(':')[0];
      const availableBase = availableModel.split(':')[0];
      return baseName === availableBase || availableModel === modelName || availableModel.startsWith(modelName + ':');
    };
    
    // Check if the configured model exists (with or without tag)
    const exactMatch = availableModels.find(m => modelMatches(OLLAMA_MODEL, m));
    if (exactMatch) {
      modelToUse = exactMatch;
    } else if (!availableModels.includes(OLLAMA_MODEL)) {
      // Try common alternatives, prioritizing smaller/faster models
      const alternatives = ['phi', 'gemma', 'qwen', 'llama2', 'llama3', 'mistral'];
      const foundModel = alternatives.find(alt => {
        return availableModels.find(m => modelMatches(alt, m));
      });
      
      if (foundModel) {
        const matchedModel = availableModels.find(m => modelMatches(foundModel, m));
        console.log(`⚠️ Model '${OLLAMA_MODEL}' not found, using '${matchedModel}' instead`);
        modelToUse = matchedModel;
      } else if (availableModels.length > 0) {
        // Prefer smaller models (phi, gemma) if available
        const smallModels = availableModels.filter(m => 
          m.toLowerCase().includes('phi') || 
          m.toLowerCase().includes('gemma') || 
          m.toLowerCase().includes('qwen')
        );
        const preferredModel = smallModels.length > 0 ? smallModels[0] : availableModels[0];
        console.log(`⚠️ Model '${OLLAMA_MODEL}' not found, using '${preferredModel}' instead`);
        modelToUse = preferredModel;
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
        options: {
          // Optimize for faster responses
          num_predict: 512, // Further reduce response length for faster generation
          temperature: 0.7,
          num_ctx: 1024, // Reduce context window for faster processing
          num_thread: 4, // Use more CPU threads if available
        },
      }),
      signal: AbortSignal.timeout(300000), // 5 minutes timeout
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
      if (error.message.includes("timeout") || error.name === "TimeoutError" || error.name === "AbortError") {
        throw new Error("انتهت مهلة الاتصال بـ Ollama (5 دقائق). النموذج قد يكون بطيئاً جداً. حاول مرة أخرى أو استخدم نموذج أصغر مثل 'phi' أو 'gemma'.");
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

    const searchResults = await searchRelevantDocuments(queryEmbedding, 3); // Reduce context size for faster processing

    let context = "";
    if (searchResults && searchResults.documents && searchResults.documents[0]) {
      const relevantDocs = searchResults.documents[0];
      const distances = searchResults.distances?.[0] || [];
      
      // Limit context length to avoid timeout - reduce to 1000 chars
      const maxContextLength = 1000; // Further reduce context to ~1000 characters
      let contextLength = 0;
      
      context = relevantDocs
        .map((doc, index) => {
          const distance = distances[index] || 1;
          if (distance < 0.7 && contextLength < maxContextLength) { // Stricter distance threshold
            // Truncate each document to max 300 chars
            const truncatedDoc = doc.length > 300 ? doc.substring(0, 300) + "..." : doc;
            const docText = `[مستند ${index + 1}]:\n${truncatedDoc}`;
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
        .filter((doc) => doc !== null)
        .join("\n\n");
    }

    // Simplified prompt for faster processing
    const systemPrompt = context
      ? `أنت مساعد قانوني. استخدم المعلومات التالية للإجابة:

${context}

أجب باختصار بناءً على المعلومات أعلاه.`
      : `أنت مساعد قانوني. أجب على السؤال بشكل واضح ومختصر.`;

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
    console.log("System prompt length:", systemPrompt.length, "characters");
    console.log("User query length:", userQuery.length, "characters");

    // Try with configured model first
    let ollamaResponse;
    try {
      ollamaResponse = await callOllama(ollamaMessages);
    } catch (error) {
      // If timeout, try with a smaller model
      if (error.message.includes("timeout") || error.message.includes("مهلة")) {
        console.log("⚠️ Timeout occurred, attempting with smaller model...");
        const availableModels = await getAvailableModels();
        const smallModels = availableModels.filter(m => 
          m.toLowerCase().includes('phi') || 
          m.toLowerCase().includes('gemma')
        );
        
        if (smallModels.length > 0) {
          const smallerModel = smallModels[0];
          console.log(`🔄 Retrying with smaller model: ${smallerModel}`);
          try {
            ollamaResponse = await callOllamaWithModel(ollamaMessages, smallerModel);
            console.log("✅ Success with smaller model");
          } catch (retryError) {
            throw error; // Re-throw original error if retry also fails
          }
        } else {
          throw error; // Re-throw if no smaller model available
        }
      } else {
        throw error; // Re-throw non-timeout errors
      }
    }

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

