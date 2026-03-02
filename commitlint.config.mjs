// commitlint.config.mjs
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
        fix: { required: ["Why"], recommended: ["Cause", "Approach"] },
        feat: { required: ["Why"], recommended: ["Approach", "Alternatives"] },
        refactor: { required: ["Why", "Approach"], recommended: ["Alternatives", "Invariants"] },
        perf: { required: ["Why", "Metrics"], recommended: ["Approach", "Tradeoffs"] },
      },
    ],
  },
};
