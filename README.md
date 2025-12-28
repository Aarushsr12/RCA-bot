Workflow: 
### **Phase 1: Indexing (One-time setup) - [indexer.ts](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html)**

1. **Code Discovery** 📁
    
    - [walkDirectory()](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html) recursively scans your [CODE_ROOT](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html) directory
    - Filters for `.ts`, `.tsx`, `.js`, `.jsx` files
    - Skips directories like [node_modules](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html), [dist](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html), [.git](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html)
2. **Code Chunking** ✂️
    
    - Each file is split into chunks of max 3000 characters
    - [chunkContent()](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html) splits by lines to keep code contextually intact
    - This prevents hitting OpenAI's token limits
3. **Embedding Generation** 🧬
    
    - For **each chunk**, calls OpenAI's [text-embedding-3-small](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html) model
    - Converts code text → **vector of numbers** (embedding)
    - These embeddings capture semantic meaning of the code
    - Rate limited with 100ms delays between API calls
4. **Index Storage** 💾
    
    - All chunks saved to [code_index.json](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html) with structure:

### **Phase 2: Search (When issue is reported) - [search.ts](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html)**

1. **Query Embedding** 🔍
    
    - User's issue description (e.g., "login button not working") → sent to OpenAI
    - Generates embedding vector for the **query** using same model
2. **Similarity Calculation** 📊
    
    - Loads all code chunks from [code_index.json](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html)
    - Computes **cosine similarity** between:
        - Query embedding vs. each code chunk embedding
    - Cosine similarity = measures how "similar" two vectors are (0 to 1)
3. **Ranking** 🥇
    
    - Sorts all chunks by similarity score (highest first)
    - Returns top 5 most relevant code sections


### **Phase 3: RCA Generation - [engine.ts](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html)**

1. **Prompt Construction** 📝
    
    - Takes user's issue text
    - Adds the top 5 relevant code chunks (with file names & similarity scores)
    - Creates a structured prompt asking GPT-4o-mini to:
        - Analyze the code
        - Find root cause
        - Suggest fixes
2. **LLM Call** 🤖
    
3. **Response Processing** ✅
    
    - LLM reads the issue + relevant code chunks
    - Returns JSON with:
        - [summary](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html): Brief overview
        - [thinking](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html): Analysis process
        - [root_cause](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html): What's wrong
        - [files_mentioned](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html): Which files are involved
        - [suggested_fix](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html): Code patch or fix instructions
        - [confidence](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html): 0-100 score



QQ: Do LLM reads embeddings then ?
Answer: no, LLM to read embeddings, it mains purpose it for searching & keeping the context window shorter, were build that prompt to with filtered code & earlier prompt to give to our llm to perform action on it

QQ: what is cosine similairity?
A math formula to measure how similar two vectors are (0 = completely different, 1 = identical).
Query vector:        [0.12, 0.45, -0.33, ...]

Chunk 1 (github.ts): [0.15, 0.43, -0.31, ...] → Similarity: 0.92 ✓ High!
Chunk 2 (slack.ts):  [0.78, -0.22, 0.55, ...] → Similarity: 0.34 ✗ Low
Chunk 3 (github.ts): [0.11, 0.47, -0.35, ...] → Similarity: 0.89 ✓ High!
