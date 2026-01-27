import { chromaClient } from "./chromadb";
import { extractTextFromFile, splitTextIntoChunks } from "./file-processor";

const COLLECTION_NAME = "law_documents";

/**
 * Get or create collection
 * ChromaDB Cloud will automatically generate embeddings
 */
async function getCollection() {
  try {
    const collection = await chromaClient.getCollection({
      name: COLLECTION_NAME,
    });
    return collection;
  } catch (error) {
    console.log("Collection not found, creating new one...");
    try {
      // ChromaDB Cloud will use default embedding function automatically
      const collection = await chromaClient.createCollection({
        name: COLLECTION_NAME,
      });
      return collection;
    } catch (createError) {
      console.error("Error creating collection:", createError);
      throw new Error(
        `Failed to create ChromaDB collection: ${
          createError instanceof Error ? createError.message : "Unknown error"
        }`
      );
    }
  }
}

/**
 * Upload and process a file
 * ChromaDB Cloud will automatically generate embeddings from the documents
 */
export async function uploadFile(file: File): Promise<{
  success: boolean;
  filename: string;
  chunksCount: number;
  message: string;
}> {
  try {
    const filename = file.name;
    const fileExtension = filename.split(".").pop()?.toLowerCase() || "";

    // Extract text from file
    console.log(`Processing ${filename}...`);
    const text = await extractTextFromFile(file);
    
    if (!text.trim()) {
      throw new Error("لا يوجد محتوى نصي في الملف");
    }

    console.log(`Extracted ${text.length} characters from ${filename}`);

    // Split text into chunks
    const chunks = splitTextIntoChunks(text, 1000, 200);
    console.log(`Split into ${chunks.length} chunks`);

    // Filter out empty chunks
    const validChunks = chunks.filter(
      (chunk) => chunk && chunk.trim().length > 0
    );
    if (validChunks.length === 0) {
      throw new Error("لا يوجد محتوى نصي صالح في الملف بعد التقسيم");
    }

    if (validChunks.length !== chunks.length) {
      console.log(`Filtered ${chunks.length - validChunks.length} empty chunks`);
    }

    console.log(`Prepared ${validChunks.length} chunks for ChromaDB`);
    console.log("ChromaDB Cloud will automatically generate embeddings...");

    // Prepare metadata
    const uploadedAt = new Date().toISOString();
    const metadata = validChunks.map((_, index) => ({
      filename,
      fileType: fileExtension,
      uploadedAt,
      chunkIndex: index,
    }));

    // Store in ChromaDB
    console.log("Connecting to ChromaDB...");
    const collection = await getCollection();
    console.log("Collection ready, adding documents...");

    // Generate unique IDs
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const ids = validChunks.map(
      (_, index) => `${filename}_chunk_${index}_${timestamp}_${randomSuffix}`
    );

    try {
      // Don't provide embeddings - ChromaDB Cloud will generate them automatically
      await collection.add({
        ids: ids,
        documents: validChunks,
        metadatas: metadata,
      });
      console.log("Documents added successfully to ChromaDB");
    } catch (chromaError) {
      console.error("ChromaDB error:", chromaError);
      throw new Error(
        `فشل حفظ الملف في ChromaDB: ${
          chromaError instanceof Error ? chromaError.message : "Unknown error"
        }`
      );
    }

    return {
      success: true,
      filename,
      chunksCount: validChunks.length,
      message: "File uploaded and processed successfully",
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to upload file";
    throw new Error(errorMessage);
  }
}

/**
 * List all uploaded files
 */
export async function listFiles(): Promise<
  Array<{
    filename: string;
    fileType: string;
    uploadedAt: string;
    chunkCount: number;
  }>
> {
  try {
    const collection = await getCollection();
    const allData = await collection.get();

    const filesMap = new Map<
      string,
      { fileType: string; uploadedAt: string; chunkCount: number }
    >();

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

    return Array.from(filesMap.entries()).map(([filename, info]) => ({
      filename,
      ...info,
    }));
  } catch (error) {
    console.error("Error listing files:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to list files"
    );
  }
}

/**
 * Delete a file by filename
 */
export async function deleteFile(filename: string): Promise<{
  success: boolean;
  deletedCount: number;
}> {
  try {
    if (!filename) {
      throw new Error("Filename is required");
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
      success: true,
      deletedCount: idsToDelete.length,
    };
  } catch (error) {
    console.error("Error deleting file:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to delete file"
    );
  }
}
