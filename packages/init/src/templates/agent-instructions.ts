export const agentInstructions = `# Commit Message Convention (muselet)

When writing commit messages, include context based on the commit type:

## Required Sections by Type

### fix
- **Why:** Explain what was broken and what impact it had

### feat
- **Why:** Explain the motivation — what user need or problem does this address?

### refactor
- **Why:** Explain why the code needed restructuring
- **Alternatives:** What other approaches did you consider?

### perf
- **Why:** Explain the performance issue (with numbers if possible)
- **Trade-offs:** What did you sacrifice for this gain?

## Example

\\\`\\\`\\\`
fix: resolve null pointer in user lookup

Why:
Users with deleted accounts could trigger a null pointer when
the lookup cache returned a stale entry. This caused 500 errors
on the /profile endpoint (~12/day in production).
\\\`\\\`\\\`

## Types Without Context Requirements

\\\`docs\\\`, \\\`chore\\\`, \\\`ci\\\`, \\\`style\\\`, \\\`test\\\` — no additional context required.

## Config

Our \\\`commitlint.config.mjs\\\` extends \\\`@commitlint/config-conventional\\\`, which enforces
standard rules like \\\`body-max-line-length\\\` (100 chars). If your context sections need
longer lines, you can override it:

\\\`\\\`\\\`js
rules: {
  "body-max-line-length": [0], // disable
}
\\\`\\\`\\\`
`;
