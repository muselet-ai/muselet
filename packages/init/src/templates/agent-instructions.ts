export const agentInstructions = `# Commit Message Convention (muselet)

Think of each commit as a **replayable migration** — not just of code, but of decisions.
A future agent should be able to read your commit messages (without diffs) and reproduce
the intent in a different framework or language.

## Context Tiers — Start High

You have the reasoning in your context window. **Write it down.** Default to the highest
tier that applies and only scale down when there's genuinely nothing more to say.

- **Tier 3** (default): Why + Approach + Alternatives/Tradeoffs — the full decision tree
- **Tier 2**: Why + Approach — deliberate choice, but alternatives weren't seriously considered
- **Tier 1**: Why only — motivation isn't obvious, but approach is straightforward
- **Tier 0**: Subject line says it all — truly mechanical changes (formatting, version bumps)

## Sections by Type

Use markdown headers (\\\`### Section\\\`) in the commit body. See examples below.

### fix
- **Required:** Why (what was broken and why)
- **Recommended:** Cause (root cause), Approach (how you fixed it)
- **Optional:** Alternatives, Refs

### feat
- **Required:** Why (user need or problem)
- **Recommended:** Approach (design/strategy), Alternatives (what you considered)
- **Optional:** Tradeoffs, Migration, Breaking, Refs

### refactor
- **Required:** Why (structural problem), Approach (new design)
- **Recommended:** Alternatives (other designs considered), Invariants (what must stay true)
- **Optional:** Tradeoffs, Migration

### perf
- **Required:** Why (performance issue), Metrics (before/after numbers)
- **Recommended:** Approach, Tradeoffs
- **Optional:** Alternatives, Refs

### docs, test, chore, ci, build
- **Recommended:** Why (if a decision was made)
- Body can be skipped for truly mechanical changes

### style
- No body needed. The diff is the message.

## Example (Tier 3)

\\\`\\\`\\\`
fix: resolve race condition in WebSocket reconnect

### Why
Users on flaky connections saw duplicate messages because the reconnect
handler didn't debounce. The old approach used setTimeout which could
fire after a new connection was already established.

### Cause
No deduplication between old and new connection message handlers during
the 3s reconnect window.

### Approach
Added a connection-id check — message handlers ignore events from
connections that aren't the current active one.
\\\`\\\`\\\`

## Example (Tier 1)

\\\`\\\`\\\`
feat(cli): add --json flag for machine-readable output

### Why
CI pipelines need to parse muselet output programmatically.
Shell-parsing human-readable tables is fragile.
\\\`\\\`\\\`

## The Replay Test

Before committing, ask: *Could a developer reading only this message (no diff)
reproduce the decision in a different codebase?* If not, add more context.

## Config

This project's \\\`commitlint.config.mjs\\\` extends \\\`@commitlint/config-conventional\\\`,
which enforces standard rules like \\\`body-max-line-length\\\` (100 chars). If your context
sections need longer lines, you can override it:

\\\`\\\`\\\`js
rules: {
  "body-max-line-length": [0], // disable
}
\\\`\\\`\\\`
`;
