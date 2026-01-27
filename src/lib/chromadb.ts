import { CloudClient } from "chromadb";
import { CHROMADB_API_KEY, CHROMADB_TENANT, CHROMADB_DATABASE } from "./env";

// Initialize ChromaDB client
export const chromaClient = new CloudClient({
  apiKey: CHROMADB_API_KEY,
  tenant: CHROMADB_TENANT,
  database: CHROMADB_DATABASE,
});

// Collection name for storing documents
const COLLECTION_NAME = "law_documents";

/**
 * Get or create the documents collection
 * ChromaDB Cloud will automatically generate embeddings
 */
export async function getCollection() {
  try {
    const collection = await chromaClient.getCollection({
      name: COLLECTION_NAME,
    });
    return collection;
  } catch (error) {
    // Collection doesn't exist, create it
    // ChromaDB Cloud will use default embedding function automatically
    const collection = await chromaClient.createCollection({
      name: COLLECTION_NAME,
    });
    return collection;
  }
}

/**
 * Store document chunks in ChromaDB
 * ChromaDB Cloud will automatically generate embeddings from the documents
 */
export async function storeDocumentChunks(
  chunks: string[],
  metadata: {
    filename: string;
    fileType: string;
    uploadedAt: string;
    chunkIndex: number;
  }[]
) {
  const collection = await getCollection();
  
  const ids = metadata.map((meta, index) => `${meta.filename}_chunk_${index}`);
  
  // Don't provide embeddings - ChromaDB Cloud will generate them automatically
  await collection.add({
    ids: ids,
    documents: chunks,
    metadatas: metadata,
  });
  
  return ids;
}

/**
 * Search for relevant documents in ChromaDB
 * ChromaDB Cloud will automatically generate embeddings from the query text
 */
export async function searchDocuments(
  queryText: string,
  nResults: number = 5
) {
  const collection = await getCollection();
  
  // Use queryTexts instead of queryEmbeddings - ChromaDB Cloud will generate embeddings automatically
  const results = await collection.query({
    queryTexts: [queryText],
    nResults: nResults,
  });
  
  return results;
}

/**
 * Delete documents by filename
 */
export async function deleteDocumentsByFilename(filename: string) {
  const collection = await getCollection();
  
  // Get all documents to find matching ones
  const allData = await collection.get();
  
  // Find IDs that match the filename
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
  
  return idsToDelete.length;
}

/**
 * Get all uploaded files metadata
 */
export async function getAllFiles() {
  const collection = await getCollection();
  
  const allData = await collection.get();
  
  // Extract unique filenames with their metadata
  const filesMap = new Map<string, { fileType: string; uploadedAt: string }>();
  
  if (allData.metadatas) {
    allData.metadatas.forEach((metadata: any) => {
      if (metadata && metadata.filename) {
        if (!filesMap.has(metadata.filename)) {
          filesMap.set(metadata.filename, {
            fileType: metadata.fileType || "unknown",
            uploadedAt: metadata.uploadedAt || new Date().toISOString(),
          });
        }
      }
    });
  }
  
  return Array.from(filesMap.entries()).map(([filename, info]) => ({
    filename,
    ...info,
  }));
}

