import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Plugin to handle chromadb dynamic imports
const chromadbPlugin = () => ({
  name: 'chromadb-resolver',
  resolveId(id: string) {
    // Resolve chromadb-default-embed to a virtual module
    if (id === 'chromadb-default-embed') {
      return '\0chromadb-default-embed';
    }
    return null;
  },
  load(id: string) {
    // Return empty module for chromadb-default-embed (not needed in browser)
    if (id === '\0chromadb-default-embed') {
      return 'export default null;';
    }
    return null;
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), chromadbPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ['@xenova/transformers', 'chromadb'],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
})

