---
name: run-tests
description: How to run Taskly tests, typecheck, and coverage for the backend and frontend, and how to triage failures. Use after writing each test file and before finishing.
---

# Run tests

Dependencies are already installed (`npm ci` ran, Prisma client generated). Do not install anything.

| Goal | Backend (`cd backend`) | Frontend (`cd frontend`) |
| --- | --- | --- |
| One file | `npx vitest run tests/<file>.test.ts` | `npx vitest run src/<path>.test.tsx` |
| One test | `npx vitest run tests/<file>.test.ts -t "<name>"` | `npx vitest run src/<path>.test.tsx -t "<name>"` |
| Full suite | `npm test` | `npm test` |
| Coverage | `npx vitest run --coverage --coverage.reportOnFailure` | same |
| Typecheck | `npm run typecheck` | `npm run typecheck` |

Coverage summary: `<package>/coverage/coverage-summary.json` (per-file `lines.pct`, `branches.pct`). Use it to find uncovered branches in files you are testing.

## Loop

1. Run the new/changed test file alone.
2. On failure, read the error and the code under test, then decide:
   - **Test bug** (wrong import, wrong mock, wrong selector, async not awaited, wrong expectation of *intended* behavior) → fix the test.
   - **Suspected app bug** (the test encodes clearly intended behavior — from names, types, docs, validators, or the PR's own intent — and the code does something else) → remove that test case and record it in `suspectedBugs`. Do not change app code.
3. At most **3 fix attempts per test file**. If it still fails, remove the failing cases and record why in the report decisions.
4. When all files pass individually, run the **full suite** and **typecheck** for every package you touched. Both must pass. Watch for warnings such as `act(...)` and unhandled rejections — fix them.
5. Check for flakiness: run each new file a second time.
