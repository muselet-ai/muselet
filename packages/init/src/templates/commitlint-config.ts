import type { RuleValue, SectionConfig } from "../../../commitlint-plugin/src/rules/context-by-type.js";

function serializeRuleValue(rules: RuleValue): string {
  const entries = Object.entries(rules).map(([type, config]) => {
    const section = Array.isArray(config)
      ? { required: config } as SectionConfig
      : config as SectionConfig;
    const parts: string[] = [];
    if (section.required?.length) {
      parts.push(`required: [${section.required.map(s => `"${s}"`).join(", ")}]`);
    }
    if (section.recommended?.length) {
      parts.push(`recommended: [${section.recommended.map(s => `"${s}"`).join(", ")}]`);
    }
    return `        ${type}: { ${parts.join(", ")} }`;
  });
  return entries.join(",\n");
}

export function commitlintConfig(rules: RuleValue): string {
  return `// commitlint.config.mjs
export default {
  extends: ["@commitlint/config-conventional"],
  plugins: ["@muselet/commitlint-plugin"],
  rules: {
    // Required sections → error if missing
    // Recommended sections → warning if missing (non-blocking, but agents will self-correct)
    "context-by-type": [
      2,
      "always",
      {
${serializeRuleValue(rules)},
      },
    ],
  },
};
`;
}
