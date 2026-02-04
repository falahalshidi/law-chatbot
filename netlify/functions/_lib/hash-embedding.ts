type EmbeddingFunction = {
  generate: (texts: string[]) => Promise<number[][]>;
};

const EMBEDDING_DIM = 384;

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function embedText(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) return vector;

  for (const token of tokens) {
    const idx = hashToken(token) % EMBEDDING_DIM;
    vector[idx] += 1;
  }

  let sumSquares = 0;
  for (let i = 0; i < vector.length; i += 1) {
    sumSquares += vector[i] * vector[i];
  }

  const norm = Math.sqrt(sumSquares) || 1;
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] = vector[i] / norm;
  }

  return vector;
}

export const localHashEmbeddingFunction: EmbeddingFunction = {
  async generate(texts: string[]) {
    return texts.map(embedText);
  },
};

