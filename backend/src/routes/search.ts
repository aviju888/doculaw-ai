import { Router } from 'express';
import { searchDocuments } from '../services/pinecone';
import { getDocument, getDocuments } from '../services/storage';
import { SearchQuery, SearchResult } from '../types';

const router = Router();

// Search documents
router.post('/documents', async (req, res) => {
  try {
    const { query, filters, limit = 10 } = req.body as SearchQuery;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
        data: [],
      });
    }

    // Search in Pinecone
    const vectorResults = await searchDocuments(query, limit);

    // Get unique document IDs and their best scores
    const documentScores = new Map<string, { score: number; text: string }>();
    for (const result of vectorResults) {
      if (!documentScores.has(result.documentId) || documentScores.get(result.documentId)!.score < result.score) {
        documentScores.set(result.documentId, { score: result.score, text: result.text });
      }
    }

    // Build search results
    const results: SearchResult[] = [];
    for (const [documentId, { score, text }] of documentScores) {
      const document = getDocument(documentId);
      if (document) {
        // Apply filters if provided
        if (filters?.complexity && !filters.complexity.includes(document.complexity || 'medium')) {
          continue;
        }

        results.push({
          id: document.id,
          title: document.title,
          snippet: text.slice(0, 200) + (text.length > 200 ? '...' : ''),
          relevanceScore: score,
          documentType: document.fileType,
          lastModified: document.uploadDate,
        });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    res.json({
      success: true,
      message: `Found ${results.length} results`,
      data: results.slice(0, limit),
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      data: [],
    });
  }
});

// Find similar documents
router.get('/similar/:documentId', async (req, res) => {
  try {
    const document = getDocument(req.params.documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
        data: [],
      });
    }

    // Use the document's content to find similar documents
    const searchQuery = document.summary || document.originalContent.slice(0, 500);
    const vectorResults = await searchDocuments(searchQuery, 5);

    // Filter out the source document and build results
    const results: SearchResult[] = [];
    const seenDocs = new Set<string>();
    seenDocs.add(req.params.documentId);

    for (const result of vectorResults) {
      if (seenDocs.has(result.documentId)) continue;
      seenDocs.add(result.documentId);

      const doc = getDocument(result.documentId);
      if (doc) {
        results.push({
          id: doc.id,
          title: doc.title,
          snippet: result.text.slice(0, 200) + (result.text.length > 200 ? '...' : ''),
          relevanceScore: result.score,
          documentType: doc.fileType,
          lastModified: doc.uploadDate,
        });
      }
    }

    res.json({
      success: true,
      message: `Found ${results.length} similar documents`,
      data: results,
    });
  } catch (error) {
    console.error('Similar search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find similar documents',
      data: [],
    });
  }
});

export default router;
