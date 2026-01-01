/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PINECONE_API_KEY?: string;
  readonly VITE_PINECONE_HOST?: string;
  readonly VITE_PINECONE_MCP_ENDPOINT?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_USE_OPENAI_DIRECT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

