import { Client } from "@notionhq/client";

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID || "";

interface RCAResult {
  summary: string;
  root_cause: string;
  files_mentioned: string[];
  suggested_fix: string;
  confidence: number;
}

export async function createNotionRCAPage(
  query: string,
  rcaResult: RCAResult
): Promise<string | null> {
  try {
    const response = await notion.pages.create({
      parent: {
        database_id: DATABASE_ID,
      },
      properties: {
        Title: {
          title: [
            {
              text: {
                content: `RCA: ${query.substring(0, 100)}`,
              },
            },
          ],
        },
      },
      children: [
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [
              {
                text: {
                  content: `Confidence: ${rcaResult.confidence}%`,
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [
              {
                text: {
                  content: "Summary",
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                text: {
                  content: rcaResult.summary,
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [
              {
                text: {
                  content: "Root Cause",
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                text: {
                  content: rcaResult.root_cause,
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [
              {
                text: {
                  content: "Files Mentioned",
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              {
                text: {
                  content: rcaResult.files_mentioned.join(", ") || "None",
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [
              {
                text: {
                  content: "Suggested Fix",
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                text: {
                  content: rcaResult.suggested_fix,
                },
              },
            ],
          },
        },
      ],
    });

    // Return the page URL if available
    if ("url" in response) {
      return response.url;
    }
    return `Page created with ID: ${response.id}`;
  } catch (error) {
    console.error("Error creating Notion page:", error);
    return null;
  }
}
