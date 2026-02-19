export interface Commit {
  type: string | null;
  body: string | null;
  [key: string]: unknown;
}

export type RuleValue = Record<string, string[]>;

export const DEFAULT_VALUE: RuleValue = {
  fix: ["Why"],
  feat: ["Why"],
  refactor: ["Why", "Alternatives"],
  perf: ["Why", "Trade-offs"],
};

export const contextByType = (
  parsed: Commit,
  when: "always" | "never" = "always",
  value: RuleValue = DEFAULT_VALUE,
): [boolean, string] => {
  const { type, body } = parsed;

  if (!type || !(type in value)) {
    return [true, ""];
  }

  const requiredSections = value[type];
  const missing = requiredSections.filter(
    (section) => !body || !body.includes(`${section}:`),
  );

  const hasContext = missing.length === 0;
  const result = when === "never" ? !hasContext : hasContext;
  const message =
    missing.length > 0
      ? `${type} commits should include: ${missing.join(", ")}`
      : "";

  return [result, message];
};
