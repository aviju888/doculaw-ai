import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import modernRoutes from './modern/router';

import healthRoutes from './routes/health';
import documentRoutes from './routes/documents';
import chatRoutes from './routes/chat';
import searchRoutes from './routes/search';
import { initPinecone } from './services/pinecone';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({limit:'6mb'}));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/doculaw', modernRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/search', searchRoutes);

// Both interfaces are separate documents so their global styles never mix.
const site=path.resolve(__dirname,'../../site');
app.use(express.static(site));
app.use('/assets',express.static(path.join(site,'classic/assets')));
app.get(['/classic','/classic/*','/home','/onboarding','/dashboard','/upload','/documents','/documents/*','/chat','/chat/*','/search'],(_req,res)=>res.sendFile(path.join(site,'classic/index.html')));
app.get('/',(_req,res)=>res.sendFile(path.join(site,'index.html')));
app.use('/api',(_req,res)=>res.status(404).json({success:false,message:'Endpoint not found',data:null}));

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status((err as any).status || 500).json({
    success: false,
    message: 'Internal server error',
    data: null,
  });
});

// Start server
async function start() {
  // Initialize Pinecone
  await initPinecone();

  app.listen(Number(PORT), process.env.HOST || '127.0.0.1', () => {
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
