import type { HandlerEvent, HandlerContext } from "@netlify/functions";
import { CloudClient } from "chromadb";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
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

// ChromaDB Cloud automatically generates embeddings - no local model needed

/**
 * Extract text from PDF buffer
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Extract text from DOCX buffer
 */
async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new Error(`Failed to extract text from DOCX: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Extract text from TXT buffer
 */
function extractTextFromTXT(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

/**
 * Split text into chunks
 */
function splitTextIntoChunks(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  const safeChunkSize = Math.max(1, chunkSize);
  const safeOverlap = Math.max(0, Math.min(overlap, safeChunkSize - 1));
  const step = safeChunkSize - safeOverlap;
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + safeChunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk.trim());
    if (end === text.length) break;
    start += step;
  }

  return chunks.filter(chunk => chunk.length > 0);
}

// ChromaDB Cloud automatically generates embeddings from documents
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
    console.log(`Getting collection: ${COLLECTION_NAME}`);
    const collection = await chromaClient.getCollection({
      name: COLLECTION_NAME,
      embeddingFunction: localHashEmbeddingFunction as any,
    } as any);
    console.log("✅ Collection found and retrieved");
    return collection;
  } catch (error) {
    console.log("⚠️ Collection not found, creating new one...");
    console.log("Error details:", error instanceof Error ? error.message : error);
    try {
      const collection = await chromaClient.createCollection({
        name: COLLECTION_NAME,
        embeddingFunction: localHashEmbeddingFunction as any,
      });
      console.log("✅ New collection created successfully");
      return collection;
    } catch (createError) {
      console.error("❌ Error creating collection:", createError);
      console.error("Create error details:", {
        message: createError instanceof Error ? createError.message : "Unknown",
        stack: createError instanceof Error ? createError.stack : undefined,
      });
      throw new Error(`Failed to create ChromaDB collection: ${createError instanceof Error ? createError.message : "Unknown error"}`);
    }
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
        "Access-Control-Allow-Methods": "POST, OPTIONS, DELETE, GET",
        "Content-Type": "application/json",
      },
      body: "",
    };
  }

  // Handle GET request - list all files
  if (event.httpMethod === "GET") {
    try {
      const collection = await getCollection();
      const allData = await collection.get();

      const filesMap = new Map<string, { fileType: string; uploadedAt: string; chunkCount: number }>();

      if (allData.metadatas && allData.ids) {
        allData.metadatas.forEach((metadata: any) => {
          if (metadata && metadata.filename) {
            if (!filesMap.has(metadata.filename)) {
              filesMap.set(metadata.filename, {
                fileType: metadata.fileType || "unknown",
                uploadedAt: metadata.uploadedAt || new Date().toISOString(),
                chunkCount: 0,
              });
            }
            const fileInfo = filesMap.get(metadata.filename)!;
            fileInfo.chunkCount++;
          }
        });
      }

      const files = Array.from(filesMap.entries()).map(([filename, info]) => ({
        filename,
        ...info,
      }));

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ files }),
      };
    } catch (error) {
      console.error("Error listing files:", error);
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: error instanceof Error ? error.message : "Failed to list files",
        }),
      };
    }
  }

  // Handle DELETE request - delete file
  if (event.httpMethod === "DELETE") {
    try {
      const { filename } = JSON.parse(event.body || "{}");
      if (!filename) {
        return {
          statusCode: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ error: "Filename is required" }),
        };
      }

      const collection = await getCollection();
      const allData = await collection.get();

      const idsToDelete: string[] = [];
      if (allData.ids && allData.metadatas) {
        allData.ids.forEach((id, index) => {
          const metadata = allData.metadatas?.[index];
          if (metadata && metadata.filename === filename) {
            idsToDelete.push(id as string);
          }
        });
      }

      if (idsToDelete.length > 0) {
        await collection.delete({
          ids: idsToDelete,
        });
      }

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          success: true, 
          deletedCount: idsToDelete.length 
        }),
      };
    } catch (error) {
      console.error("Error deleting file:", error);
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: error instanceof Error ? error.message : "Failed to delete file",
        }),
      };
    }
  }

  // Handle POST request - upload file
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
    // Parse JSON body with base64 encoded file
    const body = JSON.parse(event.body || "{}");
    const { file: fileData, filename: fname, fileType: ftype } = body;

    if (!fileData || !fname) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "No file provided. Expected { file: base64, filename: string }" }),
      };
    }

    // Decode base64 file
    const fileBuffer = Buffer.from(fileData, "base64");
    const filename = fname;
    const fileType = ftype || "";

    // Extract text based on file type
    let text = "";
    const fileExtension = filename.split(".").pop()?.toLowerCase() || "";

    if (fileExtension === "pdf" || fileType.includes("pdf")) {
      text = await extractTextFromPDF(fileBuffer);
    } else if (fileExtension === "docx" || fileType.includes("wordprocessingml") || fileType.includes("msword")) {
      text = await extractTextFromDOCX(fileBuffer);
    } else if (fileExtension === "txt" || fileExtension === "md" || fileType.includes("text/plain")) {
      text = extractTextFromTXT(fileBuffer);
    } else {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: `Unsupported file type: ${fileExtension}` }),
      };
    }

    if (!text.trim()) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "No text content found in file" }),
      };
    }

    // Split text into chunks
    const chunks = splitTextIntoChunks(text, 1000, 200);

    console.log(`Processing ${chunks.length} chunks for file: ${filename}`);

    // Prepare metadata
    const uploadedAt = new Date().toISOString();
    const metadata = chunks.map((_, index) => ({
      filename,
      fileType: fileExtension,
      uploadedAt,
      chunkIndex: index,
    }));

    // Store in ChromaDB
    // ChromaDB Cloud will automatically generate embeddings from documents
    console.log("Connecting to ChromaDB...");
    console.log("ChromaDB Config:", {
      tenant: CHROMADB_TENANT,
      database: CHROMADB_DATABASE,
      apiKeyPrefix: CHROMADB_API_KEY?.substring(0, 10) + "...",
      collectionName: COLLECTION_NAME,
    });
    
    const collection = await getCollection();
    console.log("Collection ready, adding documents...");
    console.log(`Adding ${chunks.length} document chunks (embeddings will be generated automatically by ChromaDB Cloud)`);
    
    const ids = metadata.map((_, index) => `${filename}_chunk_${index}_${Date.now()}`);

    try {
      console.log("Calling collection.add() with documents only (ChromaDB Cloud will generate embeddings)...");
      // ChromaDB Cloud automatically generates embeddings from documents
      // No need to provide embeddings manually
      await collection.add({
        ids: ids,
        documents: chunks,
        metadatas: metadata,
      });
      console.log("✅ Documents added successfully to ChromaDB");
      console.log(`✅ Added ${ids.length} document chunks (embeddings generated automatically)`);
    } catch (chromaError) {
      console.error("❌ ChromaDB error:", chromaError);
      console.error("Error details:", {
        message: chromaError instanceof Error ? chromaError.message : "Unknown",
        stack: chromaError instanceof Error ? chromaError.stack : undefined,
        name: chromaError instanceof Error ? chromaError.name : undefined,
      });
      throw new Error(`فشل حفظ الملف في ChromaDB: ${chromaError instanceof Error ? chromaError.message : "Unknown error"}`);
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        filename,
        chunksCount: chunks.length,
        message: "File uploaded and processed successfully",
      }),
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to upload file";
    console.error("Full error details:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      body: event.body ? JSON.parse(event.body || "{}") : null,
    });
    
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : undefined) : undefined,
      }),
    };
  }
};

export { handler };
