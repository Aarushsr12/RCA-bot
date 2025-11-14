# RCA Engine Documentation

This module provides AI-powered Root Cause Analysis for support queries by searching your codebase and generating structured diagnostics.

## Setup

### 1. Environment Variables

Add these to your `.env` file:

```bash
OPENAI_API_KEY=your_openai_api_key_here
CODE_ROOT=../path-to-your-react-project
INDEX_PATH=./code_index.json
```

### 2. Install Dependencies

```bash
npm install
```

## Usage

### Step 1: Build the Code Index

Before you can perform RCA, you need to index your codebase:

```bash
npx tsx src/rca/indexer.ts
```

This will:
- Scan all `.ts`, `.tsx`, `.js`, `.jsx` files in `CODE_ROOT`
- Skip `node_modules`, `dist`, `build`, `.git`, etc.
- Chunk files into ~3000 character segments
- Generate embeddings using OpenAI `text-embedding-3-large`
- Save the index to `code_index.json`

**Note:** This process can take several minutes depending on codebase size and may incur OpenAI API costs.

### Step 2: Generate RCA

Import and use the RCA engine in your code:

```typescript
import { generateRCA } from './src/rca/engine.js';

const result = await generateRCA("checkout is failing on retry");
console.log(result);
```

## Module Structure

### `indexer.ts`
- Walks the codebase directory
- Filters relevant files
- Chunks code into manageable pieces
- Generates embeddings for each chunk
- Saves to JSON index

### `search.ts`
- Loads the code index
- Generates embeddings for search queries
- Computes cosine similarity
- Returns top K matching code chunks

### `engine.ts`
- Takes a support query
- Searches for relevant code using `search.ts`
- Builds a detailed prompt with code context
- Calls GPT-4o to generate structured RCA
- Returns JSON with:
  - `summary`: Brief issue summary
  - `root_cause`: Detailed explanation
  - `files_mentioned`: Affected files
  - `suggested_fix`: Code patch or fix description
  - `confidence`: 0-100 score

## Integration with Slack Bot

To integrate with your existing Slack bot:

```typescript
import { generateRCA } from './rca/engine.js';

// In your Slack message handler
app.event('app_mention', async ({ event, say }) => {
  const query = event.text.replace(/<@.*?>/, '').trim();
  
  const rca = await generateRCA(query);
  
  await say({
    text: `*RCA Summary:* ${rca.summary}\n\n` +
          `*Root Cause:* ${rca.root_cause}\n\n` +
          `*Files:* ${rca.files_mentioned.join(', ')}\n\n` +
          `*Suggested Fix:*\n\`\`\`${rca.suggested_fix}\`\`\`\n\n` +
          `*Confidence:* ${rca.confidence}%`
  });
});
```

## Re-indexing

Run the indexer again whenever your codebase changes significantly:

```bash
npx tsx src/rca/indexer.ts
```

## Cost Considerations

- **Indexing**: Uses `text-embedding-3-large` (~$0.13 per 1M tokens)
- **Search**: Uses `text-embedding-3-large` for each query
- **RCA Generation**: Uses `gpt-4o` (~$2.50 per 1M input tokens, ~$10 per 1M output tokens)

A typical codebase with 100 files might cost $1-5 to index, and each RCA query costs $0.01-0.10.
