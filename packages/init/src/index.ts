import fs from "node:fs/promises";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import {
  intro,
  outro,
  confirm,
  select,
  spinner,
  log,
  note,
  cancel,
  isCancel
} from "@clack/prompts";
import { commitlintConfig } from "./templates/commitlint-config.js";
import { agentInstructions } from "./templates/agent-instructions.js";
import {
  DEFAULT_VALUE,
  type RuleValue,
  type SectionConfig,
} from "@muselet/commitlint-plugin";

function bannerLine(text: string, r: number, g: number, b: number, width = 50): string {
  const pad = Math.max(0, width - text.length);
  return `\x1b[48;2;${r};${g};${b}m\x1b[97m${text}${" ".repeat(pad)}\x1b[0m`;
}

function renderBanner(): string {
  const w = process.stdout.columns || 80;
  // Gold (#B8860B) → Deep orange (#CC5500) gradient, 7 rows
  const colors: [number, number, number][] = [
    [184, 134, 11],
    [180, 120, 10],
    [190, 110, 8],
    [195, 100, 6],
    [200, 90, 4],
    [205, 80, 2],
    [204, 85, 0],
  ];
  const lines = [
    "",
    "  🍾  muselet",
    "",
    "  Convention-enforced commit context.",
    "  The wire cage that keeps your commits corked.",
    "",
    "",
  ];
  return lines.map((l, i) => bannerLine(l, ...colors[i], w)).join("\n");
}

function normalizeSection(value: SectionConfig | string[]): SectionConfig {
  return Array.isArray(value) ? { required: value } : value;
}

function renderConfigTable(config: RuleValue): string {
  const header = "Type".padEnd(10) + "Required".padEnd(22) + "Recommended";
  const sep = "─".repeat(55);
  const rows = Object.entries(config).map(([type, raw]) => {
    const section = normalizeSection(raw);
    const req = (section.required ?? []).join(", ");
    const rec = (section.recommended ?? []).join(", ");
    return type.padEnd(10) + req.padEnd(22) + rec;
  });
  return [header, sep, ...rows].join("\n");
}

function validateConfig(data: unknown): data is RuleValue {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return false;
  for (const [, v] of Object.entries(data as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
    const section = v as Record<string, unknown>;
    if (!Array.isArray(section.required) || section.required.length === 0) return false;
    if (!section.required.every((s: unknown) => typeof s === "string")) return false;
    if (section.recommended !== undefined) {
      if (!Array.isArray(section.recommended)) return false;
      if (!section.recommended.every((s: unknown) => typeof s === "string")) return false;
    }
  }
  return true;
}

function openEditorForConfig(config: RuleValue): RuleValue {
  const suffix = randomBytes(4).toString("hex");
  const tmpFile = `/tmp/muselet-config-${suffix}.json`;
  try {
    writeFileSync(tmpFile, JSON.stringify(config, null, 2), "utf-8");
    const editor = process.env.EDITOR ?? process.env.VISUAL ?? "nano";
    const result = spawnSync(editor, [tmpFile], { stdio: "inherit" });
    if (result.error) {
      log.warn(`Could not open editor (${editor}): ${result.error.message}. Using defaults.`);
      return config;
    }
    const raw = readFileSync(tmpFile, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!validateConfig(parsed)) {
      log.warn("Invalid config format. Each type must have a non-empty 'required' string array. Using defaults.");
      return config;
    }
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Failed to read edited config: ${msg}. Using defaults.`);
    return config;
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

const cwd = process.cwd();

type PackageManager = "pnpm" | "yarn" | "npm";
function detectPackageManager(): PackageManager {
  if (existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

const lockFileNames: Record<PackageManager, string> = {
  pnpm: "pnpm-lock.yaml",
  yarn: "yarn.lock",
  npm: "package-lock.json",
};

function isMonorepo(): boolean {
  return existsSync(path.join(cwd, "pnpm-workspace.yaml")) ||
    existsSync(path.join(cwd, "lerna.json")) ||
    existsSync(path.join(cwd, "nx.json"));
}

function installCmd(pm: PackageManager): string {
  const mono = isMonorepo();
  switch (pm) {
    case "pnpm": return mono ? "pnpm add -wD" : "pnpm add -D";
    case "yarn": return mono ? "yarn add -WD" : "yarn add -D";
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

function generatePrDecisionWorkflow(): string {

  return `name: Muselet PR Decision Card Check

on:
  pull_request:
    types: [opened, edited, synchronize, ready_for_review]

jobs:
  decision-card:
    runs-on: ubuntu-latest
    steps:
      - name: Validate Decision Card in PR description
        env:
          PR_BODY: \${{ github.event.pull_request.body || '' }}
          PR_DRAFT: \${{ github.event.pull_request.draft }}
        shell: bash
        run: |
          START='<!-- muselet:decision-card:start -->'
          END='<!-- muselet:decision-card:end -->'

          if [ "\$PR_DRAFT" = "true" ]; then
            echo "ℹ️ PR is still draft; Decision Card can remain draft or pending."
            exit 0
          fi

          if ! grep -Fq "$START" <<< "\$PR_BODY" || ! grep -Fq "$END" <<< "\$PR_BODY"; then
            echo "❌ Missing Decision Card block in PR description."
            echo "Expected markers: $START ... $END"
            exit 1
          fi

          CARD=$(awk '/<!-- muselet:decision-card:start -->/{flag=1;next}/<!-- muselet:decision-card:end -->/{flag=0}flag' <<< "\$PR_BODY")

          if [ -z "\$CARD" ]; then
            echo "❌ Decision Card block is empty."
            exit 1
          fi

          if echo "$CARD" | grep -Eq '^[[:space:]]*\(Draft\)[[:space:]]*$'; then
            echo "❌ Decision Card is still marked as (Draft). Remove (Draft) from the heading to finalize."
            exit 1
          fi

          echo "✅ Decision Card check passed."
`;
}

function detectGhStatus(): "no-gh" | "no-repo" | "no-write" | "write" {
  const auth = spawnSync("gh", ["auth", "status"], { cwd, stdio: "ignore" });
  if (auth.error || auth.status !== 0) {
    return "no-gh";
  }

  const repo = spawnSync("gh", ["repo", "view", "--json", "viewerPermission"], {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (repo.error || repo.status !== 0 || !repo.stdout) {
    return "no-repo";
  }

  try {
    const parsed = JSON.parse(repo.stdout) as { viewerPermission?: string };
    const permission = parsed.viewerPermission;
    if (permission === "WRITE" || permission === "MAINTAIN" || permission === "ADMIN") {
      return "write";
    }
  } catch {
    return "no-repo";
  }

  return "no-write";
}

function run(cmd: string): void {
  log.step(`$ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

const AGENT_INSTRUCTION_CANDIDATES: readonly string[] = [
  "CLAUDE.md",
  "AGENTS.md",
  "copilot-instructions.md",
  ".github/copilot-instructions.md",
  "cursor-instructions.md",
  ".cursorrules",
];

function detectAgentFiles(): string[] {
  const found: string[] = [];
  for (const file of AGENT_INSTRUCTION_CANDIDATES) {
    if (existsSync(path.join(cwd, file))) {
      found.push(file);
    }
  }
  return found;
}

const AGENT_PATCH_BLOCK = `
## Commit context (muselet)

This project uses [muselet](https://github.com/muselet-ai/muselet) to enforce structured commit messages.
Read \`muselet.md\` for the full convention and required context sections.
`;

async function main() {
  console.log(renderBanner());
  intro("muselet init");

  // ── 1. Detect everything ──────────────────────────────────────────

  const detectedPm = detectPackageManager();
  const hasCommitlintConfig =
    existsSync(path.join(cwd, "commitlint.config.js")) ||
    existsSync(path.join(cwd, "commitlint.config.mjs")) ||
    existsSync(path.join(cwd, ".commitlintrc.json"));
  const hasHusky = existsSync(path.join(cwd, ".husky"));
  const hasCommitlintWorkflow = existsSync(path.join(cwd, ".github", "workflows", "muselet.yml"));
  const hasPrDecisionWorkflow = existsSync(path.join(cwd, ".github", "workflows", "muselet-pr-check.yml"));
  const agentFiles = detectAgentFiles();

  // ── 2. Package manager confirmation ───────────────────────────────

  const pmConfirm = await select({
    message: `Package manager detected: ${detectedPm} (${lockFileNames[detectedPm]})\nUse this?`,
    options: [
      { value: "yes" as const, label: `Yes, use ${detectedPm}` },
      { value: "no" as const, label: "No, let me choose" },
    ],
    initialValue: "yes" as const,
  });

  if (isCancel(pmConfirm)) {
    cancel("Setup cancelled.");
    return;
  }

  let pm: PackageManager = detectedPm;

  if (pmConfirm === "no") {
    const pmChoice = await select({
      message: "Which package manager?",
      options: [
        { value: "pnpm" as const, label: "pnpm" },
        { value: "yarn" as const, label: "yarn" },
        { value: "npm" as const, label: "npm" },
      ],
    });

    if (isCancel(pmChoice)) {
      cancel("Setup cancelled.");
      return;
    }

    pm = pmChoice;
  }

  // ── 3. Config table + customise ───────────────────────────────────

  let config: RuleValue = { ...DEFAULT_VALUE };
  note(renderConfigTable(config), "Context rules");

  const customise = await confirm({
    message: "Customise context rules before continuing?",
    initialValue: false,
  });

  if (isCancel(customise)) {
    cancel("Setup cancelled.");
    return;
  }

  if (customise) {
    config = openEditorForConfig(config);
    note(renderConfigTable(config), "Context rules (updated)");
  }

  // ── 4. Per-item confirmations for optional steps ──────────────────

  const enablePrDecisionCardChoice = await select({
    message: "Enable GitHub PR Decision Card workflow?",
    options: [
      { value: true, label: "Yes" },
      { value: false, label: "No" },
    ],
    initialValue: !hasPrDecisionWorkflow,
  });

  if (isCancel(enablePrDecisionCardChoice)) {
    cancel("Setup cancelled.");
    return;
  }

  const enablePrDecisionCard: boolean = enablePrDecisionCardChoice;
  let ghStatus: "no-gh" | "no-write" | "write" = "no-gh";

  if (enablePrDecisionCard) {
    ghStatus = detectGhStatus();

    if (ghStatus === "write") {
      note("✓ gh CLI authenticated with write access. Agents will auto-update PR descriptions.", "GitHub CLI status");
    } else if (ghStatus === "no-write") {
      note(
        "\u26a0\ufe0f gh CLI authenticated but no write access to this repo.\n" +
        "  Agents will generate Decision Card markdown for manual copy/paste.\n\n" +
        "  To fix: ask a repo admin to grant you Write access, or fork the repo.\n" +
        "  Then re-run: npx @muselet/init",
        "GitHub CLI status"
      );
    } else if (ghStatus === "no-repo") {
      note(
        "\u2139\ufe0f No GitHub repository detected in this directory.\n" +
        "  Agents will generate Decision Card markdown for manual copy/paste.\n\n" +
        "  To fix: run muse init from inside a cloned GitHub repo.\n" +
        "  Then re-run: npx @muselet/init",
        "GitHub CLI status"
      );
    } else {
      note(
        "\u2139\ufe0f gh CLI not found or not authenticated.\n" +
        "  Agents will generate Decision Card markdown for manual copy/paste.\n\n" +
        "  To fix:\n" +
        "  1. Install: https://cli.github.com\n" +
        "  2. Authenticate: gh auth login\n" +
        "  3. Re-run: npx @muselet/init",
        "GitHub CLI status"
      );
    }

  } else {
    note("You can enable PR Decision Cards later by re-running muselet init.", "PR Decision Card workflow");
  }

  // Enforce Decision Card check (only if Decision Card is enabled)
  let enforcePrDecisionCard = false;

  if (enablePrDecisionCard) {
    const enforcePrDecisionCardChoice = await select({
      message: "Enforce Decision Card check before merge?\n  Blocks merge if Decision Card is missing or still marked as (Draft).",
      options: [
        { value: true, label: "Yes (recommended)" },
        { value: false, label: "No (guidance only)" },
      ],
      initialValue: true,
    });

    if (isCancel(enforcePrDecisionCardChoice)) {
      cancel("Setup cancelled.");
      return;
    }

    enforcePrDecisionCard = enforcePrDecisionCardChoice;
  }

  const installCommitlintWorkflowChoice = await select({
    message: "Install commit message linting in CI?",
    options: [
      { value: true, label: "Yes" },
      { value: false, label: "No" },
    ],
    initialValue: !hasCommitlintWorkflow,
  });

  if (isCancel(installCommitlintWorkflowChoice)) {
    cancel("Setup cancelled.");
    return;
  }

  const installCommitlintWorkflow: boolean = installCommitlintWorkflowChoice;

  // Agent instruction files
  const agentFilesToPatch: string[] = [];

  for (const file of agentFiles) {
    const patch = await select({
      message: `Add a muselet.md reference to ${file}?`,
      options: [
        { value: true, label: "Yes" },
        { value: false, label: "No" },
      ],
      initialValue: true,
    });

    if (isCancel(patch)) {
      cancel("Setup cancelled.");
      return;
    }

    if (patch) {
      agentFilesToPatch.push(file);
    }
  }

  // ── 5. Show the plan ──────────────────────────────────────────────

  const deps = ["@commitlint/cli", "@commitlint/config-conventional", "@muselet/commitlint-plugin"];
  const plan: string[] = [];

  plan.push(`Install ${deps.join(", ")}`);

  if (hasHusky) {
    plan.push("✓ Husky installed — add commit-msg hook");
  } else {
    plan.push("Install husky + commit-msg hook");
  }

  if (hasCommitlintConfig) {
    plan.push("✓ Commitlint config exists (will ask to overwrite)");
  } else {
    plan.push("Create commitlint.config.mjs");
  }

  if (installCommitlintWorkflow) {
    if (hasCommitlintWorkflow) {
      plan.push("✓ .github/workflows/muselet.yml exists (will overwrite)");
    } else {
      plan.push("Create .github/workflows/muselet.yml");
    }
  }

  if (enablePrDecisionCard) {
    plan.push("Create .muselet/templates/decision-card.md");
    plan.push(`PR Decision Card mode: ${ghStatus === "write" ? "auto-update via gh pr edit" : "manual copy/paste"}`);
    if (enforcePrDecisionCard) {
      if (hasPrDecisionWorkflow) {
        plan.push("✓ .github/workflows/muselet-pr-check.yml exists (will overwrite)");
      } else {
        plan.push("Create .github/workflows/muselet-pr-check.yml");
      }
    }
  }

  plan.push("Create muselet.md");

  for (const file of agentFilesToPatch) {
    plan.push(`Patch ${file} with muselet.md reference`);
  }

  note(plan.map(s => `• ${s}`).join("\n"), "Setup recap");

  // ── 6. Final confirmation ─────────────────────────────────────────

  const proceed = await confirm({
    message: "Proceed with setup?",
    initialValue: true,
  });

  if (isCancel(proceed) || !proceed) {
    cancel("Setup cancelled.");
    return;
  }

  // ── 7. Execute ────────────────────────────────────────────────────

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
      // Clear the default pre-commit hook (runs `npm test` which fails on fresh projects)
      const defaultPreCommit = path.join(cwd, ".husky", "pre-commit");
      if (existsSync(defaultPreCommit)) {
        await fs.writeFile(defaultPreCommit, "", { mode: 0o755 });
      }
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
      await fs.writeFile(path.join(cwd, "commitlint.config.mjs"), commitlintConfig(config));
      s.stop("✅ Commitlint config created");
    } else {
      const overwrite = await confirm({
        message: "Overwrite existing commitlint config?",
        initialValue: false,
      });

      if (isCancel(overwrite)) {
        cancel("Setup cancelled.");
        return;
      }

      if (overwrite) {
        await fs.writeFile(path.join(cwd, "commitlint.config.mjs"), commitlintConfig(config));
        log.success("✅ Commitlint config overwritten");
      } else {
        log.info("⊘ Skipped commitlint config");
      }
    }

    // 5. Commitlint CI workflow
    if (installCommitlintWorkflow) {
      s.start("Creating commitlint CI workflow...");
      const workflowDir = path.join(cwd, ".github", "workflows");
      await fs.mkdir(workflowDir, { recursive: true });
      await fs.writeFile(path.join(workflowDir, "muselet.yml"), generateWorkflow(pm));
      s.stop("✅ Commitlint CI workflow created");
    }

    // 6. PR Decision Card workflow + template
    if (enablePrDecisionCard) {
      // Template always generated when Decision Card is enabled
      s.start("Creating PR Decision Card template...");
      const decisionCardTemplateDir = path.join(cwd, ".muselet", "templates");
      await fs.mkdir(decisionCardTemplateDir, { recursive: true });
      await fs.writeFile(path.join(decisionCardTemplateDir, "decision-card.md"), `<!-- muselet:decision-card:start -->
### Decision
(Draft)

### Why now

### Approach

### Alternatives considered

### Tradeoffs / Risks
<!-- muselet:decision-card:end -->
`);
      s.stop("✅ PR Decision Card template created");

      // Check workflow only if enforcement is enabled
      if (enforcePrDecisionCard) {
        s.start("Creating PR Decision Card check workflow...");
        const workflowDir = path.join(cwd, ".github", "workflows");
        await fs.mkdir(workflowDir, { recursive: true });
        await fs.writeFile(path.join(workflowDir, "muselet-pr-check.yml"), generatePrDecisionWorkflow());
        s.stop("✅ PR Decision Card check workflow created");
      }
    }

    // 7. Agent instructions (muselet.md)
    s.start("Creating agent instructions...");
    await fs.writeFile(
      path.join(cwd, "muselet.md"),
      agentInstructions(ghStatus === "write" ? "auto" : "manual"),
    );
    s.stop("✅ Agent instructions created");

    // 8. Patch agent instruction files
    for (const file of agentFilesToPatch) {
      const filePath = path.join(cwd, file);
      s.start(`Patching ${file}...`);
      await fs.appendFile(filePath, AGENT_PATCH_BLOCK);
      s.stop(`✅ Patched ${file}`);
    }

    // Success!
    log.success("🎉 Setup complete!");

    note(
      "Try it out:\n" +
      '• git commit -m "fix: something"\n' +
      '  → ✖ missing Why\n' +
      '\n' +
      '• git commit (with editor) and write:\n' +
      '  fix: something\n' +
      '\n' +
      '  ### Why\n' +
      '  <your reason here>\n' +
      '  → ✔ passes',
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
