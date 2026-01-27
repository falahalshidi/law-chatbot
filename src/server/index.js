import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chatHandler } from './routes/chat.js';
import { uploadFileHandler } from './routes/upload-file.js';

// ChromaDB Cloud will automatically generate embeddings - no local model needed

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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  console.log('💡 Using ChromaDB Cloud for automatic embeddings');
});

