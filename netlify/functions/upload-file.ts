import type { HandlerEvent, HandlerContext } from "@netlify/functions";
import { CloudClient } from "chromadb";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { randomUUID } from "node:crypto";
import { localHashEmbeddingFunction } from "./_lib/hash-embedding";
import { detectCategory } from "./_lib/document-classifier";
import { DOCUMENTS_BUCKET, ensureDocumentsBucket, getAdminSupabase } from "./_lib/supabase-admin";

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
const DOCUMENTS_TABLE = "documents";

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

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function listFilesFromDatabase() {
  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from(DOCUMENTS_TABLE)
      .select("id, filename, mime_type, uploaded_at, chunk_count, status")
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Failed to load documents metadata from database:", error.message);
      return null;
    }

    return (data || []).map((row: any) => ({
      documentId: row.id,
      filename: row.filename,
      fileType: row.mime_type || "unknown",
      uploadedAt: row.uploaded_at || new Date().toISOString(),
      chunkCount: row.chunk_count || 0,
      status: row.status || "active",
    }));
  } catch (error) {
    console.error("Database file listing failed:", error);
    return null;
  }
}

async function listFilesFromChroma() {
  const collection = await getCollection();
  const allData = await collection.get();

  const filesMap = new Map<string, { documentId?: string; fileType: string; uploadedAt: string; chunkCount: number; status?: string }>();

  if (allData.metadatas && allData.ids) {
    allData.metadatas.forEach((metadata: any) => {
      if (metadata && metadata.filename) {
        if (!filesMap.has(metadata.filename)) {
          filesMap.set(metadata.filename, {
            documentId: metadata.documentId,
            fileType: metadata.fileType || "unknown",
            uploadedAt: metadata.uploadedAt || new Date().toISOString(),
            chunkCount: 0,
            status: metadata.status || "active",
          });
        }
        const fileInfo = filesMap.get(metadata.filename)!;
        fileInfo.chunkCount++;
      }
    });
  }

  return Array.from(filesMap.entries()).map(([filename, info]) => ({
    filename,
    ...info,
  }));
}

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
      const databaseFiles = await listFilesFromDatabase();
      const chromaFiles = await listFilesFromChroma();
      const filesByKey = new Map<string, any>();

      for (const file of chromaFiles) {
        filesByKey.set(file.documentId || file.filename, file);
      }

      for (const file of databaseFiles || []) {
        const key = file.documentId || file.filename;
        const existing = filesByKey.get(key);
        filesByKey.set(key, {
          ...existing,
          ...file,
          chunkCount: file.chunkCount || existing?.chunkCount || 0,
        });
      }

      const files = Array.from(filesByKey.values()).sort((a, b) =>
        new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
      );

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
      const { filename, documentId } = JSON.parse(event.body || "{}");
      if (!filename && !documentId) {
        return {
          statusCode: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ error: "Filename or documentId is required" }),
        };
      }

      let deletedStorage = false;
      let deletedMetadata = false;

      try {
        const supabase = getAdminSupabase();
        let fileRecord: any = null;

        if (documentId) {
          const { data } = await supabase
            .from(DOCUMENTS_TABLE)
            .select("id, storage_path, filename")
            .eq("id", documentId)
            .maybeSingle();
          fileRecord = data;
        } else if (filename) {
          const { data } = await supabase
            .from(DOCUMENTS_TABLE)
            .select("id, storage_path, filename")
            .eq("filename", filename)
            .order("uploaded_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          fileRecord = data;
        }

        if (fileRecord?.storage_path) {
          const { error: storageDeleteError } = await supabase.storage
            .from(DOCUMENTS_BUCKET)
            .remove([fileRecord.storage_path]);

          if (!storageDeleteError) {
            deletedStorage = true;
          }
        }

        if (fileRecord?.id) {
          const { error: metadataDeleteError } = await supabase
            .from(DOCUMENTS_TABLE)
            .delete()
            .eq("id", fileRecord.id);

          if (!metadataDeleteError) {
            deletedMetadata = true;
          }
        }
      } catch (databaseError) {
        console.error("Failed to delete file from database/storage:", databaseError);
      }

      const collection = await getCollection();
      const allData = await collection.get();

      const idsToDelete: string[] = [];
      if (allData.ids && allData.metadatas) {
        allData.ids.forEach((id, index) => {
          const metadata = allData.metadatas?.[index];
          if (
            metadata &&
            ((documentId && metadata.documentId === documentId) || (!documentId && filename && metadata.filename === filename))
          ) {
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
          deletedCount: idsToDelete.length,
          deletedStorage,
          deletedMetadata,
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
    const { file: fileData, filename: fname, fileType: ftype, size, uploadedBy } = body;

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
    const documentId = randomUUID();
    const safeFilename = sanitizeFilename(filename);
    const uploadedAt = new Date().toISOString();

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
    const category = detectCategory(`${filename}\n${text.slice(0, 2000)}`);

    console.log(`Processing ${chunks.length} chunks for file: ${filename}`);

    await ensureDocumentsBucket();
    const supabase = getAdminSupabase();
    const storagePath = `${documentId}/${safeFilename}`;

    const { error: storageError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: fileType || "application/octet-stream",
        upsert: true,
      });

    if (storageError) {
      throw new Error(`Failed to save original file in storage: ${storageError.message}`);
    }

    let metadataSaved = false;
    try {
      const { error: dbError } = await supabase
        .from(DOCUMENTS_TABLE)
        .insert([
          {
            id: documentId,
            filename,
            mime_type: fileType || fileExtension || "unknown",
            size: Number(size) || fileBuffer.length,
            storage_path: storagePath,
            uploaded_by: uploadedBy || null,
            uploaded_at: uploadedAt,
            status: "active",
            chunk_count: chunks.length,
            category,
          },
        ]);

      if (dbError) {
        console.error("Failed to save document metadata:", dbError.message);
      } else {
        metadataSaved = true;
      }
    } catch (dbError) {
      console.error("Document metadata insert failed:", dbError);
    }

    // Prepare metadata
    const metadata = chunks.map((_, index) => ({
      documentId,
      filename,
      fileType: fileExtension,
      uploadedAt,
      chunkIndex: index,
      category,
      sourceType: "uploaded_file",
      uploadedBy: uploadedBy || null,
      storagePath,
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
        documentId,
        filename,
        chunksCount: chunks.length,
        storagePath,
        category,
        metadataSaved,
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
