import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});
export const searchGithubPrs = async (query: string) => {
  const org = process.env.OWNER;
  const repo = process.env.REPO;

  const octokit = new Octokit();
  const q = `${query} repo:${org}/${repo} type:pr`;

  const res = await octokit.request("GET /search/issues", {
    q,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  return res.data.items.map((i) => ({
    number: i.number,
    title: i.title,
    pr_link: i.html_url,
    updatedAt: i.updated_at,
  }));
};
