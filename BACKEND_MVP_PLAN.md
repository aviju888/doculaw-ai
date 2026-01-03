# DocuLaw AI - Basic Backend MVP Plan

## Overview

A minimal backend to make the existing frontend functional. This is a proof-of-concept to demonstrate core features working end-to-end.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **LLM**: Groq (llama-3.1-8b-instant) for simplification and chat
- **Embeddings**: OpenAI (text-embedding-3-small)
- **Vector DB**: Pinecone for semantic search
- **Storage**: File-based (JSON files) - no database for MVP

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # Express server entry point
│   ├── routes/
│   │   ├── documents.ts      # Document upload, get, simplify
│   │   ├── chat.ts           # Chat sessions and messages
│   │   ├── search.ts         # Semantic search
│   │   └── health.ts         # Health check
│   ├── services/
│   │   ├── groq.ts           # Groq LLM integration
│   │   ├── openai.ts         # OpenAI embeddings
│   │   ├── pinecone.ts       # Vector database
│   │   └── storage.ts        # File-based storage
│   └── types/
│       └── index.ts          # TypeScript interfaces
├── data/                     # File storage for documents
│   ├── documents/            # Uploaded files
│   └── sessions/             # Chat sessions
├── package.json
├── tsconfig.json
└── .env.example
```

## API Endpoints (MVP Scope)

### 1. Health Check
```
GET /api/health
Response: { status: "ok", timestamp: "..." }
```

### 2. Document Management
```
POST /api/documents/upload
- Upload file (multipart/form-data)
- Extract text content
- Store document metadata
- Return documentId

GET /api/documents
- Return list of all documents

GET /api/documents/:id
- Return single document with content

DELETE /api/documents/:id
- Remove document

POST /api/documents/simplify
- Take documentId and simplificationLevel
- Call Groq LLM to simplify the content
- Update document with simplifiedContent
- Return updated document
```

### 3. Chat
```
POST /api/chat/sessions
- Create new chat session
- Return session object

GET /api/chat/sessions
- Return all sessions

GET /api/chat/sessions/:id
- Return session with messages

POST /api/chat/sessions/:id/messages
- Send user message
- Query Pinecone for context (if documents exist)
- Call Groq LLM for AI response
- Return AI message

DELETE /api/chat/sessions/:id
- Delete session
```

### 4. Search
```
POST /api/search/documents
- Take query string
- Convert to embedding via OpenAI
- Query Pinecone for similar documents
- Return ranked results
```

## Environment Variables

```env
# Server
PORT=3001

# Groq (for LLM)
GROQ_API_KEY=your_groq_api_key

# OpenAI (for embeddings)
OPENAI_API_KEY=your_openai_api_key

# Pinecone (for vector search)
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=legal-search
```

## Key Features for MVP

### Document Simplification Flow
1. User uploads document → stored as file + metadata
2. Text extracted from document
3. Document indexed in Pinecone (chunked + embedded)
4. User clicks "Simplify" → Groq LLM rewrites in plain language
5. Simplified content stored and displayed

### Chat Flow
1. User starts chat session
2. User sends message
3. Backend queries Pinecone for relevant document chunks
4. Groq LLM generates response with context
5. Response returned with document references

### Search Flow
1. User enters search query
2. Query embedded via OpenAI
3. Pinecone returns similar document chunks
4. Results returned with relevance scores

## Simplification Prompt (Groq)

```
You are a legal document simplifier. Rewrite the following legal text in plain,
easy-to-understand language.

User's English proficiency: {level}
User's legal experience: {experience}
Preferred reading style: {preference}

Original text:
{document_content}

Provide a clear, simplified version that:
- Uses simple vocabulary
- Breaks down complex sentences
- Explains legal terms when used
- Maintains the key meaning and obligations
```

## What This MVP Enables

| Feature | Before | After MVP |
|---------|--------|-----------|
| Document Upload | Fake progress bar | Actually stores files |
| Simplification | Static mock text | Real Groq LLM output |
| Chat | Hardcoded responses | Real AI conversation |
| Search | Mock results | Real semantic search |

## What's NOT in MVP

- User authentication (all data shared)
- PostgreSQL database (using JSON files)
- Real-time WebSocket chat
- PDF text extraction (plain text only for MVP)
- File size limits / validation
- Rate limiting
- Error retry logic

## Next Steps After MVP

1. Add user authentication (JWT)
2. Migrate to PostgreSQL
3. Add PDF/DOCX text extraction
4. Implement proper error handling
5. Add request validation
6. Deploy to cloud (Railway/Render/Fly.io)
