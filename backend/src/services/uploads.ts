import { randomUUID } from "node:crypto";
import { Document } from "../types";
import { saveDocument, saveDocumentContent, getDocument } from "./storage";
import { embedDocument } from "./openai";
import { indexDocument } from "./pinecone";

/** Both interfaces use the original store and optional vector-indexing workflow. */
export function saveUploadedDocument(
  content: string,
  file: { originalname: string; mimetype: string; size: number },
): Document {
  const indexing = Boolean(
    process.env.OPENAI_API_KEY && process.env.PINECONE_API_KEY,
  );
  const document: Document = {
    id: randomUUID(),
    title: file.originalname,
    originalContent: content,
    uploadDate: new Date().toISOString(),
    status: indexing ? "processing" : "completed",
    fileType: file.mimetype,
    fileSize: file.size,
  };
  saveDocument(document);
  saveDocumentContent(document.id, content);
  if (indexing)
    void embedDocument(content)
      .then((chunks) => indexDocument(document.id, chunks))
      .catch(() =>
        console.error(
          "Document indexing failed; the uploaded document remains available.",
        ),
      )
      .finally(() => {
        const saved = getDocument(document.id);
        if (saved) {
          saved.status = "completed";
          saveDocument(saved);
        }
      });
  return document;
}
