export const commitlintConfig = `// commitlint.config.js
export default {
  extends: ["@commitlint/config-conventional"],
  plugins: ["@muselet/commitlint-plugin"],
  rules: {
    "context-by-type": [
      2,
      "always",
      {
        fix: ["Why"],
        feat: ["Why"],
        refactor: ["Why", "Alternatives"],
        perf: ["Why", "Trade-offs"],
      },
    ],
  },
};
`;
