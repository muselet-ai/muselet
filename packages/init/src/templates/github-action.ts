export const githubAction = `name: Lint Commits (muselet)

on:
  pull_request:
    branches: [main]

jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: |
          if [ -f pnpm-lock.yaml ]; then
            npm i -g pnpm && pnpm install --frozen-lockfile
          elif [ -f yarn.lock ]; then
            yarn install --frozen-lockfile
          else
            npm ci
          fi

      - name: Lint commits
        run: npx commitlint --from \${{ github.event.pull_request.base.sha }} --to \${{ github.event.pull_request.head.sha }} --verbose
`;
