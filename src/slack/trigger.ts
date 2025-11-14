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

// Track processed events to prevent duplicates
const processedEvents = new Set<string>();

slackApp.event("app_mention", async ({ event, say }) => {
  // Deduplicate events
  const eventId = `${event.event_ts}-${event.channel}`;
  if (processedEvents.has(eventId)) {
    console.log("⚠️ Skipping duplicate event:", eventId);
    return;
  }
  processedEvents.add(eventId);

  // Clean up old events (keep last 100)
  if (processedEvents.size > 100) {
    const oldest = Array.from(processedEvents).slice(0, 50);
    oldest.forEach((id) => processedEvents.delete(id));
  }

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

    await say(`📝 Related Linear Issues:\n${summary}`);
  }

  if (!prs.length) {
    await say("❌ No PRs found for this query.");
  } else {
    const prSummary = prs
      .map((pr) => `• <${pr.pr_link}|PR #${pr.number}> - ${pr.title}`)
      .join("\n");

    await say(`📦 Relevant GitHub PRs:\n${prSummary}`);
  }

  const rcaResult = await generateRCA(query);
  if (!rcaResult) {
    await say("❌ No RCA Available");
  } else {
    await say({
      text: `RCA: ${rcaResult.summary}`, // Fallback text for notifications
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🔍 Root Cause Analysis",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Confidence:*\n${rcaResult.confidence}%`,
            },
            {
              type: "mrkdwn",
              text: `*Files Affected:*\n${
                rcaResult.files_mentioned.length || 0
              }`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*📋 Summary*\n${rcaResult.summary}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `* 🧠 Analysis Process*\n_${rcaResult.thinking}_`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `* 🔎 Root Cause*\n${rcaResult.root_cause}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*📁 Files Mentioned*\n${
              rcaResult.files_mentioned.length > 0
                ? rcaResult.files_mentioned.map((f) => `• \`${f}\``).join("\n")
                : "_None_"
            }`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*🔧 Suggested Fix*\n\`\`\`\n${rcaResult.suggested_fix}\n\`\`\``,
          },
        },
        {
          type: "divider",
        },
      ],
    });

    const notionPageUrl = await createNotionRCAPage(query, rcaResult);
    if (notionPageUrl) {
      await say(`📄 RCA saved to Notion: ${notionPageUrl}`);
    } else {
      await say("⚠️ Could not save to Notion (check logs for details)");
    }
  }
});
