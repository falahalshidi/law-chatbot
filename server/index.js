import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chatHandler } from './routes/chat.js';
import { uploadFileHandler } from './routes/upload-file.js';
import { pipeline, env } from '@xenova/transformers';

// Configure transformers
env.allowLocalModels = false;

// Pre-load embedding model on server start
let embeddingModel = null;
async function preloadEmbeddingModel() {
  try {
    console.log('🔄 Pre-loading embedding model (this may take 1-2 minutes on first run)...');
    embeddingModel = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        progress_callback: (progress) => {
          if (progress.status === 'downloading') {
            console.log(`📥 Downloading model: ${Math.round(progress.progress || 0)}%`);
          } else if (progress.status === 'loading') {
            console.log(`⚙️ Loading model: ${progress.status || 'in progress'}`);
          }
        },
      }
    );
    console.log('✅ Embedding model loaded successfully!');
  } catch (error) {
    console.error('❌ Error pre-loading embedding model:', error);
    console.error('⚠️ Model will be loaded on first use (may cause delay)');
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.post('/api/chat', chatHandler);
app.get('/api/upload-file', uploadFileHandler);
app.post('/api/upload-file', uploadFileHandler);
app.delete('/api/upload-file', uploadFileHandler);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  console.log('');
  
  // Pre-load embedding model in background
  preloadEmbeddingModel().catch(console.error);
});

