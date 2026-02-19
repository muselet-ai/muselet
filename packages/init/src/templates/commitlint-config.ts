export const commitlintConfig = `// commitlint.config.mjs
export default {
  extends: ["@commitlint/config-conventional"],
  plugins: ["@muselet/commitlint-plugin"],
  rules: {
    // Required sections — error if missing
    "context-by-type": [
      2,
      "always",
      {
        fix: { required: ["Why"] },
        feat: { required: ["Why"] },
        refactor: { required: ["Why", "Approach"] },
        perf: { required: ["Why", "Metrics"] },
      },
    ],
    // Recommended sections — warn if missing (agents should always include these)
    "context-recommended": [
      1,
      "always",
      {
        fix: { recommended: ["Cause", "Approach"] },
        feat: { recommended: ["Approach", "Alternatives"] },
        refactor: { recommended: ["Alternatives", "Invariants"] },
        perf: { recommended: ["Approach", "Tradeoffs"] },
      },
    ],
  },
};
`;
