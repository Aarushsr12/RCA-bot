export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  state: {
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export async function searchLinearIssues(
  query: string
): Promise<LinearIssue[]> {
  //const cleaned = query.replace(/<@[^>]+>/g, "").trim();

  //FIX: improve support team promtps here, it will bring good keywords that will
  // in linear search

  const body = {
    query: `
      query SearchIssues($q: String!) {
        issues(
          filter: {
            or: [
              { title: { contains: $q } }
              { description: { contains: $q } }
            ]
          }
          first: 5
        ) {
          nodes {
            id
            identifier
            title
            description
            state {
              name
            }
            createdAt
            updatedAt
          }
        }
      }
    `,
    variables: { q: query },
  };

  try {
    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        Authorization: process.env.LINEAR_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log("📨 Linear Response:", data);

    return data?.data?.issues?.nodes ?? [];
  } catch (err) {
    console.error("❌ Linear search failed:", err);
    return [];
  }
}
