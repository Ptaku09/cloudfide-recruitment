---
name: test-report
description: Write the test-engineer run report (.agent/report.json and .agent/report.md) that the PR workflow publishes. Use as the last step of every run, including runs where no tests were needed or something failed.
---

# Test report

Write **`.agent/report.json`** (create `.agent/` if needed) exactly in this shape. Paths are relative to the repository root. Valid JSON only — no comments, no trailing commas.

```json
{
  "mode": "diff",
  "summary": "One or two sentences: what changed and what you did about tests.",
  "decisions": [
    { "file": "backend/src/features/todos/stats.ts", "action": "tested", "reason": "New overdue/priority counting logic", "tests": ["backend/tests/stats.test.ts"] },
    { "file": "backend/openapi.json", "action": "skipped", "reason": "API documentation, not unit-testable", "tests": [] }
  ],
  "testsWritten": ["backend/tests/stats.test.ts"],
  "testsUpdated": [],
  "suspectedBugs": [
    { "file": "backend/src/...", "description": "What behavior you expected, what the code does, and the input that shows it." }
  ]
}
```

- `mode`: `"diff"` or `"full"`.
- `decisions`: one entry per analyzed source file (diff mode: every changed non-test file). `action` is `"tested"` or `"skipped"`; `reason` is one short sentence a reviewer can check.
- `testsWritten` / `testsUpdated`: test files you created / modified. Must match the files you actually changed.
- `suspectedBugs`: empty array when none. Each entry means a test was left out because the code looks wrong — this fails the PR check on purpose, so be sure.

Then write **`.agent/report.md`**: the summary, a short bullet list of the most important tests added (behavior covered, not test names), and any suspected bugs. Keep it under 30 lines.

Before finishing, verify: `node -e "JSON.parse(require('fs').readFileSync('.agent/report.json','utf8'))"` succeeds.
