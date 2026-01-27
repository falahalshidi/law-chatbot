import type { HandlerEvent, HandlerContext } from "@netlify/functions";
import { CloudClient } from "chromadb";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

const CHROMADB_API_KEY = process.env.CHROMADB_API_KEY || process.env.VITE_CHROMADB_API_KEY || "ck-3EDSUCED38no4aLq8rgMXzTwe14fvnATpGEkwWMgrkEV";
const CHROMADB_TENANT = process.env.CHROMADB_TENANT || process.env.VITE_CHROMADB_TENANT || "bf8e9ba0-6e6f-4365-a930-2c5ef360f292";
const CHROMADB_DATABASE = process.env.CHROMADB_DATABASE || process.env.VITE_CHROMADB_DATABASE || "lawchat";

const COLLECTION_NAME = "law_documents";

// Initialize ChromaDB client
const chromaClient = new CloudClient({
  apiKey: CHROMADB_API_KEY,
  tenant: CHROMADB_TENANT,
  database: CHROMADB_DATABASE,
});

// ChromaDB Cloud will automatically generate embeddings - no local model needed

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
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk.trim());
    start = end - overlap;
  }

  return chunks.filter(chunk => chunk.length > 0);
}

// ChromaDB Cloud will automatically generate embeddings from documents

/**
 * Get or create collection
 * ChromaDB Cloud will automatically generate embeddings
 */
async function getCollection() {
  try {
    // Type assertion needed because ChromaDB Cloud uses default embedding function
    const collection = await chromaClient.getCollection({
      name: COLLECTION_NAME,
    } as any);
    return collection;
  } catch (error) {
    console.log("Collection not found, creating new one...");
    try {
      // ChromaDB Cloud will use default embedding function automatically
      const collection = await chromaClient.createCollection({
        name: COLLECTION_NAME,
      } as any);
      return collection;
    } catch (createError) {
      console.error("Error creating collection:", createError);
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
    console.log("ChromaDB Cloud will automatically generate embeddings...");

    // Prepare metadata
    const uploadedAt = new Date().toISOString();
    const metadata = chunks.map((_, index) => ({
      filename,
      fileType: fileExtension,
      uploadedAt,
      chunkIndex: index,
    }));

    // Store in ChromaDB
    console.log("Connecting to ChromaDB...");
    const collection = await getCollection();
    console.log("Collection ready, adding documents...");
    
    const ids = metadata.map((_, index) => `${filename}_chunk_${index}_${Date.now()}`);

    try {
      // Don't provide embeddings - ChromaDB Cloud will generate them automatically
      await collection.add({
        ids: ids,
        documents: chunks,
        metadatas: metadata,
      });
      console.log("Documents added successfully to ChromaDB");
    } catch (chromaError) {
      console.error("ChromaDB error:", chromaError);
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

