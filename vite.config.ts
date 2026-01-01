import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api/pinecone': {
        target: 'https://prod-1-data.ke.pinecone.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pinecone/, '/assistant/chat/lawchatbot'),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Add API key to headers (Pinecone only requires Api-Key, not Authorization)
            proxyReq.setHeader('Api-Key', 'pcsk_64kjYg_Di6xiwQfc7ojDHAtJfuC7ZLyP7y2Thgh2FEJnr8qGK1QHnUTPaZqx8XDttF8SUy');
            // Pinecone Assistant API requires Accept header
            proxyReq.setHeader('Accept', 'application/json, text/event-stream');
          });
        },
      },
    },
  },
})

