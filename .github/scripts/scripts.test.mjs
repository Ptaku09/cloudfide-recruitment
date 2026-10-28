import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPatch } from './guard-patch.mjs';
import { renderComment } from './render-comment.mjs';

const diff = (from, to, added = '') =>
  `diff --git a/${from} b/${to}\n--- a/${from}\n+++ b/${to}\n@@ -0,0 +1 @@\n${added}\n`;

test('allows test-only patch', () => {
  const patch = diff('backend/tests/stats.test.ts', 'backend/tests/stats.test.ts', "+it('works', () => {});")
    + diff('frontend/src/features/todos/components/TodoStats.test.tsx', 'frontend/src/features/todos/components/TodoStats.test.tsx')
    + diff('frontend/src/test/statsFixture.ts', 'frontend/src/test/statsFixture.ts')
    + diff('backend/tests/fixture.ts', 'backend/tests/fixture.ts');
  assert.deepEqual(checkPatch(patch), []);
});

test('allows empty patch', () => {
  assert.deepEqual(checkPatch(''), []);
});

test('rejects app code', () => {
  const violations = checkPatch(diff('backend/src/features/todos/router.ts', 'backend/src/features/todos/router.ts'));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /backend\/src\/features\/todos\/router\.ts/);
});

test('rejects rename out of src', () => {
  const violations = checkPatch(diff('frontend/src/lib/http.ts', 'frontend/src/lib/http.test.ts'));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /frontend\/src\/lib\/http\.ts/);
});

test('rejects workflow and agent config', () => {
  const violations = checkPatch(
    diff('.github/workflows/x.yml', '.github/workflows/x.yml') + diff('.claude/agents/test-engineer.md', '.claude/agents/test-engineer.md'),
  );
  assert.equal(violations.length, 2);
});

test('rejects patch headers the guard cannot parse', () => {
  assert.equal(checkPatch('diff --git "a/odd name" "b/odd name"\n').length, 1);
});

test('rejects secrets', () => {
  const violations = checkPatch(diff('backend/tests/a.test.ts', 'backend/tests/a.test.ts', "+const t = 'sk-ant-oat01-abcdefghijkl';"));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /secret/);
});

test('rejects the literal token value', () => {
  const violations = checkPatch(diff('backend/tests/a.test.ts', 'backend/tests/a.test.ts', '+const t = "my-token-value";'), 'my-token-value');
  assert.equal(violations.length, 1);
  assert.match(violations[0], /secret/);
});

const summary = (lines, branches) => ({ total: { lines: { pct: lines }, branches: { pct: branches } } });
const report = {
  mode: 'diff',
  summary: 'Added tests for stats.',
  decisions: [
    { file: 'backend/src/features/todos/stats.ts', action: 'tested', reason: 'New logic', tests: ['backend/tests/stats.test.ts'] },
    { file: 'backend/openapi.json', action: 'skipped', reason: 'Documentation', tests: [] },
  ],
  testsWritten: ['backend/tests/stats.test.ts'],
  testsUpdated: [],
  suspectedBugs: [],
};
const verify = {
  backend: { typecheck: 'pass', tests: 'pass', passed: 40, failed: 0 },
  frontend: { typecheck: 'pass', tests: 'pass', passed: 90, failed: 0 },
};
const base = {
  report,
  verify,
  baseline: { backend: summary(33.02, 33.33), frontend: summary(47.68, 43.79) },
  after: { backend: summary(61.5, 60), frontend: summary(47.68, 43.79) },
  runUrl: 'https://github.com/o/r/actions/runs/1',
  pushed: true,
};

test('render: pushed with report', () => {
  const md = renderComment(base);
  assert.ok(md.startsWith('<!-- pr-test-agent -->'));
  assert.match(md, /backend\/src\/features\/todos\/stats\.ts/);
  assert.match(md, /backend\/openapi\.json/);
  assert.match(md, /\| backend \| lines \| 33\.02% → 61\.50% \|/);
  assert.match(md, /✅/);
});

test('render: no changes', () => {
  const md = renderComment({ ...base, pushed: false, report: { ...report, testsWritten: [], testsUpdated: [] } });
  assert.match(md, /No test changes were needed/);
});

test('render: missing report', () => {
  const md = renderComment({ ...base, report: null, verify: null, after: { backend: null, frontend: null }, pushed: false });
  assert.match(md, /did not produce a report/);
  assert.match(md, /actions\/runs\/1/);
});

test('render: suspected bugs', () => {
  const md = renderComment({ ...base, report: { ...report, suspectedBugs: [{ file: 'backend/src/x.ts', description: 'Overdue ignores completed flag' }] } });
  assert.match(md, /Suspected bugs/);
  assert.match(md, /Overdue ignores completed flag/);
});

test('render: failed verification', () => {
  const md = renderComment({ ...base, pushed: false, verify: { ...verify, frontend: { typecheck: 'pass', tests: 'fail', passed: 88, failed: 2 } } });
  assert.match(md, /❌/);
  assert.match(md, /not pushed/);
});

test('render: tolerates a partial report', () => {
  const md = renderComment({ ...base, pushed: false, report: { summary: 'Partial', decisions: [{ file: 'a.ts', action: 'skipped' }] } });
  assert.match(md, /Partial/);
  assert.match(md, /`a\.ts`/);
});
