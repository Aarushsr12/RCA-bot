import { App } from "@slack/bolt";
import { searchLinearIssues } from "../collectors/linear";
import { searchGithubPrs } from "../collectors/github";
import { createNotionRCAPage } from "../collectors/notion";
import { generateRCA } from "../rca/engine";
import { expandQuery } from "../collectors/queryEnhancer/expand";

export const slackApp = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

slackApp.event("app_mention", async ({ event, say }) => {
  const text = event.text ?? "";
  const query = text.replace(/<@[^>]+>/g, "").trim();
  await say("RCA Bot is here!👋 ");

  const variations = await expandQuery(query);

  console.log("debug", variations);

  const [issueResults, prResults] = await Promise.all([
    Promise.all(variations.map((v) => searchLinearIssues(v))),
    Promise.all(variations.map((v) => searchGithubPrs(v))),
  ]);

  const issues = Array.from(
    new Map(issueResults.flat().map((issue) => [issue.id, issue])).values()
  );

  const prs = Array.from(
    new Map(prResults.flat().map((pr) => [pr.number, pr])).values()
  );

  if (!issues.length) {
    await say("❌ No related Linear tickets found.");
  } else {
    const summary = issues
      .map((i) => `• *${i.identifier}* — ${i.title}`)
      .join("\n");

    await say(`📝 **Related Linear Issues:**\n${summary}`);
  }

  if (!prs.length) {
    await say("❌ No PRs found for this query.");
  } else {
    const prSummary = prs
      .map((pr) => `• <${pr.pr_link}|PR #${pr.number}> — ${pr.title}`)
      .join("\n");

    await say(`📦 **Relevant GitHub PRs:**\n${prSummary}`);
  }

  const rcaResult = await generateRCA(query);
  if (!rcaResult) {
    await say("❌ No RCA Available");
  } else {
    await say(
      `
      RCA:
      Summary: ${rcaResult.summary},
      \nRootCause: ${rcaResult.root_cause},
      \nFiles Mentioned: ${rcaResult.files_mentioned.join(", ")}
      \nSuggested Fix: ${rcaResult.suggested_fix}
      \nConfidence: ${rcaResult.confidence + "%"}
      `
    );

    // Send RCA result to Notion
    const notionPageUrl = await createNotionRCAPage(query, rcaResult);
    if (notionPageUrl) {
      await say(`📄 RCA saved to Notion: ${notionPageUrl}`);
    } else {
      await say("⚠️ Could not save to Notion (check logs for details)");
    }
  }
});
