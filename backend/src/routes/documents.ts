import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import {
  getDocuments,
  getDocument,
  saveDocument,
  deleteDocument as removeDocument,
  saveDocumentContent,
  getDocumentContent,
} from '../services/storage';
import { simplifyDocument, summarizeDocument } from '../services/groq';
import { embedDocument } from '../services/openai';
import { indexDocument, deleteDocumentVectors } from '../services/pinecone';
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

    const fileContent = req.file.buffer.toString('utf-8');
    const documentId = uuidv4();

    // Create document metadata
    const document: Document = {
      id: documentId,
      title: req.file.originalname,
      originalContent: fileContent,
      uploadDate: new Date().toISOString(),
      status: 'processing',
      fileType: req.file.mimetype,
      fileSize: req.file.size,
    };

    // Save document
    saveDocument(document);
    saveDocumentContent(documentId, fileContent);

    // Index in Pinecone (async - don't wait)
    embedDocument(fileContent)
      .then(chunks => indexDocument(documentId, chunks))
      .then(() => {
        const doc = getDocument(documentId);
        if (doc) {
          doc.status = 'completed';
          saveDocument(doc);
        }
      })
      .catch(err => {
        console.error('Indexing error:', err);
        const doc = getDocument(documentId);
        if (doc) {
          doc.status = 'completed'; // Still mark complete even if indexing fails
          saveDocument(doc);
        }
      });

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        documentId,
        status: 'processing',
        estimatedProcessingTime: 30,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload document',
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
