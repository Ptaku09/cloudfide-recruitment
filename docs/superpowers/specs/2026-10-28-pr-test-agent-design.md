# PR Test Agent — Design

## Intent

Recruitment task: build a custom agent + reusable skills + agentic GitHub workflow that, on every pull request, analyzes the change and — when appropriate — creates or updates unit tests for changed code (frontend and backend), verifies them by running them, and reports results on the PR. The same agent is also used once to raise coverage of the existing app. Evaluation weighs the agent, skills, and workflow most, especially security, reliability, and correctness/usefulness of results.

Repo: `git@github.com:Ptaku09/cloudfide-recruitment.git` (this monorepo: `backend/` Express+Prisma, `frontend/` React+Vite; see `CLAUDE.md`).

## Decided with the user

- **Agent environment:** Claude Code, run in GitHub Actions via `anthropics/claude-code-action`.
- **Auth:** Claude subscription token — `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) stored as a repo secret.
- **Output on the PR:** both (a) a commit with new/updated tests pushed to the PR branch and (b) a results comment (agent decisions, files tested/skipped and why, test results per package, coverage before → after). Comment is sticky: updated in place on re-runs. *(Sticky = my call; user didn't object.)*
- **Hard rule: tests only.** Agent may create/edit test files only, never application code. Enforced deterministically by the workflow, not just by prompt. If a new test fails because the PR code looks buggy, the agent leaves that test out, explains it in the comment, and the workflow run is marked failed.
- **Existing tests:** agent may update existing tests when the PR intentionally changes the behavior they cover. Such edits need not be called out separately in the comment. Verify passes only when everything is green.
- **Coverage task:** same agent + skills run over the whole codebase (not a diff); result delivered as a separate "raise coverage" PR.
- **Demo PR:** new feature "task stats": backend `GET /api/todos/stats` → `{ total, completed, active, overdue, byPriority: { low, medium, high } }` and a stats summary bar on the todos page. Shipped **without tests** so the agent has work to do.

## Goals / non-goals / anti-goals

- Goals: useful, passing, convention-following tests; agent decisions explained; results visible in PR; reproducible and safe.
- Non-goals: integration/e2e tests against a real DB; fork PR support; gating merges on coverage thresholds.
- Anti-goals: agent changing app code to make tests pass; tests rewritten to match buggy behavior; agent holding write credentials; infinite bot loops; flaky/noisy results.

## Architecture (my calls unless stated)

### Custom agent — `.claude/agents/test-engineer.md`
Subagent definition (frontmatter: name, description, tools, model). Tools: Read, Glob, Grep, Write, Edit, Bash. Instructions: scope (diff mode vs full mode), the tests-only rule, decision policy, iteration budget, required output report. Uses the skills below.

### Reusable skills — `.claude/skills/<name>/SKILL.md`
1. `analyze-changes` — list changed files vs base (`git diff --name-status <base>...HEAD`), classify each (backend logic / frontend logic / UI component / design-system / types-only / config / docs / tests / generated), decide test/skip with reason. Skip: docs, config, types-only, styles, stories, `src/design-system/**` (covered by Storybook, excluded from coverage), generated Prisma code, `main.ts`. Full mode = classify all source files, prioritize lowest coverage from `coverage-summary.json`.
2. `backend-tests` — conventions: Vitest + Supertest; router tests mount router with mocked `TodoStore`; repository tests build real Prisma client and `vi.spyOn` delegates (no DB); fixtures in `tests/fixture.ts`; tests in `backend/tests/*.test.ts` importing `.ts`; style matching existing tests.
3. `frontend-tests` — conventions: Vitest + jsdom + Testing Library + user-event; colocated `*.test.tsx`; render with `AppProviders` and a fresh `QueryClient` (retry off); mock `fetch`/`todosApi` via `vi`; fixtures in `src/test/todoFixture.ts`; query by role/label; Prettier style.
4. `run-tests` — exact commands per package (run single file, full suite, coverage with json-summary), how to read failures, the fix loop (max 3 attempts per test file), and classifying a failure as "test bug" (fix the test) vs "suspected app bug" (drop the test, report it).
5. `test-report` — writes `.agent/report.json` (machine-readable: decisions, files written, suspected bugs) and `.agent/report.md` (human summary) in a fixed schema the workflow consumes.

Skills are plain repo files, so devs can also use them locally in Claude Code.

### Workflow — `.github/workflows/pr-test-agent.yml`
Trigger: `pull_request` (opened, synchronize, reopened, ready_for_review), skip drafts, **same-repo PRs only** (fork PRs get no secrets; `pull_request_target` deliberately not used). Concurrency group per PR, cancel-in-progress. Actions pinned by commit SHA. Timeouts on every job.

Jobs (least privilege; agent never holds a write token):
1. **agent** (`contents: read`): checkout PR head with full history; Node 22; `npm ci` both packages (includes `prisma generate`); baseline coverage for both → `baseline/`; run claude-code-action with prompt "use test-engineer agent in diff mode against base SHA"; `--allowedTools` restricted to Read/Glob/Grep/Write/Edit and Bash limited to test/typecheck/git-read commands; `--max-turns` cap; model configurable (default Sonnet 5.5). Then produce `agent.patch` from working tree and upload it + reports + baseline as artifact.
2. **verify** (`contents: read`): fresh checkout of PR head; apply patch; **guard**: every changed path must match test globs (`backend/tests/**`, `frontend/src/**/*.test.{ts,tsx}`, `frontend/src/test/**`) — else fail, nothing published; `npm ci`; typecheck + full test suite + coverage for both packages (independent of what the agent claimed); emit results + coverage JSON.
3. **publish** (`contents: write`, `pull-requests: write`): runs if agent produced changes and verify passed → commit as `github-actions[bot]` and push to PR branch. Always (if agent ran) → upsert sticky PR comment (hidden marker) combining agent report + verify results + coverage delta table; also write job summary. Fail the run if verify failed or the agent reported suspected bugs.

Loop prevention: pushes made with `GITHUB_TOKEN` do not trigger new workflow runs; additionally skip if the head commit is authored by `github-actions[bot]`.

Prompt-injection posture: PR content is untrusted input; mitigations = same-repo only, agent has no write token / no push, restricted Bash allowlist, deterministic path guard and independent verification. *(My call)* Test files the agent writes are arbitrary Node code executed while `CLAUDE_CODE_OAUTH_TOKEN` is in the job env → enable Claude Code's Bash sandbox (no outbound network for agent-run commands) and re-run everything in the secret-less verify job; document residual risk in `SOLUTION.md`.

Re-runs on later pushes *(my call)*: analysis still diffs against the PR base, but the agent treats tests already on the branch (including its own earlier commits and developer edits to them) as existing tests — it keeps them and only covers what is still untested. No changes → nothing pushed, comment still updated.

Branch protection *(my call / assumption)*: `main` has no required status checks. Bot commits pushed with `GITHUB_TOKEN` don't trigger CI, so required checks would block merge; production fix = GitHub App token (documented as limitation).

Baseline failures *(my call)*: if the PR already breaks tests before the agent runs, the baseline is still recorded; the agent may fix tests whose behavior changed intentionally; verify judges the final state (all green).

### Rollout / demo sequence
1. Infra PR (agent, skills, workflow, `SOLUTION.md`, `CLAUDE.md`) → merged to `main`.
2. Coverage PR: run test-engineer locally in full mode (Claude Code CLI with the same agent/skills), push branch, open PR → PR workflow also runs on it.
3. Feature PR `feature/todo-stats` without tests → workflow adds tests, comments results.

### `SOLUTION.md`
Short doc covering: technical decisions + rationale, how to run + prerequisites (secret, repo settings), where agent/skills live and how they're used, example run (from demo PR: decisions, skills, results), assumptions, limitations, production extensions.

## Left to the builder
Exact prompt wording, report schema fields, comment layout, test file naming for new backend modules, coverage-delta formatting, exact SHA pins, how the stats feature is implemented (keep it small, follow existing patterns, update `openapi.json`).
