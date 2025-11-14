import "dotenv/config";
import { slackApp } from "./slack/trigger";

async function main() {
  await slackApp.start();
  console.log("⚡ Slack RCA Bot is running...");
}

main();
