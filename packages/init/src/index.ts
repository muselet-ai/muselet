import fs from "fs-extra";
import path from "node:path";
import { commitlintConfig } from "./templates/commitlint-config.js";
import { githubAction } from "./templates/github-action.js";
import { agentInstructions } from "./templates/agent-instructions.js";

const cwd = process.cwd();

async function main() {
  console.log("🧵 muselet init\n");

  const created: string[] = [];

  // Detect existing tools
  const hasCommitlint = await fs.pathExists(path.join(cwd, "commitlint.config.js")) ||
    await fs.pathExists(path.join(cwd, "commitlint.config.mjs")) ||
    await fs.pathExists(path.join(cwd, ".commitlintrc.json"));

  const hasHusky = await fs.pathExists(path.join(cwd, ".husky"));

  if (hasCommitlint) {
    console.log("⚠️  Existing commitlint config detected — skipping commitlint.config.js");
  } else {
    await fs.writeFile(path.join(cwd, "commitlint.config.js"), commitlintConfig);
    created.push("commitlint.config.js");
  }

  // GitHub Action
  const workflowDir = path.join(cwd, ".github", "workflows");
  const workflowPath = path.join(workflowDir, "muselet.yml");
  await fs.ensureDir(workflowDir);
  await fs.writeFile(workflowPath, githubAction);
  created.push(".github/workflows/muselet.yml");

  // Agent instructions
  await fs.writeFile(path.join(cwd, "muselet.md"), agentInstructions);
  created.push("muselet.md");

  // Summary
  console.log("✅ Created:");
  for (const f of created) {
    console.log(`   ${f}`);
  }

  console.log("");

  if (hasHusky) {
    console.log("🐶 Husky detected. Add a commit-msg hook:");
    console.log('   npx husky add .husky/commit-msg \'npx --no -- commitlint --edit "$1"\'');
  } else {
    console.log("💡 To enforce on commit, install husky:");
    console.log("   npm install -D husky && npx husky init");
    console.log('   echo \'npx --no -- commitlint --edit "$1"\' > .husky/commit-msg');
  }

  console.log("");
  console.log("📦 Install dependencies:");
  console.log("   npm install -D @commitlint/cli @commitlint/config-conventional @muselet/commitlint-plugin");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
