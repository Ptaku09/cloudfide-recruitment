---
name: analyze-changes
description: Decide which changed (or uncovered) Taskly source files need unit tests and which to skip, with a reason for each. Use at the start of every test-engineer run.
---

# Analyze changes

## Diff mode (`MODE=diff BASE_SHA=<sha>`)

1. List changes: `git diff --name-status <sha>...HEAD`
2. For each file, read the change: `git diff <sha>...HEAD -- <file>`, then read the whole file for context.
3. Find existing tests for it:
   - backend: `backend/tests/<module>.test.ts` (one file per module, e.g. `router.ts` → `tests/router.test.ts`)
   - frontend: the colocated `<Name>.test.ts(x)` next to the source file
4. Classify the file and decide using the table below.

If a test file in the diff was changed by the PR author, keep their intent; only add what is missing.

## Full mode (`MODE=full`)

1. Produce coverage first (see **run-tests**): `npx vitest run --coverage --coverage.reportOnFailure` in `backend/` and `frontend/`.
2. Read `coverage/coverage-summary.json` in each package. Every source file there is a candidate; rank by uncovered lines, lowest coverage first.
3. Apply the same table. Work down the list until every testable file is reasonably covered (aim for all branches of logic, not 100% at any cost).

## Decision table

| Kind of file | Decision |
| --- | --- |
| Backend logic: `backend/src/features/**` (router, repository, mappers, validators, new modules), `backend/src/api/**`, `backend/src/core/config.ts`, `backend/src/factory.ts` | **Test** |
| Backend process wiring: `backend/src/main.ts`, `backend/src/core/lifespan.ts` | Test only pure, isolatable behavior; otherwise skip — needs a live server/DB |
| `backend/src/generated/**` | Skip — generated Prisma client |
| Frontend logic: `frontend/src/features/**/utils`, `api`, `hooks`, `frontend/src/lib/**`, `frontend/src/hooks/**` | **Test** |
| Frontend components/pages: `frontend/src/features/**/components`, `*Page.tsx`, `frontend/src/components/**`, `frontend/src/app/**`, `App.tsx` | **Test** behavior (rendering states, user interactions, callbacks) |
| `frontend/src/design-system/**` | Skip — presentational, covered by Storybook, excluded from coverage |
| `types.ts`, `*.types.ts`, `index.ts` barrels, `queryKeys.ts`, constants | Skip — no behavior |
| Styles (`*.styles.ts`, `*.css`), stories, `main.tsx` | Skip |
| Docs, `openapi.json`, config, Dockerfiles, lockfiles, CI | Skip — not unit-testable |
| Existing test files | Not a target; may be updated if the change intentionally altered the behavior they assert |
| Deleted source files | Delete or update tests that only covered them |

Write down every decision (file, tested/skipped, one-line reason) — the **test-report** skill needs all of them.
