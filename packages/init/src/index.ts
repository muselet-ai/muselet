import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  intro,
  outro,
  confirm,
  spinner,
  log,
  note,
  cancel,
  isCancel
} from "@clack/prompts";
import { commitlintConfig } from "./templates/commitlint-config.js";
import { agentInstructions } from "./templates/agent-instructions.js";

const cwd = process.cwd();

type PackageManager = "pnpm" | "yarn" | "npm";

function detectPackageManager(): PackageManager {
  if (existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
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

function run(cmd: string): void {
  log.step(`$ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

async function main() {
  intro("🧵 Welcome to muselet init");

  // Detect environment
  const pm = detectPackageManager();
  const hasCommitlintConfig =
    existsSync(path.join(cwd, "commitlint.config.js")) ||
    existsSync(path.join(cwd, "commitlint.config.mjs")) ||
    existsSync(path.join(cwd, ".commitlintrc.json"));
  const hasHusky = existsSync(path.join(cwd, ".husky"));
  const hasWorkflow = existsSync(path.join(cwd, ".github", "workflows", "muselet.yml"));

  // Show detection info
  log.info("Environment detected:");
  log.step(`Package Manager: ${pm} (from ${pm === "pnpm" ? "pnpm-lock.yaml" : pm === "yarn" ? "yarn.lock" : "package.json"})`);
  if (hasHusky) log.step("✓ Husky already installed");
  if (hasCommitlintConfig) log.step("✓ Commitlint config already exists");
  if (hasWorkflow) log.step("✓ Muselet workflow already exists");

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

  log.info("Planned actions:");
  for (const step of plan) {
    log.step(`• ${step}`);
  }

  const proceed = await confirm({
    message: "Proceed with setup?",
    initialValue: true
  });

  if (isCancel(proceed) || !proceed) {
    cancel("Setup cancelled.");
    return;
  }

  // Execute setup
  const s = spinner();
  
  try {
    // 1. Install deps
    s.start("Installing dependencies...");
    run(`${installCmd(pm)} ${deps.join(" ")}`);
    s.stop("✅ Dependencies installed");

    // 2. Husky
    if (!hasHusky) {
      s.start("Setting up husky...");
      run(`${installCmd(pm)} husky`);
      run("npx husky init");
      s.stop("✅ Husky configured");
    }

    // 3. Commit-msg hook
    s.start("Creating commit-msg hook...");
    const hookDir = path.join(cwd, ".husky");
    const hookPath = path.join(hookDir, "commit-msg");
    await fs.mkdir(hookDir, { recursive: true });
    await fs.writeFile(hookPath, 'npx --no -- commitlint --edit "$1"\n', { mode: 0o755 });
    s.stop("✅ Commit hook created");

    // 4. Commitlint config
    if (!hasCommitlintConfig) {
      s.start("Creating commitlint config...");
      await fs.writeFile(path.join(cwd, "commitlint.config.js"), commitlintConfig);
      s.stop("✅ Commitlint config created");
    } else {
      const overwrite = await confirm({
        message: "Overwrite existing commitlint config?",
        initialValue: false
      });
      
      if (isCancel(overwrite)) {
        cancel("Setup cancelled.");
        return;
      }
      
      if (overwrite) {
        await fs.writeFile(path.join(cwd, "commitlint.config.js"), commitlintConfig);
        log.success("✅ Commitlint config overwritten");
      } else {
        log.info("⊘ Skipped commitlint config");
      }
    }

    // 5. GitHub Action workflow
    if (!hasWorkflow) {
      s.start("Creating GitHub workflow...");
      const workflowDir = path.join(cwd, ".github", "workflows");
      await fs.mkdir(workflowDir, { recursive: true });
      await fs.writeFile(path.join(workflowDir, "muselet.yml"), generateWorkflow(pm));
      s.stop("✅ GitHub workflow created");
    } else {
      log.info("⊘ Skipped GitHub workflow (already exists)");
    }

    // 6. Agent instructions
    s.start("Creating agent instructions...");
    await fs.writeFile(path.join(cwd, "muselet.md"), agentInstructions);
    s.stop("✅ Agent instructions created");

    // Success!
    log.success("🎉 Setup complete!");

    note("Try it out:\n" +
      '• git commit -m "fix: something" → ✖ missing Why\n' +
      '• git commit -m "fix: something\\n\\nWhy: reason" → ✔ passes',
      "Next steps"
    );

  } catch (error) {
    s.stop("❌ Setup failed", 1);
    throw error;
  }

  outro("Happy committing! 🚀");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
