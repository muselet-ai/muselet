import { describe, it, expect } from "vitest";
import { contextByType, type Commit, type RuleValue } from "./context-by-type.js";

const commit = (overrides: Partial<Commit> = {}): Commit => ({
  type: "fix",
  body: null,
  ...overrides,
});

describe("context-by-type", () => {
  it("passes when required sections are present", () => {
    const [valid, msg] = contextByType(commit({ body: "Why: reasons" }));
    expect(valid).toBe(true);
    expect(msg).toBe("");
  });

  it("passes for refactor with all sections", () => {
    const [valid] = contextByType(
      commit({ type: "refactor", body: "Why: reasons\nAlternatives: none" }),
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
    expect(msg).toBe("refactor commits should include: Why, Alternatives");
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

  it("handles custom value overrides", () => {
    const custom: RuleValue = { docs: ["Context"] };
    const [valid, msg] = contextByType(commit({ type: "docs", body: "no context" }), "always", custom);
    expect(valid).toBe(false);
    expect(msg).toBe("docs commits should include: Context");
  });

  it("passes custom value when section present", () => {
    const custom: RuleValue = { docs: ["Context"] };
    const [valid] = contextByType(commit({ type: "docs", body: "Context: here" }), "always", custom);
    expect(valid).toBe(true);
  });

  describe("when = 'never'", () => {
    it("fails with message when sections ARE present", () => {
      const [valid, msg] = contextByType(commit({ body: "Why: reasons" }), "never");
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
      const [valid] = contextByType(commit({ body: "Some intro\nWhy: reasons" }));
      expect(valid).toBe(true);
    });

    it("does not match section mid-line", () => {
      const [valid] = contextByType(commit({ body: "Here's Why: reasons" }));
      expect(valid).toBe(false);
    });

    it("matches case-insensitively", () => {
      const [valid] = contextByType(commit({ body: "why: reasons" }));
      expect(valid).toBe(true);
    });
  });
});
