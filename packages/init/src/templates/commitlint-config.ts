export const commitlintConfig = `// commitlint.config.mjs
export default {
  extends: ["@commitlint/config-conventional"],
  plugins: ["@muselet/commitlint-plugin"],
  rules: {
    "body-max-line-length": [0],
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
