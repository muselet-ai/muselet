# muselet

**Commitlint plugin that lints the *why*, not just the *what*.**

Most commit linters check format. Muselet checks that your commits actually explain themselves — why you made the change, what alternatives you considered, what trade-offs you accepted.

## Quick Start

```bash
npx @muselet/init
```

This sets up commitlint with the muselet plugin, a CI workflow, and agent instructions for AI-assisted commits.

## What It Catches

❌ **Before muselet:**
```
fix: resolve null pointer in user lookup
```

✅ **After muselet:**
```
fix: resolve null pointer in user lookup

Why:
Users with deleted accounts could trigger a null pointer when
the lookup cache returned a stale entry. This caused 500 errors
on the /profile endpoint (~12/day in production).
```

## Per-Type Rules

| Type | Required Sections |
|------|------------------|
| `fix` | Why |
| `feat` | Why |
| `refactor` | Why, Alternatives |
| `perf` | Why, Trade-offs |

Types not listed above (e.g. `docs`, `chore`, `ci`) have no context requirements.

## Packages

| Package | Description |
|---------|-------------|
| [`@muselet/commitlint-plugin`](./packages/commitlint-plugin) | The commitlint plugin with context-by-type rule |
| [`@muselet/init`](./packages/init) | CLI to scaffold muselet in your repo |
| [`@muselet/action`](./packages/action) | GitHub Action for CI (coming soon) |

## License

MIT
