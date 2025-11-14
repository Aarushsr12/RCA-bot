import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CODE_ROOT = process.env.CODE_ROOT || "./";
const INDEX_PATH = process.env.INDEX_PATH || "./code_index.json";
const CHUNK_SIZE = 3000;
const EXCLUDED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".next",
  ".storybook",
  "coverage",
]);

interface CodeChunk {
  id: string;
  file: string;
  content: string;
  embedding: number[];
}

function shouldIncludeFile(filePath: string): boolean {
  const ext = path.extname(filePath);
  return [".ts", ".tsx", ".js", ".jsx"].includes(ext);
}

function shouldSkipDir(dirName: string): boolean {
  return EXCLUDED_DIRS.has(dirName);
}

function chunkContent(content: string, filePath: string): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  const lines = content.split("\n");
  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > CHUNK_SIZE) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
    }
    currentChunk += line + "\n";
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function walkDirectory(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!shouldSkipDir(entry.name)) {
          files.push(...walkDirectory(fullPath));
        }
      } else if (entry.isFile() && shouldIncludeFile(fullPath)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  return files;
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

async function buildIndex(): Promise<void> {
  console.log(`Building code index from: ${CODE_ROOT}`);
  console.log(`Output path: ${INDEX_PATH}`);

  const files = walkDirectory(CODE_ROOT);
  console.log(`Found ${files.length} files to index`);

  const codeChunks: CodeChunk[] = [];
  let chunkId = 0;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const chunks = chunkContent(content, file);

      console.log(`Processing ${file} (${chunks.length} chunks)`);

      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk);
        codeChunks.push({
          id: `chunk_${chunkId++}`,
          file: path.relative(CODE_ROOT, file),
          content: chunk,
          embedding,
        });

        // Rate limiting: small delay between API calls
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  }

  console.log(`Generated ${codeChunks.length} total chunks`);
  fs.writeFileSync(INDEX_PATH, JSON.stringify(codeChunks, null, 2));
  console.log(`Index saved to ${INDEX_PATH}`);
}

export { buildIndex };

// Run if executed directly
const isMainModule =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMainModule || process.argv[1]?.includes("indexer.ts")) {
  buildIndex().catch(console.error);
}
