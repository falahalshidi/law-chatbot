import type { HandlerEvent, HandlerContext } from "@netlify/functions";
import { CloudClient } from "chromadb";
import { localHashEmbeddingFunction } from "./_lib/hash-embedding";
import { getAdminSupabase } from "./_lib/supabase-admin";

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

let chromaClient: CloudClient | null = null;

type LawDocument = {
  documentId?: string;
  filename: string;
  fileType: string;
  uploadedAt: string;
  chunkCount: number;
  status?: string;
  category?: string;
  snippets?: string[];
  matchScore?: number;
};

type LawChunk = {
  id: string;
  content: string;
  chunkIndex: number;
};

function jsonResponse(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

async function getCollection() {
  if (!CHROMADB_API_KEY || !CHROMADB_TENANT || !CHROMADB_DATABASE) {
    throw new Error("Missing ChromaDB environment variables");
  }

  if (!chromaClient) {
    chromaClient = new CloudClient({
      apiKey: CHROMADB_API_KEY,
      tenant: CHROMADB_TENANT,
      database: CHROMADB_DATABASE,
    });
  }

  try {
    return await chromaClient.getCollection({
      name: COLLECTION_NAME,
      embeddingFunction: localHashEmbeddingFunction as any,
    } as any);
  } catch {
    return await chromaClient.createCollection({
      name: COLLECTION_NAME,
      embeddingFunction: localHashEmbeddingFunction as any,
    });
  }
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function snippetFromText(text: string, query: string, maxLength: number = 180) {
  const compactText = text.replace(/\s+/g, " ").trim();
  if (!compactText) return "";

  const normalizedText = compactText.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return compactText.length > maxLength ? `${compactText.slice(0, maxLength)}...` : compactText;
  }

  const matchIndex = normalizedText.indexOf(normalizedQuery);
  if (matchIndex === -1) {
    return compactText.length > maxLength ? `${compactText.slice(0, maxLength)}...` : compactText;
  }

  const start = Math.max(0, matchIndex - 60);
  const end = Math.min(compactText.length, matchIndex + normalizedQuery.length + 100);
  const snippet = compactText.slice(start, end).trim();

  return `${start > 0 ? "..." : ""}${snippet}${end < compactText.length ? "..." : ""}`;
}

async function listDocumentsFromDatabase(): Promise<LawDocument[]> {
  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from(DOCUMENTS_TABLE)
      .select("id, filename, mime_type, uploaded_at, chunk_count, status, category")
      .order("uploaded_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map((row: any) => ({
      documentId: row.id,
      filename: row.filename,
      fileType: row.mime_type || "unknown",
      uploadedAt: row.uploaded_at || new Date().toISOString(),
      chunkCount: row.chunk_count || 0,
      status: row.status || "active",
      category: row.category || "general",
    }));
  } catch (error) {
    console.error("Failed to read law documents from database:", error);
    return [];
  }
}

async function listDocumentsFromChroma(): Promise<LawDocument[]> {
  try {
    const collection = await getCollection();
    const allData = await collection.get();
    const documentsMap = new Map<string, LawDocument>();

    const metadatas = allData.metadatas || [];

    metadatas.forEach((metadata: any) => {
      if (!metadata?.filename) {
        return;
      }

      const key = String(metadata.documentId || metadata.filename);
      const existing = documentsMap.get(key);

      if (!existing) {
        documentsMap.set(key, {
          documentId: metadata.documentId,
          filename: metadata.filename,
          fileType: metadata.fileType || "unknown",
          uploadedAt: metadata.uploadedAt || new Date().toISOString(),
          chunkCount: 1,
          status: metadata.status || "active",
          category: metadata.category || "general",
        });
      } else {
        existing.chunkCount += 1;
      }
    });

    return Array.from(documentsMap.values()).sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  } catch (error) {
    console.error("Failed to read law documents from ChromaDB:", error);
    return [];
  }
}

async function loadAllDocuments(): Promise<LawDocument[]> {
  const [databaseDocuments, chromaDocuments] = await Promise.all([
    listDocumentsFromDatabase(),
    listDocumentsFromChroma(),
  ]);

  const merged = new Map<string, LawDocument>();

  for (const document of chromaDocuments) {
    merged.set(document.documentId || document.filename, document);
  }

  for (const document of databaseDocuments) {
    const key = document.documentId || document.filename;
    const existing = merged.get(key);

    merged.set(key, {
      ...existing,
      ...document,
      chunkCount: document.chunkCount || existing?.chunkCount || 0,
    });
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

async function searchDocuments(query: string, allDocuments: LawDocument[]): Promise<LawDocument[]> {
  const normalizedQuery = normalizeText(query);
  const directMatches = allDocuments.filter((document) => {
    const haystack = normalizeText(`${document.filename} ${document.category || ""} ${document.fileType || ""}`);
    return haystack.includes(normalizedQuery);
  });

  const directMatchesMap = new Map<string, LawDocument>();
  for (const document of directMatches) {
    directMatchesMap.set(document.documentId || document.filename, {
      ...document,
      snippets: document.snippets || [],
      matchScore: 0,
    });
  }

  try {
    const collection = await getCollection();
    const results = await collection.query({
      queryTexts: [query],
      nResults: 12,
    });

    const documents = results.documents?.[0] || [];
    const metadatas = results.metadatas?.[0] || [];
    const distances = results.distances?.[0] || [];

    const semanticMatches = new Map<string, LawDocument>();

    documents.forEach((content, index) => {
      const metadata: any = metadatas[index] || {};
      const key = String(metadata.documentId || metadata.filename || index);
      const baseDocument =
        allDocuments.find((document) => (document.documentId || document.filename) === key) ||
        ({
          documentId: metadata.documentId,
          filename: metadata.filename || "مستند قانوني",
          fileType: metadata.fileType || "unknown",
          uploadedAt: metadata.uploadedAt || new Date().toISOString(),
          chunkCount: 0,
          status: metadata.status || "active",
          category: metadata.category || "general",
        } as LawDocument);

      const existing = semanticMatches.get(key);
      const snippet = snippetFromText(String(content || ""), query);
      const matchScore = Number(distances[index] ?? 1);

      if (!existing) {
        semanticMatches.set(key, {
          ...baseDocument,
          matchScore,
          snippets: snippet ? [snippet] : [],
        });
      } else {
        existing.matchScore = Math.min(existing.matchScore ?? matchScore, matchScore);
        if (snippet && !(existing.snippets || []).includes(snippet)) {
          existing.snippets = [...(existing.snippets || []), snippet].slice(0, 3);
        }
      }
    });

    const mergedResults = new Map<string, LawDocument>();

    for (const [key, document] of directMatchesMap.entries()) {
      mergedResults.set(key, document);
    }

    for (const [key, document] of semanticMatches.entries()) {
      const existing = mergedResults.get(key);
      mergedResults.set(key, {
        ...document,
        ...existing,
        snippets: [...(existing?.snippets || []), ...(document.snippets || [])].filter(
          (snippet, index, list) => Boolean(snippet) && list.indexOf(snippet) === index
        ).slice(0, 3),
        matchScore: Math.min(existing?.matchScore ?? Infinity, document.matchScore ?? Infinity),
      });
    }

    return Array.from(mergedResults.values()).sort((a, b) => {
      const scoreA = a.matchScore ?? Infinity;
      const scoreB = b.matchScore ?? Infinity;
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    });
  } catch (error) {
    console.error("Semantic law search failed:", error);
    return directMatches;
  }
}

async function loadDocumentContent(documentId?: string, filename?: string) {
  const collection = await getCollection();
  const allData = await collection.get();

  const ids = allData.ids || [];
  const documents = allData.documents || [];
  const metadatas = allData.metadatas || [];
  const chunks: LawChunk[] = [];

  ids.forEach((id: any, index: number) => {
    const metadata: any = metadatas[index];
    if (!metadata) {
      return;
    }

    const matchesDocument =
      (documentId && metadata.documentId === documentId) ||
      (!documentId && filename && metadata.filename === filename);

    if (!matchesDocument) {
      return;
    }

    chunks.push({
      id: String(id),
      content: String(documents[index] || ""),
      chunkIndex: Number(metadata.chunkIndex || 0),
    });
  });

  chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
  return chunks;
}

const handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(200, {});
  }

  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const query = String(event.queryStringParameters?.q || "").trim();
    const documentId = String(event.queryStringParameters?.documentId || "").trim();
    const filename = String(event.queryStringParameters?.filename || "").trim();

    const allDocuments = await loadAllDocuments();

    if (documentId || filename) {
      const chunks = await loadDocumentContent(documentId || undefined, filename || undefined);
      const selectedDocument =
        allDocuments.find((document) =>
          documentId
            ? document.documentId === documentId
            : document.filename === filename
        ) || null;

      if (!selectedDocument && chunks.length === 0) {
        return jsonResponse(404, { error: "Document not found" });
      }

      return jsonResponse(200, {
        document:
          selectedDocument ||
          ({
            documentId,
            filename: filename || "مستند قانوني",
            fileType: "unknown",
            uploadedAt: new Date().toISOString(),
            chunkCount: chunks.length,
            category: "general",
            status: "active",
          } satisfies LawDocument),
        chunks,
        fullText: chunks.map((chunk) => chunk.content).join("\n\n"),
      });
    }

    const documents = query ? await searchDocuments(query, allDocuments) : allDocuments;

    return jsonResponse(200, {
      documents,
      query,
    });
  } catch (error) {
    console.error("Law library function failed:", error);
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};

export { handler };
