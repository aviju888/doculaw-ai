import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embedding for text using OpenAI's text-embedding-3-small model
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Chunk a document into smaller pieces for embedding
 */
export function chunkDocument(text: string, chunkSize: number = 400, overlap: number = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * Generate embeddings for all chunks of a document
 */
export async function embedDocument(text: string): Promise<{ chunk: string; embedding: number[] }[]> {
  const chunks = chunkDocument(text);
  const results: { chunk: string; embedding: number[] }[] = [];

  for (const chunk of chunks) {
    const embedding = await embedText(chunk);
    results.push({ chunk, embedding });
  }

  return results;
}
