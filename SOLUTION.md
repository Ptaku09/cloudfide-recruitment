# SOLUTION — PR Test Agent

A Claude Code **custom agent** (`test-engineer`) with five **reusable skills**, driven by a GitHub Actions **agentic workflow**. On every pull request it analyzes the change, writes or updates unit tests for the backend and frontend, verifies them in an isolated job, commits them to the PR branch, and posts a results comment on the PR.

## Main technical decisions

| Decision | Rationale |
| --- | --- |
| **Claude Code** as the agent runtime, run via the official `anthropics/claude-code-action` | First-class support for custom agents (`.claude/agents`), skills (`.claude/skills`), tool permissions, and a Bash sandbox. The same definitions work locally and in CI. |
| **One agent, five narrow skills** | The agent holds the policy (what it may touch, when to stop); skills hold reusable know-how: change analysis, backend conventions, frontend conventions, running and triaging tests, and the report format. Skills are preloaded through the agent's `skills:` frontmatter, and developers can use them in local Claude Code sessions too. |
| **Three jobs with separated privileges**: `agent` → `verify` → `publish` | The model never holds a write token. `agent` has `contents: read`. `verify` has no secrets at all and re-runs everything from scratch. Only `publish`, which runs no model and no PR code, gets `contents: write` and `pull-requests: write`. |
| **Deterministic guard on the agent's patch** (`.github/scripts/guard-patch.mjs`) | "Tests only" is enforced by code, not just the prompt. Every path in the patch, including both sides of a rename, must match a test-file pattern, and added lines are scanned for Anthropic tokens. Anything else rejects the whole patch. |
| **Independent verification** | Results in the comment come from the `verify` job (typecheck, full suite, and coverage in both packages), not from the agent's own claims. |
| **Sandboxed agent shell** (`.claude/ci-settings.json`) | Tests the agent writes are arbitrary code that runs while the OAuth token is in the job environment. Claude Code's bubblewrap sandbox gives every agent-run command no network access, so it cannot exfiltrate the token. WebFetch and WebSearch are denied, and edits to `.github/`, `.claude/` and `.env*` are blocked. |
| **Sticky comment and job summary** | A single comment (hidden marker `<!-- pr-test-agent -->`) is updated on every push, so the PR doesn't fill up with duplicates. |
| **Failing the check on purpose** | The run fails if the agent errors, verification fails, or the agent reports a suspected bug in application code (the agent drops such a test rather than "fixing" the app or asserting wrong behavior). |
| **Same-repo PRs only, `pull_request` trigger** | `pull_request_target` together with running PR code is the classic Actions supply-chain hole; fork PRs are skipped. |
| **Supply-chain hygiene** | Every action is pinned to a full commit SHA, `permissions: {}` is set at the workflow level, each job has a timeout, and a per-PR concurrency group cancels superseded runs. |

## How to run the PR workflow

### Prerequisites

1. **Secret `CLAUDE_CODE_OAUTH_TOKEN`**: run `claude setup-token` locally (requires a Claude Pro/Max subscription), then add the token under *Settings → Secrets and variables → Actions*.
2. *(Optional)* **Variable `PR_TEST_AGENT_MODEL`** overrides the model (default `claude-sonnet-5-5`).
3. **Actions enabled**, with *Settings → Actions → General → Workflow permissions* allowing read and write. The workflow narrows permissions per job anyway.
4. **No required status checks on the target branch**, or a GitHub App token instead of `GITHUB_TOKEN` (see Limitations).

### Usage

Open or update a pull request that touches `backend/**` or `frontend/**`. The workflow `.github/workflows/pr-test-agent.yml` runs automatically:

1. **agent**:
   - Installs dependencies and records baseline coverage.
   - Runs `claude --agent test-engineer` in diff mode against the PR base SHA.
   - Exports the agent's working-tree changes as `agent.patch` together with `report.json` and `report.md`.
2. **verify**: guard → apply patch → `npm run typecheck` and `vitest --coverage` in both packages → `verify.json`.
3. **publish**:
   - If verification passed and there are changes, commits them as `github-actions[bot]` (`test: add/update tests for PR #N [pr-test-agent]`) and pushes.
   - Upserts the PR comment and writes the job summary.
   - Sets the final check status.

### Running the agent locally (e.g. the coverage pass)

```sh
claude --agent test-engineer --settings .claude/ci-settings.json --setting-sources project \
  --model claude-sonnet-5-5 --allowedTools "Read,Glob,Grep,Write,Edit,Bash" \
  -p "MODE=full"                      # or: -p "MODE=diff BASE_SHA=$(git merge-base main HEAD)"
node .github/scripts/guard-patch.mjs <(git add -A && git diff --cached)
```

## Where things are defined

| Path | What |
| --- | --- |
| `.claude/agents/test-engineer.md` | Custom agent: role, hard rules (tests only, no weakening, untrusted input, no network), workflow, preloaded skills, turn limit. |
| `.claude/skills/analyze-changes/` | Diff/full-mode analysis and the test-or-skip decision table (e.g. skip the design system, types, generated Prisma code, docs). |
| `.claude/skills/backend-tests/` | Backend patterns: router + mocked `TodoStore` + Supertest, real Prisma client with `vi.spyOn` (no DB), fixtures, `.ts` imports, coverage thresholds. |
| `.claude/skills/frontend-tests/` | Frontend patterns: design-system mocks, mocked hooks, `renderHook` with a fresh `QueryClient`, `fetch` mocking, Testing Library queries, Prettier. |
| `.claude/skills/run-tests/` | Commands, the fix loop (max 3 attempts per file), "test bug" vs "suspected app bug" triage, flakiness re-run. |
| `.claude/skills/test-report/` | The `report.json` schema consumed by the workflow, and `report.md`. |
| `.claude/ci-settings.json` | Sandbox (no network, fail if unavailable, no unsandboxed retries) and deny rules. |
| `.github/workflows/pr-test-agent.yml` | The agentic workflow. |
| `.github/scripts/guard-patch.mjs`, `render-comment.mjs` | Deterministic guard and comment renderer, tested by `node --test .github/scripts/*.test.mjs`. |

## Example run

_Filled in from the demo PR — see below._

## Assumptions

- Contributors who open PRs in this repository are trusted collaborators; PR content is still treated as untrusted input by the agent (prompt-injection posture).
- Unit tests only: no PostgreSQL in CI. The backend is tested through the `TodoStore` interface and Prisma delegate spies, matching the existing tests.
- A Claude subscription OAuth token is acceptable for CI use in a demo/recruitment setting.
- The target branch has no required status checks.

## Limitations

- **Fork PRs are not supported.** They get no secrets, and the safe two-workflow pattern was out of scope.
- **The bot's commit doesn't trigger CI.** Pushes made with `GITHUB_TOKEN` don't start workflows (this is also the loop prevention). Required checks would therefore block the merge.
- **The token is present in the agent job.** Network isolation via the sandbox is the mitigation. A bug in the sandbox or in the action itself remains a residual risk.
- **Output is non-deterministic.** Re-runs may produce different tests. Quality is bounded by the guard, verification, and review by the PR author.
- **No mutation testing.** Coverage and passing tests don't prove the assertions are strong.
- **Cost and latency.** A full model session runs on every push. Concurrency cancels superseded runs, but there is no budget cap other than `maxTurns` and the job timeouts.

## Production extensions

- **GitHub App installation token** for publishing, so the bot's commits trigger normal CI and appear under a dedicated identity; signed commits.
- **Fork support** via a `pull_request` (untrusted, no secrets) → `workflow_run` (trusted) split, passing only artifacts.
- **Workload identity federation or an API key with spend limits** instead of a personal subscription token; per-run cost reporting.
- **Mutation testing** (Stryker) on the changed files to score test strength, reported in the comment.
- **An eval suite for the agent and skills**: seeded PRs with known gaps and bugs, scored on pass rate, guard violations, and caught bugs; run on every change to the prompts.
- **Smarter triggering**: skip when the diff only touches excluded paths, `/test-agent` comment commands, and a label to opt out.
- **Integration tests** with a Postgres service container, as a separate skill.
