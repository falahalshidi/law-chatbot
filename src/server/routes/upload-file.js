import { CloudClient } from "chromadb";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { pipeline, env } from "@xenova/transformers";

// Configure transformers
env.allowLocalModels = false;
env.remoteURL = "https://huggingface.co";
env.remotePathTemplate = "{model}/resolve/{revision}/{file}";
// Increase timeout for model downloads
env.backends.onnx.wasm.proxy = false;

const CHROMADB_API_KEY = process.env.CHROMADB_API_KEY || process.env.VITE_CHROMADB_API_KEY || "ck-3EDSUCED38no4aLq8rgMXzTwe14fvnATpGEkwWMgrkEV";
const CHROMADB_TENANT = process.env.CHROMADB_TENANT || process.env.VITE_CHROMADB_TENANT || "bf8e9ba0-6e6f-4365-a930-2c5ef360f292";
const CHROMADB_DATABASE = process.env.CHROMADB_DATABASE || process.env.VITE_CHROMADB_DATABASE || "lawchat";

const COLLECTION_NAME = "law_documents";

const chromaClient = new CloudClient({
  apiKey: CHROMADB_API_KEY,
  tenant: CHROMADB_TENANT,
  database: CHROMADB_DATABASE,
});

let embeddingModel = null;

async function getEmbeddingModel() {
  if (!embeddingModel) {
    try {
      console.log("⏳ Loading embedding model (this may take 1-2 minutes on first run)...");
      console.log("💡 Tip: Model will be cached after first download");
      
      // Retry logic for network issues
      let retries = 3;
      let lastError = null;
      
      while (retries > 0) {
        try {
          embeddingModel = await pipeline(
            "feature-extraction",
            "Xenova/all-MiniLM-L6-v2",
            {
              progress_callback: (progress) => {
                if (progress.status === "downloading") {
                  console.log(`📥 Downloading model: ${Math.round(progress.progress || 0)}%`);
                } else if (progress.status === "loading") {
                  console.log(`⚙️ Loading model...`);
                }
              },
            }
          );
          console.log("✅ Embedding model loaded successfully");
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          retries--;
          if (retries > 0) {
            console.log(`⚠️ Retry loading model (${4 - retries}/3)...`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retry
          }
        }
      }
      
      if (!embeddingModel) {
        throw lastError || new Error("Failed to load model after retries");
      }
    } catch (error) {
      console.error("❌ Error loading embedding model:", error);
      throw new Error(`فشل تحميل نموذج embeddings. تحقق من اتصالك بالإنترنت وحاول مرة أخرى: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  return embeddingModel;
}

async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

async function extractTextFromDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new Error(`Failed to extract text from DOCX: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

function extractTextFromTXT(buffer) {
  return buffer.toString("utf-8");
}

function splitTextIntoChunks(text, chunkSize = 1000, overlap = 200) {
  try {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const textLength = text.length;
    if (textLength === 0) {
      return [];
    }

    // If text is shorter than chunkSize, return it as single chunk
    if (textLength <= chunkSize) {
      const trimmed = text.trim();
      return trimmed.length > 0 ? [trimmed] : [];
    }

    // Initialize array with estimated size to avoid resizing
    const estimatedChunks = Math.ceil(textLength / (chunkSize - overlap)) + 1;
    const chunks = [];
    
    let start = 0;
    let iterations = 0;
    const maxIterations = estimatedChunks * 2; // Safety limit

    // Ensure overlap is reasonable
    const safeOverlap = Math.min(overlap, Math.floor(chunkSize * 0.5));
    const stepSize = Math.max(1, chunkSize - safeOverlap); // At least 1

    while (start < textLength && iterations < maxIterations) {
      iterations++;
      
      const end = Math.min(start + chunkSize, textLength);
      
      // Safety check
      if (end <= start) {
        break;
      }
      
      const chunk = text.substring(start, end);
      const trimmedChunk = chunk.trim();
      
      if (trimmedChunk.length > 0) {
        // Safety: limit chunk size
        if (trimmedChunk.length > chunkSize * 2) {
          console.warn(`Chunk too large (${trimmedChunk.length}), truncating`);
          chunks.push(trimmedChunk.substring(0, chunkSize * 2));
        } else {
          chunks.push(trimmedChunk);
        }
      }
      
      // Move forward
      start += stepSize;
      
      // Safety: ensure we always move forward
      if (start <= end - safeOverlap) {
        start = end - safeOverlap;
      }
      
      // Break if we've reached the end
      if (start >= textLength) {
        break;
      }
    }

    if (iterations >= maxIterations) {
      console.warn(`Reached max iterations (${maxIterations}), stopping chunking`);
    }

    const filtered = chunks.filter(chunk => chunk && typeof chunk === 'string' && chunk.length > 0);
    console.log(`Split text into ${filtered.length} chunks (from ${textLength} characters)`);
    return filtered;
  } catch (error) {
    console.error("Error in splitTextIntoChunks:", error);
    console.error("Text length:", text?.length);
    throw new Error(`فشل تقسيم النص: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

async function createEmbeddings(chunks) {
  const model = await getEmbeddingModel();
  const embeddings = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk || chunk.trim().length === 0) {
      console.warn(`Skipping empty chunk at index ${i}`);
      continue;
    }

    try {
      const output = await model(chunk, { pooling: "mean", normalize: true });
      if (!output || !output.data) {
        throw new Error(`No output data from model for chunk ${i}`);
      }
      
      const embedding = Array.from(output.data);
      if (!embedding || embedding.length === 0) {
        throw new Error(`Empty embedding for chunk ${i}`);
      }
      
      embeddings.push(embedding);
    } catch (error) {
      console.error(`Error creating embedding for chunk ${i}:`, error);
      throw new Error(`فشل إنشاء embedding للجزء ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (embeddings.length === 0) {
    throw new Error("لم يتم إنشاء أي embeddings");
  }

  return embeddings;
}

async function getCollection() {
  try {
    const collection = await chromaClient.getCollection({
      name: COLLECTION_NAME,
    });
    return collection;
  } catch (error) {
    console.log("Collection not found, creating new one...");
    try {
      const collection = await chromaClient.createCollection({
        name: COLLECTION_NAME,
      });
      return collection;
    } catch (createError) {
      console.error("Error creating collection:", createError);
      throw new Error(`Failed to create ChromaDB collection: ${createError instanceof Error ? createError.message : "Unknown error"}`);
    }
  }
}

export async function uploadFileHandler(req, res) {
  // Handle GET request - list all files
  if (req.method === "GET") {
    try {
      const collection = await getCollection();
      const allData = await collection.get();

      const filesMap = new Map();

      if (allData.metadatas && allData.ids) {
        allData.metadatas.forEach((metadata, index) => {
          if (metadata && metadata.filename) {
            if (!filesMap.has(metadata.filename)) {
              filesMap.set(metadata.filename, {
                fileType: metadata.fileType || "unknown",
                uploadedAt: metadata.uploadedAt || new Date().toISOString(),
                chunkCount: 0,
              });
            }
            const fileInfo = filesMap.get(metadata.filename);
            fileInfo.chunkCount++;
          }
        });
      }

      const files = Array.from(filesMap.entries()).map(([filename, info]) => ({
        filename,
        ...info,
      }));

      return res.json({ files });
    } catch (error) {
      console.error("Error listing files:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to list files",
      });
    }
  }

  // Handle DELETE request - delete file
  if (req.method === "DELETE") {
    try {
      const { filename } = req.body;
      if (!filename) {
        return res.status(400).json({ error: "Filename is required" });
      }

      const collection = await getCollection();
      const allData = await collection.get();

      const idsToDelete = [];
      if (allData.ids && allData.metadatas) {
        allData.ids.forEach((id, index) => {
          const metadata = allData.metadatas?.[index];
          if (metadata && metadata.filename === filename) {
            idsToDelete.push(id);
          }
        });
      }

      if (idsToDelete.length > 0) {
        await collection.delete({
          ids: idsToDelete,
        });
      }

      return res.json({
        success: true,
        deletedCount: idsToDelete.length,
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to delete file",
      });
    }
  }

  // Handle POST request - upload file
  try {
    const { file: fileData, filename: fname, fileType: ftype } = req.body;

    if (!fileData || !fname) {
      return res.status(400).json({ error: "No file provided. Expected { file: base64, filename: string }" });
    }

    const fileBuffer = Buffer.from(fileData, "base64");
    const filename = fname;
    const fileType = ftype || "";

    let text = "";
    const fileExtension = filename.split(".").pop()?.toLowerCase() || "";

    if (fileExtension === "pdf" || fileType.includes("pdf")) {
      text = await extractTextFromPDF(fileBuffer);
    } else if (fileExtension === "docx" || fileType.includes("wordprocessingml") || fileType.includes("msword")) {
      text = await extractTextFromDOCX(fileBuffer);
    } else if (fileExtension === "txt" || fileExtension === "md" || fileType.includes("text/plain")) {
      text = extractTextFromTXT(fileBuffer);
    } else {
      return res.status(400).json({ error: `Unsupported file type: ${fileExtension}` });
    }

    if (!text.trim()) {
      return res.status(400).json({ error: "No text content found in file" });
    }

    console.log(`Processing ${filename}, extracted ${text.length} characters`);

    const chunks = splitTextIntoChunks(text, 1000, 200);
    console.log(`Split into ${chunks.length} chunks`);
    
    // Filter out empty chunks
    const validChunks = chunks.filter(chunk => chunk && chunk.trim().length > 0);
    if (validChunks.length === 0) {
      return res.status(400).json({ error: "لا يوجد محتوى نصي صالح في الملف بعد التقسيم" });
    }
    
    if (validChunks.length !== chunks.length) {
      console.log(`Filtered ${chunks.length - validChunks.length} empty chunks`);
    }

    console.log("Creating embeddings...");
    const embeddings = await createEmbeddings(validChunks);
    console.log(`Created ${embeddings.length} embeddings`);

    const uploadedAt = new Date().toISOString();
    const metadata = validChunks.map((_, index) => ({
      filename,
      fileType: fileExtension,
      uploadedAt,
      chunkIndex: index,
    }));

    // Validate arrays have same length
    if (validChunks.length !== embeddings.length || validChunks.length !== metadata.length) {
      console.error("Array length mismatch:", {
        chunks: validChunks.length,
        embeddings: embeddings.length,
        metadata: metadata.length,
      });
      throw new Error(`خطأ في معالجة الملف: أطوال المصفوفات غير متطابقة (chunks: ${validChunks.length}, embeddings: ${embeddings.length}, metadata: ${metadata.length})`);
    }

    // Validate embedding dimensions
    const embeddingDim = embeddings[0]?.length;
    if (!embeddingDim) {
      throw new Error("خطأ: لم يتم إنشاء embeddings بشكل صحيح");
    }
    
    for (let i = 0; i < embeddings.length; i++) {
      if (embeddings[i].length !== embeddingDim) {
        throw new Error(`خطأ: embedding ${i} له بعد مختلف (${embeddings[i].length} بدلاً من ${embeddingDim})`);
      }
    }

    console.log(`Validated: ${validChunks.length} chunks, ${embeddings.length} embeddings (dim: ${embeddingDim}), ${metadata.length} metadata entries`);

    console.log("Connecting to ChromaDB...");
    const collection = await getCollection();
    console.log("Collection ready, adding documents...");

    // Generate unique IDs with random component to avoid collisions
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const ids = validChunks.map((_, index) => `${filename}_chunk_${index}_${timestamp}_${randomSuffix}`);

    // Ensure all arrays are the same length (should already be equal after validation)
    const minLength = Math.min(ids.length, embeddings.length, validChunks.length, metadata.length);
    const finalIds = ids.slice(0, minLength);
    const finalEmbeddings = embeddings.slice(0, minLength);
    const finalChunks = validChunks.slice(0, minLength);
    const finalMetadata = metadata.slice(0, minLength);

    console.log(`Adding ${minLength} items to ChromaDB...`);

    try {
      await collection.add({
        ids: finalIds,
        embeddings: finalEmbeddings,
        documents: finalChunks,
        metadatas: finalMetadata,
      });
      console.log("Documents added successfully to ChromaDB");
    } catch (chromaError) {
      console.error("ChromaDB error:", chromaError);
      console.error("Error details:", {
        idsCount: finalIds.length,
        embeddingsCount: finalEmbeddings.length,
        documentsCount: finalChunks.length,
        metadatasCount: finalMetadata.length,
        embeddingDim: finalEmbeddings[0]?.length,
      });
      throw new Error(`فشل حفظ الملف في ChromaDB: ${chromaError instanceof Error ? chromaError.message : "Unknown error"}`);
    }

    return res.json({
      success: true,
      filename,
      chunksCount: minLength,
      message: "File uploaded and processed successfully",
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to upload file";
    console.error("Full error details:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : undefined) : undefined,
    });
  }
}

