import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import healthRoutes from './routes/health';
import documentRoutes from './routes/documents';
import chatRoutes from './routes/chat';
import searchRoutes from './routes/search';
import { initPinecone } from './services/pinecone';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/search', searchRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'DocuLaw AI Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      documents: '/api/documents',
      chat: '/api/chat',
      search: '/api/search',
    },
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    data: null,
  });
});

// Start server
async function start() {
  // Initialize Pinecone
  await initPinecone();

  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   DocuLaw AI Backend - MVP                           ║
║   Server running on http://localhost:${PORT}            ║
║                                                       ║
║   Endpoints:                                          ║
║   • GET  /api/health           - Health check         ║
║   • POST /api/documents/upload - Upload document      ║
║   • GET  /api/documents        - List documents       ║
║   • POST /api/documents/simplify - Simplify doc       ║
║   • POST /api/chat/sessions    - Create chat          ║
║   • POST /api/chat/sessions/:id/messages - Send msg   ║
║   • POST /api/search/documents - Search               ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
  });
}

start().catch(console.error);
