import { pipeline, env } from "@xenova/transformers";

// Configure transformers for browser
env.allowLocalModels = false;
env.remoteURL = "https://huggingface.co";
env.remotePathTemplate = "{model}/resolve/{revision}/{file}";

// Initialize embedding model (cached)
let embeddingModel: any = null;

/**
 * Get or load the embedding model
 */
async function getEmbeddingModel() {
  if (!embeddingModel) {
    try {
      console.log("⏳ Loading embedding model (this may take 1-2 minutes on first run)...");
      console.log("💡 Tip: Model will be cached after first download");
      
      embeddingModel = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        {
          progress_callback: (progress: any) => {
            if (progress.status === "downloading") {
              console.log(`📥 Downloading model: ${Math.round(progress.progress || 0)}%`);
            } else if (progress.status === "loading") {
              console.log(`⚙️ Loading model...`);
            }
          },
        }
      );
      console.log("✅ Embedding model loaded successfully");
    } catch (error) {
      console.error("❌ Error loading embedding model:", error);
      throw new Error(
        `فشل تحميل نموذج embeddings. تحقق من اتصالك بالإنترنت وحاول مرة أخرى: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
  return embeddingModel;
}

/**
 * Create embedding for a single text
 */
export async function createEmbedding(text: string): Promise<number[]> {
  const model = await getEmbeddingModel();
  const output = await model(text, { pooling: "mean", normalize: true });
  
  if (!output || !output.data) {
    throw new Error("Failed to create embedding: no output data");
  }
  
  return Array.from(output.data);
}

/**
 * Create embeddings for multiple text chunks
 */
export async function createEmbeddings(chunks: string[]): Promise<number[][]> {
  const model = await getEmbeddingModel();
  const embeddings: number[][] = [];

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
      throw new Error(
        `فشل إنشاء embedding للجزء ${i + 1}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  if (embeddings.length === 0) {
    throw new Error("لم يتم إنشاء أي embeddings");
  }

  return embeddings;
}
