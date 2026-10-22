import { extractFromBytes, ParseError } from '../modern/lib/doculaw/parse';
import { Router } from 'express';
import multer from 'multer';
import { saveUploadedDocument } from '../services/uploads';
import {
  getDocuments,
  getDocument,
  saveDocument,
  deleteDocument as removeDocument,
  saveDocumentContent,
  getDocumentContent,
} from '../services/storage';
import { simplifyDocument, summarizeDocument } from '../services/groq';
import { deleteDocumentVectors } from '../services/pinecone';
import { Document, SimplificationRequest } from '../types';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Upload document
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
        data: null,
      });
    }

    const fileContent = /\.(txt|md)$/i.test(req.file.originalname)
      ? req.file.buffer.toString('utf-8')
      : (await extractFromBytes(new Uint8Array(req.file.buffer),req.file.originalname,10*1024*1024)).text;
    const document = saveUploadedDocument(fileContent,req.file);
    const documentId = document.id;

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        documentId,
        status: document.status,
        estimatedProcessingTime: 30,
      },
    });
  } catch (error) {
    console.error('Upload error:', error instanceof Error ? error.message : 'error');
    res.status(error instanceof ParseError ? error.status : 500).json({
      success: false,
      message: error instanceof ParseError ? error.message : 'Failed to upload document',
      data: null,
    });
  }
});

// Get all documents
router.get('/', (req, res) => {
  try {
    const documents = getDocuments();
    res.json({
      success: true,
      message: 'Documents retrieved successfully',
      data: documents,
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve documents',
      data: [],
    });
  }
});

// Get single document
router.get('/:id', (req, res) => {
  try {
    const document = getDocument(req.params.id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
        data: null,
      });
    }

    res.json({
      success: true,
      message: 'Document retrieved successfully',
      data: document,
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document',
      data: null,
    });
  }
});

// Delete document
router.delete('/:id', async (req, res) => {
  try {
    const deleted = removeDocument(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
        data: null,
      });
    }

    // Also delete from Pinecone
    await deleteDocumentVectors(req.params.id);

    res.json({
      success: true,
      message: 'Document deleted successfully',
      data: null,
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document',
      data: null,
    });
  }
});

// Simplify document
router.post('/simplify', async (req, res) => {
  if (!process.env.GROQ_API_KEY) return res.status(503).json({success:false,message:'Document simplification requires a configured Groq provider.',data:null});
  try {
    const { documentId, simplificationLevel, userContext } = req.body as SimplificationRequest;

    const document = getDocument(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
        data: null,
      });
    }

    // Simplify using Groq
    const simplifiedContent = await simplifyDocument(
      document.originalContent,
      simplificationLevel || 'basic',
      userContext
    );

    // Generate summary
    const summary = await summarizeDocument(document.originalContent);

    // Update document
    document.simplifiedContent = simplifiedContent;
    document.summary = summary;
    document.processedDate = new Date().toISOString();
    document.status = 'completed';

    saveDocument(document);

    res.json({
      success: true,
      message: 'Document simplified successfully',
      data: document,
    });
  } catch (error) {
    console.error('Simplify error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to simplify document',
      data: null,
    });
  }
});

export default router;
