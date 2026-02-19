import fs from "fs-extra";
import path from "node:path";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { commitlintConfig } from "./templates/commitlint-config.js";
import { githubAction } from "./templates/github-action.js";
import { agentInstructions } from "./templates/agent-instructions.js";

const cwd = process.cwd();

type PackageManager = "pnpm" | "yarn" | "npm";

function detectPackageManager(): PackageManager {
  if (fs.pathExistsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.pathExistsSync(path.join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

function installCmd(pm: PackageManager): string {
  switch (pm) {
    case "pnpm": return "pnpm add -D";
    case "yarn": return "yarn add -D";
    case "npm": return "npm install -D";
  }
}

function ciInstallCmd(pm: PackageManager): string {
  switch (pm) {
    case "pnpm": return "npm i -g pnpm && pnpm install --frozen-lockfile";
    case "yarn": return "yarn install --frozen-lockfile";
    case "npm": return "npm ci";
  }
}

function generateWorkflow(pm: PackageManager): string {
  return `name: Lint Commits (muselet)

on:
  pull_request:
    branches: [main]

jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: ${ciInstallCmd(pm)}

      - name: Lint commits
        run: npx commitlint --from \${{ github.event.pull_request.base.sha }} --to \${{ github.event.pull_request.head.sha }} --verbose
`;
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() !== "n");
    });
  });
}

function run(cmd: string): void {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

async function main() {
  console.log("🧵 muselet init\n");

  // Detect environment
  const pm = detectPackageManager();
  const hasCommitlintConfig =
    fs.pathExistsSync(path.join(cwd, "commitlint.config.js")) ||
    fs.pathExistsSync(path.join(cwd, "commitlint.config.mjs")) ||
    fs.pathExistsSync(path.join(cwd, ".commitlintrc.json"));
  const hasHusky = fs.pathExistsSync(path.join(cwd, ".husky"));
  const hasWorkflow = fs.pathExistsSync(path.join(cwd, ".github", "workflows", "muselet.yml"));

  console.log(`Detected: ${pm} (from ${pm === "pnpm" ? "pnpm-lock.yaml" : pm === "yarn" ? "yarn.lock" : "package-lock.json / default"})`);
  if (hasHusky) console.log("Detected: husky already installed");
  if (hasCommitlintConfig) console.log("Detected: commitlint config already exists");
  if (hasWorkflow) console.log("Detected: muselet workflow already exists");
  console.log("");

  // Build plan
  const deps = ["@commitlint/cli", "@commitlint/config-conventional", "@muselet/commitlint-plugin"];
  const plan: string[] = [];

  plan.push(`Install ${deps.join(", ")}`);
  if (!hasHusky) {
    plan.push("Install husky + commit-msg hook");
  } else {
    plan.push("Add commit-msg hook to existing husky");
  }
  if (!hasCommitlintConfig) {
    plan.push("Create commitlint.config.js");
  }
  if (!hasWorkflow) {
    plan.push("Create .github/workflows/muselet.yml");
  }
  plan.push("Create muselet.md (agent instructions)");

  console.log("muselet will:");
  for (const step of plan) {
    console.log(`  ✓ ${step}`);
  }
  console.log("");

  const proceed = await confirm("Proceed? (Y/n) ");
  if (!proceed) {
    console.log("Aborted.");
    process.exit(0);
  }
  console.log("");

  // Execute
  // 1. Install deps
  console.log("📦 Installing dependencies...");
  run(`${installCmd(pm)} ${deps.join(" ")}`);
  console.log("");

  // 2. Husky
  if (!hasHusky) {
    console.log("🐶 Setting up husky...");
    run(`${installCmd(pm)} husky`);
    run("npx husky init");
  }

  // 3. Commit-msg hook
  const hookDir = path.join(cwd, ".husky");
  const hookPath = path.join(hookDir, "commit-msg");
  await fs.ensureDir(hookDir);
  await fs.writeFile(hookPath, 'npx --no -- commitlint --edit "$1"\n', { mode: 0o755 });
  console.log("✓ Created .husky/commit-msg");

  // 4. Commitlint config
  if (!hasCommitlintConfig) {
    await fs.writeFile(path.join(cwd, "commitlint.config.js"), commitlintConfig);
    console.log("✓ Created commitlint.config.js");
  } else {
    const overwrite = await confirm("  Overwrite existing commitlint config? (y/N) ");
    if (overwrite) {
      await fs.writeFile(path.join(cwd, "commitlint.config.js"), commitlintConfig);
      console.log("✓ Overwrote commitlint.config.js");
    } else {
      console.log("⊘ Skipped commitlint.config.js");
    }
  }

  // 5. GitHub Action workflow
  if (!hasWorkflow) {
    const workflowDir = path.join(cwd, ".github", "workflows");
    await fs.ensureDir(workflowDir);
    await fs.writeFile(path.join(workflowDir, "muselet.yml"), generateWorkflow(pm));
    console.log("✓ Created .github/workflows/muselet.yml");
  } else {
    console.log("⊘ Skipped .github/workflows/muselet.yml (already exists)");
  }

  // 6. Agent instructions
  await fs.writeFile(path.join(cwd, "muselet.md"), agentInstructions);
  console.log("✓ Created muselet.md");

  console.log("\n🎉 Done! Commits will now be linted for context.\n");
  console.log("Try it:");
  console.log('  git commit -m "fix: something" → ✖ missing Why');
  console.log('  git commit -m "fix: something\\n\\nWhy: reason" → ✔ passes');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
