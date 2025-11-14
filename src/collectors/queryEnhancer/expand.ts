import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const expandQuery = async (query: string): Promise<string[]> => {
  const prompt = `
Extract 3-5 specific keywords from this issue that would work well in Linear/GitHub search.
Focus on:
- Technical terms (error names, component names, API names)
- Action verbs (crash, fail, timeout, break)
- Feature names
- File/module names

Issue: "${query}"

Return ONLY the keywords as a JSON array of strings, no explanations.
Example: ["authentication", "timeout", "login API"]`;

  const result = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(result.choices[0].message.content || "{}");
    const keywords =
      parsed.keywords || parsed.terms || Object.values(parsed)[0] || [];

    // Always include original query + extracted keywords
    return [query, ...keywords.slice(0, 4)];
  } catch {
    // Fallback: just use the original query
    return [query];
  }
};
