import { describe, it, expect } from "vitest";
import {
  contextByType,
  contextRecommended,
  type Commit,
  type RuleValue,
} from "./context-by-type.js";

const commit = (overrides: Partial<Commit> = {}): Commit => ({
  type: "fix",
  body: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// context-by-type (required sections)
// ---------------------------------------------------------------------------
describe("context-by-type", () => {
  it("passes when required sections are present", () => {
    const [valid, msg] = contextByType(commit({ body: "### Why\nreasons" }));
    expect(valid).toBe(true);
    expect(msg).toBe("");
  });

  it("passes for refactor with all required sections", () => {
    const [valid] = contextByType(
      commit({
        type: "refactor",
        body: "### Why\nreasons\n### Approach\ndetails",
      }),
    );
    expect(valid).toBe(true);
  });

  it("fails with correct message when sections missing", () => {
    const [valid, msg] = contextByType(commit({ body: "just a body" }));
    expect(valid).toBe(false);
    expect(msg).toBe("fix commits should include: Why");
  });

  it("fails listing all missing sections", () => {
    const [valid, msg] = contextByType(
      commit({ type: "refactor", body: "no context here" }),
    );
    expect(valid).toBe(false);
    expect(msg).toBe("refactor commits should include: Why, Approach");
  });

  it("skips types not in config", () => {
    const [valid, msg] = contextByType(commit({ type: "docs" }));
    expect(valid).toBe(true);
    expect(msg).toBe("");
  });

  it("skips when type is null", () => {
    const [valid] = contextByType(commit({ type: null }));
    expect(valid).toBe(true);
  });

  it("handles missing body", () => {
    const [valid, msg] = contextByType(commit({ body: null }));
    expect(valid).toBe(false);
    expect(msg).toBe("fix commits should include: Why");
  });

  // backward compat: string[] config
  it("handles string[] config (backward compat)", () => {
    const custom: RuleValue = { docs: ["Context"] };
    const [valid, msg] = contextByType(
      commit({ type: "docs", body: "no context" }),
      "always",
      custom,
    );
    expect(valid).toBe(false);
    expect(msg).toBe("docs commits should include: Context");
  });

  it("passes string[] config when section present", () => {
    const custom: RuleValue = { docs: ["Context"] };
    const [valid] = contextByType(
      commit({ type: "docs", body: "### Context\nhere" }),
      "always",
      custom,
    );
    expect(valid).toBe(true);
  });

  // all four default types
  describe("default types", () => {
    it("fix requires Why", () => {
      const [valid] = contextByType(commit({ type: "fix", body: "### Why\nreasons" }));
      expect(valid).toBe(true);
    });

    it("feat requires Why", () => {
      const [valid] = contextByType(commit({ type: "feat", body: "### Why\nreasons" }));
      expect(valid).toBe(true);
    });

    it("refactor requires Why and Approach", () => {
      const [f1] = contextByType(commit({ type: "refactor", body: "### Why\nreasons" }));
      expect(f1).toBe(false);
      const [f2] = contextByType(
        commit({ type: "refactor", body: "### Why\nr\n### Approach\na" }),
      );
      expect(f2).toBe(true);
    });

    it("perf requires Why and Metrics", () => {
      const [f1] = contextByType(commit({ type: "perf", body: "### Why\nreasons" }));
      expect(f1).toBe(false);
      const [f2] = contextByType(
        commit({ type: "perf", body: "### Why\nr\n### Metrics\nm" }),
      );
      expect(f2).toBe(true);
    });
  });

  describe("when = 'never'", () => {
    it("fails with message when sections ARE present", () => {
      const [valid, msg] = contextByType(
        commit({ body: "### Why\nreasons" }),
        "never",
      );
      expect(valid).toBe(false);
      expect(msg).toBe("fix commits should NOT include: Why");
    });

    it("passes when sections are missing", () => {
      const [valid, msg] = contextByType(commit({ body: "no sections" }), "never");
      expect(valid).toBe(true);
      expect(msg).toBe("");
    });
  });

  describe("section matching", () => {
    it("matches section at start of line", () => {
      const [valid] = contextByType(
        commit({ body: "Some intro\n### Why\nreasons" }),
      );
      expect(valid).toBe(true);
    });

    it("does not match section mid-line", () => {
      const [valid] = contextByType(commit({ body: "Here's ### Why\nreasons" }));
      expect(valid).toBe(false);
    });

    it("matches case-insensitively", () => {
      const [valid] = contextByType(commit({ body: "### why\nreasons" }));
      expect(valid).toBe(true);
    });

    it("matches with extra spaces after ###", () => {
      const [valid] = contextByType(commit({ body: "###  Why\nreasons" }));
      expect(valid).toBe(true);
    });
  });

  describe("exemptions", () => {
    it("skips merge commits", () => {
      const [valid, msg] = contextByType(commit({ merge: true, body: null }));
      expect(valid).toBe(true);
      expect(msg).toBe("");
    });

    it("skips revert commits", () => {
      const [valid, msg] = contextByType(
        commit({ revert: { header: "revert: something" }, body: null }),
      );
      expect(valid).toBe(true);
      expect(msg).toBe("");
    });
  });
});

// ---------------------------------------------------------------------------
// context-recommended
// ---------------------------------------------------------------------------
describe("context-recommended", () => {
  it("passes with no warning when recommended sections are present", () => {
    const [valid, msg] = contextRecommended(
      commit({ body: "### Why\nr\n### Cause\nc\n### Approach\na" }),
    );
    expect(valid).toBe(true);
    expect(msg).toBe("");
  });

  it("passes with warning when recommended sections are missing", () => {
    const [valid, msg] = contextRecommended(
      commit({ body: "### Why\nreasons" }),
    );
    expect(valid).toBe(false);
    expect(msg).toBe("fix commits: consider adding: Cause, Approach");
  });

  it("skips types not in config", () => {
    const [valid, msg] = contextRecommended(commit({ type: "docs" }));
    expect(valid).toBe(true);
    expect(msg).toBe("");
  });

  it("skips when type is null", () => {
    const [valid] = contextRecommended(commit({ type: null }));
    expect(valid).toBe(true);
  });

  it("returns true when config has no recommended sections", () => {
    const custom: RuleValue = { fix: ["Why"] }; // string[] → no recommended
    const [valid, msg] = contextRecommended(commit({ body: "### Why\nr" }), "always", custom);
    expect(valid).toBe(true);
    expect(msg).toBe("");
  });

  describe("default types", () => {
    it("fix recommends Cause and Approach", () => {
      const [, msg] = contextRecommended(commit({ type: "fix", body: "### Why\nr" }));
      expect(msg).toBe("fix commits: consider adding: Cause, Approach");
    });

    it("feat recommends Approach and Alternatives", () => {
      const [, msg] = contextRecommended(commit({ type: "feat", body: "### Why\nr" }));
      expect(msg).toBe("feat commits: consider adding: Approach, Alternatives");
    });

    it("refactor recommends Alternatives and Invariants", () => {
      const [, msg] = contextRecommended(
        commit({ type: "refactor", body: "### Why\nr\n### Approach\na" }),
      );
      expect(msg).toBe(
        "refactor commits: consider adding: Alternatives, Invariants",
      );
    });

    it("perf recommends Approach and Tradeoffs", () => {
      const [, msg] = contextRecommended(
        commit({ type: "perf", body: "### Why\nr\n### Metrics\nm" }),
      );
      expect(msg).toBe("perf commits: consider adding: Approach, Tradeoffs");
    });
  });

  describe("exemptions", () => {
    it("skips merge commits", () => {
      const [valid, msg] = contextRecommended(commit({ merge: true, body: null }));
      expect(valid).toBe(true);
      expect(msg).toBe("");
    });

    it("skips revert commits", () => {
      const [valid, msg] = contextRecommended(
        commit({ revert: { header: "revert: something" }, body: null }),
      );
      expect(valid).toBe(true);
      expect(msg).toBe("");
    });
  });

  describe("when = 'never'", () => {
    it("fails when recommended sections ARE present", () => {
      const [valid, msg] = contextRecommended(
        commit({ body: "### Why\nr\n### Cause\nc\n### Approach\na" }),
        "never",
      );
      expect(valid).toBe(false);
      expect(msg).toBe("fix commits: consider NOT including: Cause, Approach");
    });

    it("passes when recommended sections are missing", () => {
      const [valid, msg] = contextRecommended(
        commit({ body: "### Why\nr" }),
        "never",
      );
      expect(valid).toBe(true);
      expect(msg).toBe("");
    });
  });
});
