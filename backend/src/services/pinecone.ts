import { Pinecone } from '@pinecone-database/pinecone';
import { embedText } from './openai';

let pinecone: Pinecone | null = null;
let index: ReturnType<Pinecone['index']> | null = null;

const INDEX_NAME = process.env.PINECONE_INDEX || 'legal-search';

/**
 * Initialize Pinecone client and index
 */
export async function initPinecone(): Promise<void> {
  if (!process.env.PINECONE_API_KEY) {
    console.warn('PINECONE_API_KEY not set - search functionality will be limited');
    return;
  }

  try {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    // Check if index exists
    const indexes = await pinecone.listIndexes();
    const indexExists = indexes.indexes?.some(idx => idx.name === INDEX_NAME);

    if (!indexExists) {
      console.log(`Creating Pinecone index: ${INDEX_NAME}`);
      await pinecone.createIndex({
        name: INDEX_NAME,
        dimension: 1536, // text-embedding-3-small dimension
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });
      // Wait for index to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    index = pinecone.index(INDEX_NAME);
    console.log('Pinecone initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Pinecone:', error);
  }
}

/**
 * Index a document's chunks in Pinecone
 */
export async function indexDocument(
  documentId: string,
  chunks: { chunk: string; embedding: number[] }[]
): Promise<void> {
  if (!index) {
    console.warn('Pinecone not initialized - skipping indexing');
    return;
  }

  const vectors = chunks.map((item, i) => ({
    id: `${documentId}-chunk-${i}`,
    values: item.embedding,
    metadata: {
      documentId,
      chunkIndex: i,
      text: item.chunk,
    },
  }));

  // Upsert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.upsert(batch);
  }
}

/**
 * Search for similar document chunks
 */
export async function searchDocuments(
  query: string,
  topK: number = 5
): Promise<{ documentId: string; text: string; score: number }[]> {
  if (!index) {
    console.warn('Pinecone not initialized - returning empty results');
    return [];
  }

  try {
    const queryEmbedding = await embedText(query);

    const results = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    return results.matches?.map(match => ({
      documentId: match.metadata?.documentId as string,
      text: match.metadata?.text as string,
      score: match.score || 0,
    })) || [];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

/**
 * Delete all vectors for a document
 */
export async function deleteDocumentVectors(documentId: string): Promise<void> {
  if (!index) {
    return;
  }

  try {
    // Delete by filter (document ID prefix)
    await index.deleteMany({
      filter: {
        documentId: { $eq: documentId },
      },
    });
  } catch (error) {
    console.error('Failed to delete document vectors:', error);
  }
}
