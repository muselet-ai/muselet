# Muselet — Context Sections Specification

> A commit message should contain enough context that a coding agent could "replay" the commit in a different framework or language. The diff shows WHAT changed; the message captures WHY and the DECISIONS that led there.

---

## The Core Problem

When you read a diff, you see *what* changed. You often don't see:

- **Why** it changed (the motivation that doesn't exist in code)
- **What was rejected** (the paths not taken, which prevent an agent from re-exploring dead ends)
- **What constraints** shaped the solution (performance targets, backwards compatibility, API contracts)
- **What must remain true** (invariants that aren't enforced by types or tests)
- **What was measured** (the numbers that justified the approach)

Muselet defines structured **context sections** that capture this lost information. The sections scale with commit complexity — a typo fix stays a one-liner; an architecture change gets the context it deserves.

---

## Section Vocabulary

Muselet recognizes 11 context sections. No commit uses all of them. Most use 1–3.

| Section | Purpose | Typical types |
|---------|---------|---------------|
| **Why** | Motivation. The problem or need that triggered this change. | all |
| **Cause** | Root cause analysis. What was actually wrong. | fix |
| **Approach** | Solution strategy. How it works at a level above the diff. | feat, fix, refactor, perf |
| **Alternatives** | What was considered and why it was rejected. | feat, refactor, perf |
| **Tradeoffs** | What was sacrificed or accepted as a consequence. | perf, refactor, feat |
| **Metrics** | Before/after measurements. Numbers, not vibes. | perf |
| **Invariants** | What must remain true after this change. Contracts the diff can't show. | refactor |
| **Migration** | Steps for consumers to adapt to this change. | feat (breaking), refactor |
| **Covers** | What behavior or scenarios the tests validate. | test |
| **Breaking** | Breaking change description. (Conventional Commits standard.) | any |
| **Refs** | Issue/PR/doc references. (Git trailer convention.) | any |

### Format

Sections appear in the commit body as markdown headers (`### Section`). Content follows on subsequent lines until the next section or end of message.

```
### Why
Summary of motivation.
Additional detail that expands on the summary.
Can span multiple lines.

### Approach
Starts a new section.
```

This format is unambiguous (no collision with prose or git trailers), trivially parseable (`/^###\s+/`), renders well in GitHub's commit detail view, and matches how LLMs naturally produce structured output.

---

## Summary: Required, Recommended & Optional Sections by Type

**Required** = linter enforces. **Recommended** = include if the info is in your context window (agents should almost always include these). **Optional** = add when relevant.

| Type | Required | Recommended | Optional | Can skip body entirely? |
|------|----------|-------------|----------|------------------------|
| **fix** | Why | Cause, Approach | Alternatives, Refs | Rarely¹ |
| **feat** | Why | Approach, Alternatives | Tradeoffs, Migration, Breaking, Refs | No |
| **refactor** | Why, Approach | Alternatives, Invariants | Tradeoffs, Migration | No |
| **perf** | Why, Metrics | Approach, Tradeoffs | Alternatives, Refs | No |
| **docs** | — | Why | Refs | Yes, if truly trivial |
| **test** | — | Why, Covers | Refs | Yes, if subject is clear |
| **chore** | — | Why | Breaking, Refs | Yes, if mechanical |
| **ci** | — | Why | Approach, Refs | Yes, if subject is clear |
| **style** | — | — | — | **Always** |
| **build** | — | Why | Breaking, Approach, Refs | Yes, if mechanical |

¹ *Self-evident fixes* (typos, off-by-one where the subject fully describes the bug) can skip the body, but this should be rare. The rule of thumb: if a junior developer would ask "but why was it broken?", you need a body. **If an agent has the context, it should write the body.**

---

## Context Tiers

Muselet uses **context tiers** as a mental model. The key principle: **start at the highest tier the context allows, and only scale down when the information genuinely isn't available.** If the reasoning is in your head (or in the agent's context window), it belongs in the commit.

### Tier 3 — Full Context 
Subject + Why + Approach + Alternatives/Tradeoffs. The decision tree is captured.
> Architecture changes, complex refactors, performance optimizations with tradeoffs, breaking changes.
> **This is the starting point.** An agent with full context should default here. Scale down only when information is genuinely not in context window.

### Tier 2 — Standard Context
Subject + Why + Approach. You made a deliberate choice but alternatives weren't seriously considered.
> Most features, fixes with non-obvious causes, performance work.

### Tier 1 — Minimal Context
Subject + Why (1–2 sentences). The motivation isn't obvious from the code but the approach is straightforward.
> Simple fixes, docs updates, test additions, chore tasks.

### Tier 0 — Self-Evident
Subject line says everything. Body adds nothing.
> `style: run prettier on src/`
> `chore: bump typescript to 5.7`
> `docs: fix broken link in README`
> Reserve this for truly mechanical changes where no decision was made.

**The heuristic**: if the reasoning exists anywhere — your head, the PR discussion, the agent's context window — it belongs in the commit message. PR descriptions disappear when repositories move; commit messages travel with the code forever. **Don't discard context you already have.**

---

## Golden Examples by Type

### `fix` — Bug Fixes

**What's lost in a fix diff**: the symptom users experienced, the root cause (which may be far from the changed lines), and why this fix is correct rather than a band-aid.

#### Trivial fix (Tier 0)

```
fix(ui): correct tooltip z-index on mobile
```

No body needed. The subject fully describes what was wrong and what changed.

#### Standard fix (Tier 2)

```
fix(auth): prevent token refresh race during concurrent requests

### Why
When multiple API calls triggered simultaneously after token expiry,
each spawned its own refresh request. The second refresh invalidated the
first's new token, causing a cascade of 401s and eventual logout.

### Cause
The refresh lock was per-instance rather than per-session. Each
Axios interceptor got its own mutex, so concurrent interceptors didn't
see each other's in-flight refresh.

### Approach
Moved the refresh promise to a module-level singleton. The first
caller to detect expiry initiates the refresh; all others await the same
promise. The promise is cleared on resolution.

Refs: #342, #351
```

#### Complex fix (Tier 3)

```
fix(db): resolve deadlock in concurrent order placement

### Why
Under load (>50 concurrent checkouts), the orders table would
deadlock ~2% of the time, causing timeouts and lost sales. Sentry
reported 340 occurrences in the last 7 days.

### Cause
Two transactions acquired row locks in opposite order:
1. place_order: locks inventory row → locks order row
2. update_stock: locks order row → locks inventory row
Classic ABBA deadlock. Only manifests under concurrency because single
transactions complete before the other starts.

### Approach
Enforced a global lock ordering: always acquire inventory lock before
order lock. Restructured update_stock to read order data in a separate
read-only transaction, then acquire inventory lock first in the write
transaction.

### Alternatives
Considered advisory locks (pg_advisory_xact_lock) but they add
per-transaction overhead even when there's no contention, and they're
invisible to standard monitoring. Also considered retry-on-deadlock,
but that's a band-aid — the ordering fix is correct by construction.

### Tradeoffs
update_stock now uses two transactions instead of one, adding ~2ms
latency in the non-contended case. Acceptable given deadlocks caused
multi-second timeouts.

Refs: INCIDENT-2024-01-15, #892
```

---

### `feat` — New Features

**What's lost in a feat diff**: why the feature exists, what user need it serves, and the design decisions that shaped the implementation.

#### Small feature (Tier 1)

```
feat(cli): add --json flag for machine-readable output

### Why
CI pipelines need to parse Muselet output programmatically.
Shell-parsing human-readable tables is fragile and breaks on format
changes.
```

#### Standard feature (Tier 2)

```
feat(rules): add max-body-line-length rule with auto-wrap

### Why
Many teams enforce line length limits in commit messages for
readability in `git log`. Existing tools only reject; Muselet can
guide authors toward compliance during writing.

### Approach
The rule measures each body line against the configured max
(default: 100). In --fix mode, it re-wraps paragraphs at word
boundaries while preserving intentional line breaks (blank lines,
list items, code fences). Section headers are never wrapped.

### Alternatives
Considered hard-wrapping only (no --fix). But the whole point of
Muselet is to reduce friction — rejecting without helping trains
people to hate the tool.

Refs: #127
```

#### Complex feature (Tier 3)

```
feat(core): add plugin system for custom context sections

### Why
Teams have domain-specific context that Muselet can't anticipate.
A game studio needs "Platform:" (PS5/Xbox/PC). A fintech needs
"Compliance:" (SOX/PCI references). Hardcoding these is impossible;
a plugin system makes Muselet extensible without bloating the core.

### Approach
Plugins export a section definition (name, description, validation
function, required-for types) and register via Muselet.config.js.
The core parser treats plugin sections identically to built-in ones.
Plugins can mark sections as required for specific commit types,
adding to (never removing from) the built-in requirements.

Plugin interface:
  - name: string (section header)
  - validate(value: string): ValidationResult
  - requiredFor?: CommitType[]
  - description: string (shown in error messages)

### Alternatives
Considered a regex-only approach (let users define patterns). Too
limited — you can validate format but not semantics. Also considered
JSON Schema for section definitions, but it's overkill for string
validation and hostile to onboarding.

### Tradeoffs
Plugin sections are validated at config load time, not at parse time.
A misconfigured plugin fails fast on `Muselet lint` but won't be
caught by editor integrations until the user saves. Acceptable because
editor plugins will add config validation in a follow-up.

### Migration
Existing configs are unaffected. Plugin system is additive. Teams
using custom sections via freeform body text can now formalize them
without changing their existing messages.

Breaking: None.
Refs: #89, RFC-0003
```

---

### `refactor` — Code Restructuring

**What's lost in a refactor diff**: the structural problem being solved, why the new structure is better, and what invariants are preserved. This is the type where context is MOST critical — a refactor diff shows *everything* changing and *nothing* about why.

#### Small refactor (Tier 2)

```
refactor(parser): extract section parsing into SectionParser class

### Why
The parse() function was 280 lines with section detection,
validation, and normalization interleaved. Adding new sections
required modifying three different switch blocks.

### Approach
Extracted a SectionParser class that takes section definitions and
returns parsed Section objects. The main parser now delegates to
SectionParser and only handles commit structure (subject/body/footer
separation).
```

#### Complex refactor (Tier 3)

```
refactor(core): replace inheritance hierarchy with composition for rules

### Why
The rule hierarchy (Rule → BodyRule → SectionRule → TypedSectionRule)
hit 4 levels deep. Adding a rule that validates across sections (e.g.,
"if Metrics is present, Approach must explain the measurement method")
required multiple inheritance or fragile mixins. The hierarchy encoded
assumptions about rule granularity that no longer hold.

### Approach
Rules are now plain objects conforming to the Rule interface:
{ name, meta, validate(commit) → Diagnostic[] }. Shared behavior lives
in composable utility functions (e.g., requireSection(), validateLength())
that rules call explicitly. No base classes.

### Alternatives
Considered mixins (too implicit, hard to trace behavior). Considered a
middleware/chain pattern (over-engineered for stateless validation).
Composition with utility functions is the simplest thing that works.

### Invariants
All 47 existing rules produce identical diagnostics for the test corpus
(snapshot tests). Rule execution order is unchanged. External rule API
(name, meta, validate signature) is unchanged, so third-party rules
are unaffected.

### Tradeoffs
Utility functions mean some rules have similar-looking boilerplate.
Accepted because explicit is better than implicit when debugging rule
behavior.
```

#### Architecture refactor (Tier 3)

```
refactor(core): migrate from synchronous to async rule pipeline

### Why
Plugin rules may need async operations (HTTP calls to issue trackers
for Refs validation, git operations for cross-commit analysis). The
synchronous pipeline forced plugin authors to use synchronous HTTP or
spawn child processes, both terrible options.

### Approach
The rule pipeline is now fully async. Rules return
Promise<Diagnostic[]>. Built-in rules remain synchronous internally
but are wrapped in async at the pipeline level. Rules execute
concurrently by default; rules can declare dependencies to enforce
ordering via `meta.after: string[]`.

### Alternatives
Considered a two-phase pipeline (sync built-in, then async plugins).
Rejected because it creates a first-class/second-class distinction
and prevents built-in rules from ever going async. Considered worker
threads for isolation. Deferred — the async pipeline is prerequisite
infrastructure; worker isolation is a future concern.

### Invariants
Diagnostic output order is deterministic (sorted by rule name, then
line number) regardless of async completion order. Snapshot tests
validate this. Rule execution is stateless — no rule can observe
another's side effects.

### Migration
Rule authors change `validate(commit): Diagnostic[]` to
`validate(commit): Promise<Diagnostic[]>` or `async validate(commit)`.
Synchronous rules continue to work (return value is auto-wrapped in
Promise.resolve). The config format is unchanged.

Refs: #89 (plugin system), #134 (async request)
```

---

### `perf` — Performance Improvements

**What's lost in a perf diff**: the baseline measurements, the target, and the tradeoffs. Without these, an agent replaying the change can't verify it worked or understand what was sacrificed.

#### Simple optimization (Tier 2)

```
perf(parser): cache regex compilation for section headers

### Why
Profiling showed regex compilation consuming 34% of parse time
when linting large repositories (>1000 commits in a batch).

### Metrics
Batch lint of 1000 commits: 4.2s → 1.1s (3.8x faster).
Single commit lint: no measurable change (~2ms either way).

### Approach
Section header regexes are compiled once at module load and reused
across parse calls. Previously each parse() call compiled 11 regexes.
```

#### Complex optimization (Tier 3)

```
perf(core): parallelize rule execution with worker pool

### Why
Linting a monorepo's full history (12,000 commits) took 45 minutes.
Profile showed rule execution is CPU-bound and single-threaded, with
each commit spending ~180ms in validation.

### Metrics
12,000 commits: 45min → 8min (5.6x)
100 commits: 18s → 6s (3x)
Single commit: 180ms → 195ms (1.08x slower — pool overhead)

### Approach
Rules execute in a worker_threads pool (default: CPU count - 1).
Each worker receives a serialized commit + rule config, runs
validation, and returns diagnostics. The main thread handles I/O,
output, and diagnostic aggregation.

### Alternatives
Considered process-based parallelism (child_process). Higher memory
overhead (~50MB per worker vs ~8MB for threads) and serialization
cost for large configs. Considered WASM-compiled rules for raw speed,
but the bottleneck is rule count × commit count, not per-rule
execution time.

### Tradeoffs
Single-commit latency increases by ~15ms due to pool initialization.
The pool is lazily created on first multi-commit lint, so interactive
single-commit use is unaffected. Worker count is configurable via
--workers flag.

Refs: #201
```

---

### `docs` — Documentation Changes

**What's lost in a docs diff**: usually nothing. Documentation diffs are among the most self-explanatory. Context is only needed when the *reason* for the documentation change matters.

#### Trivial (Tier 0)

```
docs: fix typo in contributing guide
```

#### Structural (Tier 1)

```
docs: reorganize configuration reference by use case

### Why
Users reported finding the right config option was hard because
the reference was organized alphabetically. Grouped by use case
(getting started → customizing rules → writing plugins) matches how
people actually look for information.
```

#### Significant (Tier 2)

```
docs: add architecture decision records for core design

### Why
New contributors repeatedly ask "why is X designed this way?" in
issues. The answers exist in old PR discussions but aren't
discoverable. ADRs capture these decisions where contributors
actually look: in the repo.

### Approach
Added docs/adr/ with records for the 6 most-asked-about decisions.
Each follows the MADR template (context, decision, consequences).
Linked from CONTRIBUTING.md.
```

---

### `test` — Adding/Updating Tests

**What's lost in a test diff**: usually clear from the test code itself. Context matters when the test covers a non-obvious edge case or regression.

#### Trivial (Tier 0)

```
test(parser): add missing tests for empty body handling
```

#### Regression test (Tier 1)

```
test(rules): add regression test for unicode section headers

### Why
A user reported that section headers containing CJK characters were
silently dropped. The parser's section regex assumed ASCII word
characters only.

### Covers
Section headers with CJK, Cyrillic, and Arabic characters.
Mixed-script headers (e.g., "### 原因" followed by root cause).
Headers with emoji.

Refs: #445
```

#### Test infrastructure (Tier 2)

```
test: add snapshot testing for rule diagnostics

### Why
Rule output assertions were hand-written string comparisons that
broke on any formatting change. Adding new rules required writing
30+ lines of assertion boilerplate per rule.

### Approach
Each rule has a fixture directory with input commits and expected
diagnostic snapshots. Test runner diffs actual output against
snapshots. `--update-snapshots` flag regenerates them.

### Covers
All 47 built-in rules migrated to snapshot format. Legacy
hand-written assertions remain for edge cases that need custom
matchers.
```

---

### `chore` — Maintenance, Deps, Tooling

**What's lost in a chore diff**: usually nothing important. The exception is dependency updates with breaking changes.

#### Trivial (Tier 0)

```
chore: bump eslint to 9.5.0
```

```
chore: update .gitignore for new IDE
```

#### Notable (Tier 1)

```
chore: migrate from jest to vitest

### Why
Jest's ESM support is still experimental and required hacks
(__mocks__ not working, dynamic imports needing babel transform).
Vitest handles ESM natively and runs 3x faster on our test suite.

### Breaking
Test files still use describe/it/expect (compatible). jest.fn()
replaced with vi.fn(). Custom jest matchers in test/matchers.ts
need vitest equivalents.
```

---

### `ci` — CI/CD Changes

**What's lost in a CI diff**: the intent behind pipeline changes and what behavior is affected.

#### Trivial (Tier 0)

```
ci: pin node version to 20.11 in GitHub Actions
```

#### Standard (Tier 1)

```
ci: add automated release workflow

### Why
Releases were manual (run script locally, hope npm credentials
work, tag, push). Missed steps caused 3 broken releases in the last
6 months.

### Approach
GitHub Actions workflow triggered on version tags (v*). Runs full
test suite, builds, publishes to npm, creates GitHub release with
auto-generated changelog. Requires NPM_TOKEN secret.
```

---

### `style` — Formatting, Whitespace

**What's lost in a style diff**: nothing. By definition, style changes have no semantic content. Requiring context would be pure noise.

```
style: apply prettier formatting to src/
```

```
style(parser): normalize import ordering
```

**Muselet never requires a body for `style` commits.** The diff is the message.

---

### `build` — Build System, Dependencies

**What's lost in a build diff**: the intent behind build configuration changes, which can be opaque (webpack/rollup/esbuild configs are notoriously hard to read).

#### Trivial (Tier 0)

```
build: update tsconfig target to ES2022
```

#### Standard (Tier 1)

```
build: switch bundler from rollup to esbuild

### Why
Rollup builds took 12s and required 6 plugins for TypeScript, node
resolution, commonjs interop, etc. esbuild handles all of these
natively in ~400ms.

### Tradeoffs
Lose rollup's tree-shaking granularity. Bundle size increased from
42KB to 48KB (14%). Acceptable for a CLI tool where startup time
matters more than download size.
```

#### Breaking build change (Tier 2)

```
build: drop CommonJS output, ship ESM only

### Why
Dual CJS/ESM packaging caused constant issues — conditional exports
misresolved by older bundlers, and maintaining two module graphs
doubled build complexity. The npm ecosystem has crossed the tipping
point; our telemetry shows 94% of installs are on Node 18+ (native
ESM).

### Approach
Removed CJS build step. Package.json exports only ESM entry points.
"type": "module" is set.

### Migration
CJS consumers must use dynamic import() or migrate to ESM. Added a
clear error message if require() is attempted, pointing to the
migration guide.

### Breaking
Drops support for Node <18 and CJS require().

Refs: #567, nodejs/node#12345
```

---

## Length Guidelines

### The Scaling Principle

Context depth should scale with **decision density**, not diff size. A 500-line auto-generated migration might be Tier 0. A 3-line fix that took hours to diagnose is Tier 3.

### Rules of Thumb

**For AI agents**: start at Tier 3. You have the context — write it down. Only scale down when information is genuinely not in your context. 

**For humans**: start at the tier that matches what you know.

| Signal | Suggested tier |
|--------|---------------|
| Agent has full context in window | **Tier 3** (default for agents) |
| Change breaks existing behavior | Tier 3 (add Migration + Breaking) |
| Change has non-obvious consequences | Tier 3 (add Tradeoffs/Invariants) |
| You considered alternatives | Tier 2 (Why + Approach) |
| You'd explain "why" to a teammate | Tier 1 (Why, 1–3 sentences) |
| Change is mechanical/automated | Tier 0 (no body) |
| Change is obvious from subject line | Tier 0 (no body) |

### Line Counts (Approximate)

- **Tier 0**: Subject line only (≤72 chars)
- **Tier 1**: Subject + 2–5 body lines
- **Tier 2**: Subject + 5–15 body lines
- **Tier 3**: Subject + 15–40 body lines

If you're past 40 lines, consider whether the commit should be split.

---

## Types Where No Context Is Needed

### `style` — Never Needs Context

Style changes are definitionally semantic-free. The diff shows exactly what changed (formatting, whitespace, import order). There is no "why" — the answer is always "to match the style guide." Requiring context would train developers to write meaningless filler, which degrades signal quality across all commit types.

**Muselet enforces: no body required, no body validated.**

### `chore` / `build` / `ci` / `docs` — Conditionally Context-Free

These types have a **self-evident threshold**: when the subject line fully captures the change, a body is noise. Muselet does not require a body for these types but validates sections if a body is present.

Examples of self-evident commits:
- `chore: bump lodash to 4.17.21`
- `build: add node 22 to engine range`
- `ci: cache npm dependencies`
- `docs: add MIT license file`

---

## For Linter Implementors

### Validation Rules

1. **Subject line**: always required, ≤72 chars, conventional commit format
2. **Body presence**: required for `feat`, `refactor`, `perf`. Optional for all others.
3. **Section syntax**: if a body contains `### Word` at line start, it's treated as a section header
4. **Required sections**: validated per type (see summary table above)
5. **Unknown sections**: warning (not error) — allows gradual adoption and team-specific sections
6. **Section order**: not enforced — teams can order by preference
7. **Section content**: must be non-empty if the header is present

### Exemptions

- Merge commits and reverts are exempt
- Plugin-defined sections extend (never override) built-in requirements

---

## Commits as Architecture Decision Records

[Architecture Decision Records](https://adr.github.io/) (ADRs) capture the *why* behind project-level decisions. Traditionally they live in a `docs/adr/` folder as standalone markdown files. But with muselet's structured sections, the commit message itself can serve as the ADR.

Think about it: a Tier 3 commit already captures Why, Approach, Alternatives, and Tradeoffs. That's the same structure as an ADR — context, decision, consequences. The difference is that the record lives *at the point of change* in git history, not in a separate file that drifts out of sync.

```
feat(db): migrate from DynamoDB to PostgreSQL

### Why
DynamoDB's single-table design made cross-entity queries impossible
without maintaining multiple GSIs. Monthly GSI costs exceeded the
equivalent RDS instance. Query patterns evolved toward relational
joins that DynamoDB can't express efficiently.

### Approach
PostgreSQL on RDS with pgvector for embedding search. Prisma as the
query layer (type-safe, good migration story). Data migration via
streaming DynamoDB → Kinesis → PostgreSQL pipeline over 72h.

### Alternatives
Considered CockroachDB (better horizontal scaling but higher ops
burden and no managed pgvector equivalent). Considered keeping
DynamoDB + OpenSearch for queries (adds a second data store to
keep in sync).

### Tradeoffs
Lose DynamoDB's infinite horizontal scaling. Acceptable — current
traffic fits a db.r6g.xlarge with headroom. Vertical scaling buys
us 2+ years before we need to revisit.
```

This commit *is* the ADR. It's discoverable via `git log --grep`, it's attached to the actual code change, and it can't drift because it's immutable.

For decisions that span multiple commits, the first commit captures the full decision context (Tier 3) and subsequent commits reference it: `Refs: <first-commit-hash>` or the tracking issue.

Traditional ADR files still make sense for decisions that don't correspond to a single code change (e.g., "we're adopting TypeScript across all services"). But for most architectural decisions, the commit that implements the decision is the natural — and most durable — place to record it.

---

## The Replay Test

When writing a commit message, apply this mental test:

> *Could a competent developer (human or AI), reading only this message (no diff), reproduce the intent of this change in a different codebase?*

They don't need to reproduce the exact code — they need to reproduce the **decision**. If your message passes this test, it has enough context.

For `style` and trivial `chore` commits, the answer is trivially "yes" — there's no decision to capture. For a complex `refactor`, the answer requires explaining the structural problem, the new design, and why that design was chosen over alternatives.

The sections exist to make that explanation structured and consistent. Not bureaucratic — *navigable*.
