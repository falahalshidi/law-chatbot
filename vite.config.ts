import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Plugin to copy PDF.js worker to public directory
const pdfjsWorkerPlugin = () => {
  let copied = false;
  
  const copyWorker = () => {
    if (copied) return;
    
    // Copy PDF.js worker file to public directory
    const workerSource = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
    const workerDest = path.resolve(__dirname, 'public/pdf.worker.min.mjs');
    
    if (existsSync(workerSource)) {
      try {
        // Ensure public directory exists
        const publicDir = path.dirname(workerDest);
        if (!existsSync(publicDir)) {
          mkdirSync(publicDir, { recursive: true });
        }
        copyFileSync(workerSource, workerDest);
        console.log('PDF.js worker copied to public directory');
        copied = true;
      } catch (error) {
        console.warn('Failed to copy PDF.js worker:', error);
      }
    } else {
      console.warn('PDF.js worker file not found at:', workerSource);
    }
  };
  
  return {
    name: 'pdfjs-worker-copy',
    buildStart() {
      copyWorker();
    },
    configureServer() {
      // Also copy in dev mode
      copyWorker();
    },
  };
};

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
  plugins: [react(), pdfjsWorkerPlugin(), chromadbPlugin()],
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

