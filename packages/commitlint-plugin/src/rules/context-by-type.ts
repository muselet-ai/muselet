export interface Commit {
  type: string | null;
  body: string | null;
  merge?: boolean | null;
  revert?: Record<string, string> | null;
  [key: string]: unknown;
}

export interface SectionConfig {
  required?: string[];
  recommended?: string[];
}

export type RuleValue = Record<string, SectionConfig | string[]>;

export const DEFAULT_VALUE: RuleValue = {
  fix: { required: ["Why"], recommended: ["Cause", "Approach"] },
  feat: { required: ["Why"], recommended: ["Approach", "Alternatives"] },
  refactor: {
    required: ["Why", "Approach"],
    recommended: ["Alternatives", "Invariants"],
  },
  perf: {
    required: ["Why", "Metrics"],
    recommended: ["Approach", "Tradeoffs"],
  },
};

function normalize(value: SectionConfig | string[]): SectionConfig {
  return Array.isArray(value) ? { required: value } : value;
}

function findMissing(body: string | null, sections: string[]): string[] {
  return sections.filter(
    (s) => !body || !new RegExp(`^###\\s+${s}`, "mi").test(body),
  );
}

export const contextByType = (
  parsed: Commit,
  when: "always" | "never" = "always",
  value: RuleValue = DEFAULT_VALUE,
): [boolean, string] => {
  if (parsed.merge || parsed.revert != null) return [true, ""];

  const { type, body } = parsed;
  if (!type || !(type in value)) return [true, ""];

  const { required = [] } = normalize(value[type]);
  const missing = findMissing(body, required);

  const hasContext = missing.length === 0;
  const result = when === "never" ? !hasContext : hasContext;

  let message = "";
  if (when === "never" && hasContext) {
    message = `${type} commits should NOT include: ${required.join(", ")}`;
  } else if (when === "always" && !hasContext) {
    message = `${type} commits should include: ${missing.join(", ")}`;
  }

  return [result, message];
};

export const contextRecommended = (
  parsed: Commit,
  when: "always" | "never" = "always",
  value: RuleValue = DEFAULT_VALUE,
): [boolean, string] => {
  if (parsed.merge || parsed.revert != null) return [true, ""];

  const { type, body } = parsed;
  if (!type || !(type in value)) return [true, ""];

  const { recommended = [] } = normalize(value[type]);
  if (recommended.length === 0) return [true, ""];

  const missing = findMissing(body, recommended);

  const hasContext = missing.length === 0;
  const result = when === "never" ? !hasContext : hasContext;

  let message = "";
  if (when === "never" && hasContext) {
    message = `${type} commits: consider NOT including: ${recommended.join(", ")}`;
  } else if (when === "always" && !hasContext) {
    message = `${type} commits: consider adding: ${missing.join(", ")}`;
  }

  return [result, message];
};
