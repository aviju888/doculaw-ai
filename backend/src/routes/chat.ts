import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getSessions,
  getSession,
  saveSession,
  deleteSession as removeSession,
} from '../services/storage';
import { generateChatResponse } from '../services/groq';
import { searchDocuments } from '../services/pinecone';
import { ChatSession, ChatMessage } from '../types';

const router = Router();

// Create new chat session
router.post('/sessions', (req, res) => {
  try {
    const sessionId = uuidv4();
    const session: ChatSession = {
      id: sessionId,
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveSession(session);

    res.json({
      success: true,
      message: 'Chat session created successfully',
      data: session,
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create chat session',
      data: null,
    });
  }
});

// Get all sessions
router.get('/sessions', (req, res) => {
  try {
    const sessions = getSessions();
    res.json({
      success: true,
      message: 'Sessions retrieved successfully',
      data: sessions,
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sessions',
      data: [],
    });
  }
});

// Get single session
router.get('/sessions/:id', (req, res) => {
  try {
    const session = getSession(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
        data: null,
      });
    }

    res.json({
      success: true,
      message: 'Session retrieved successfully',
      data: session,
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve session',
      data: null,
    });
  }
});

// Send message and get AI response
router.post('/sessions/:id/messages', async (req, res) => {
  try {
    const { content, documentId } = req.body;
    const session = getSession(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
        data: null,
      });
    }

    // Create user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      content,
      sender: 'user',
      timestamp: new Date().toISOString(),
      documentId,
    };

    session.messages.push(userMessage);

    // Search for relevant context from documents
    const searchResults = await searchDocuments(content, 3);
    const context = searchResults.map(r => r.text);

    // Build conversation history for context
    const conversationHistory = session.messages
      .slice(-10) // Last 10 messages for context
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content,
      }));

    // Generate AI response
    const aiResponseContent = await generateChatResponse(
      content,
      context,
      conversationHistory.slice(0, -1) // Exclude the message we just added
    );

    // Create AI message with references
    const aiMessage: ChatMessage = {
      id: uuidv4(),
      content: aiResponseContent,
      sender: 'ai',
      timestamp: new Date().toISOString(),
      references: searchResults.length > 0
        ? searchResults.map(r => ({
            id: r.documentId,
            title: `Document ${r.documentId.slice(0, 8)}`,
            relevantSection: r.text.slice(0, 100) + '...',
            confidence: r.score,
          }))
        : undefined,
    };

    session.messages.push(aiMessage);

    // Update session title if it's the first message
    if (session.messages.length === 2) {
      session.title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
    }

    session.updatedAt = new Date().toISOString();
    saveSession(session);

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: aiMessage,
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      data: null,
    });
  }
});

// Delete session
router.delete('/sessions/:id', (req, res) => {
  try {
    const deleted = removeSession(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
        data: null,
      });
    }

    res.json({
      success: true,
      message: 'Session deleted successfully',
      data: null,
    });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete session',
      data: null,
    });
  }
});

export default router;
