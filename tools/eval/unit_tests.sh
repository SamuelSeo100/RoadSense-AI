#!/usr/bin/env bash
# Part 1.3: run the unit tests of the frozen release and summarise them.
#   tools/eval/unit_tests.sh [worktree=../routly-v1.0]
# Recreates the worktree from tag v1.0 if it is missing; installs from its lockfile if needed.
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
wt="${1:-$repo/../routly-v1.0}"
out="$HOME/routly-eval"
mkdir -p "$out"
[ -d "$wt" ] || git -C "$repo" worktree add "$wt" v1.0
[ "$(git -C "$wt" rev-parse HEAD)" = "$(git -C "$repo" rev-parse 'v1.0^{commit}')" ] || { echo "worktree is not at v1.0" >&2; exit 1; }
[ -d "$wt/node_modules" ] || (cd "$wt" && npm ci --no-audit --no-fund)
(cd "$wt" && npx jest --ci --json --outputFile="$out/unit-tests-v1.0.json") || true
node -e '
const r = require(process.argv[1]);
console.log(JSON.stringify({ commit: process.argv[2], suites: { passed: r.numPassedTestSuites, failed: r.numFailedTestSuites, total: r.numTotalTestSuites }, tests: { passed: r.numPassedTests, failed: r.numFailedTests, skipped: r.numPendingTests + r.numTodoTests, total: r.numTotalTests } }, null, 2));
' "$out/unit-tests-v1.0.json" "$(git -C "$wt" rev-parse --short HEAD)"
