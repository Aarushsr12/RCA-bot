import OpenAI from "openai";
import * as dotenv from "dotenv";
import { searchCode } from "./search.js";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RCAResult {
  summary: string;
  root_cause: string;
  files_mentioned: string[];
  suggested_fix: string;
  confidence: number;
}

function buildPrompt(
  issueText: string,
  codeMatches: { file: string; content: string; score: number }[]
): string {
  let prompt = `You are an expert senior engineer performing root cause analysis on a reported issue.

**USER-REPORTED ISSUE:**
${issueText}

**RELEVANT CODE SECTIONS:**
`;

  codeMatches.forEach((match, idx) => {
    prompt += `
--- Code Match ${idx + 1} (File: ${match.file}, Relevance: ${(
      match.score * 100
    ).toFixed(1)}%) ---
\`\`\`
${match.content}
\`\`\`
`;
  });

  prompt += `

**INSTRUCTIONS:**
Based on the issue and the code samples above:
1. Identify the most likely root cause of the problem
2. Specify which file(s) and code sections are involved
3. Provide a suggested fix with a code patch or detailed explanation
4. Assess your confidence level (0-100)

Return your analysis as valid JSON only, with this exact structure:
{
  "summary": "Brief one-sentence summary of the issue",
  "root_cause": "Detailed explanation of what is causing the issue",
  "files_mentioned": ["array", "of", "file", "paths"],
  "suggested_fix": "Code diff or detailed code fix explanation",
  "confidence": <number 0-100>
}

Do not include any text outside the JSON object.`;

  return prompt;
}

async function generateRCA(issueText: string): Promise<RCAResult> {
  console.log("Searching for relevant code...");

  // Get top 5 relevant code chunks
  const codeMatches = await searchCode(issueText, 5);

  if (codeMatches.length === 0) {
    console.warn("No relevant code found for the issue");
    return {
      summary: "No relevant code found",
      root_cause: "Unable to locate relevant code sections for this issue",
      files_mentioned: [],
      suggested_fix:
        "Please ensure the code index is up to date and the issue description is detailed",
      confidence: 0,
    };
  }

  console.log(`Found ${codeMatches.length} relevant code sections`);

  // Build prompt
  const prompt = buildPrompt(issueText, codeMatches);

  // Call OpenAI
  console.log("Generating RCA with GPT-4o-mini...");
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert software engineer performing root cause analysis. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Try to parse JSON
    try {
      const rcaResult = JSON.parse(content) as RCAResult;

      // Validate structure
      if (
        !rcaResult.summary ||
        !rcaResult.root_cause ||
        !rcaResult.files_mentioned ||
        !rcaResult.suggested_fix
      ) {
        throw new Error("Invalid RCA structure");
      }

      return rcaResult;
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      console.error("Raw response:", content);

      // Return fallback structure
      return {
        summary: "RCA generation completed (parsing failed)",
        root_cause: content,
        files_mentioned: codeMatches.map((m) => m.file),
        suggested_fix: "See root_cause field for details",
        confidence: 50,
      };
    }
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    throw error;
  }
}

export { generateRCA };
export type { RCAResult };
