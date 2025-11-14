import * as fs from "fs";
import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const INDEX_PATH = process.env.INDEX_PATH || "./code_index.json";

interface CodeChunk {
  id: string;
  file: string;
  content: string;
  embedding: number[];
}

interface SearchResult {
  file: string;
  content: string;
  score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

async function searchCode(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  // Load index
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(
      `Index file not found at ${INDEX_PATH}. Please run indexer first.`
    );
  }

  const indexData = fs.readFileSync(INDEX_PATH, "utf-8");
  const codeChunks: CodeChunk[] = JSON.parse(indexData);

  console.log(`Loaded ${codeChunks.length} chunks from index`);

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);

  // Compute similarities
  const results: SearchResult[] = codeChunks.map((chunk) => ({
    file: chunk.file,
    content: chunk.content,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Sort by score descending and take top K
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

export { searchCode };
export type { SearchResult };
