import fs from 'fs';
import path from 'path';
import { Document, ChatSession } from '../types';

const DATA_DIR = path.join(__dirname, '../../data');
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const DOCUMENTS_INDEX = path.join(DATA_DIR, 'documents.json');
const SESSIONS_INDEX = path.join(DATA_DIR, 'sessions.json');

// Ensure directories exist
function ensureDirectories() {
  [DATA_DIR, DOCUMENTS_DIR, SESSIONS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Document Storage
export function getDocuments(): Document[] {
  ensureDirectories();
  if (!fs.existsSync(DOCUMENTS_INDEX)) {
    return [];
  }
  const data = fs.readFileSync(DOCUMENTS_INDEX, 'utf-8');
  return JSON.parse(data);
}

export function getDocument(id: string): Document | null {
  const documents = getDocuments();
  return documents.find(doc => doc.id === id) || null;
}

export function saveDocument(document: Document): Document {
  ensureDirectories();
  const documents = getDocuments();
  const existingIndex = documents.findIndex(doc => doc.id === document.id);

  if (existingIndex >= 0) {
    documents[existingIndex] = document;
  } else {
    documents.push(document);
  }

  fs.writeFileSync(DOCUMENTS_INDEX, JSON.stringify(documents, null, 2));
  return document;
}

export function deleteDocument(id: string): boolean {
  const documents = getDocuments();
  const filtered = documents.filter(doc => doc.id !== id);

  if (filtered.length === documents.length) {
    return false;
  }

  fs.writeFileSync(DOCUMENTS_INDEX, JSON.stringify(filtered, null, 2));

  // Also delete the file if it exists
  const filePath = path.join(DOCUMENTS_DIR, `${id}.txt`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  return true;
}

export function saveDocumentContent(id: string, content: string): void {
  ensureDirectories();
  const filePath = path.join(DOCUMENTS_DIR, `${id}.txt`);
  fs.writeFileSync(filePath, content);
}

export function getDocumentContent(id: string): string | null {
  const filePath = path.join(DOCUMENTS_DIR, `${id}.txt`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

// Chat Session Storage
export function getSessions(): ChatSession[] {
  ensureDirectories();
  if (!fs.existsSync(SESSIONS_INDEX)) {
    return [];
  }
  const data = fs.readFileSync(SESSIONS_INDEX, 'utf-8');
  return JSON.parse(data);
}

export function getSession(id: string): ChatSession | null {
  const sessions = getSessions();
  return sessions.find(session => session.id === id) || null;
}

export function saveSession(session: ChatSession): ChatSession {
  ensureDirectories();
  const sessions = getSessions();
  const existingIndex = sessions.findIndex(s => s.id === session.id);

  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.push(session);
  }

  fs.writeFileSync(SESSIONS_INDEX, JSON.stringify(sessions, null, 2));
  return session;
}

export function deleteSession(id: string): boolean {
  const sessions = getSessions();
  const filtered = sessions.filter(session => session.id !== id);

  if (filtered.length === sessions.length) {
    return false;
  }

  fs.writeFileSync(SESSIONS_INDEX, JSON.stringify(filtered, null, 2));
  return true;
}
