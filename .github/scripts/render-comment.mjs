// Renders the sticky PR comment from the agent report, verification results and coverage summaries.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MARKER = '<!-- pr-test-agent -->';
const PACKAGES = ['backend', 'frontend'];
const icon = (outcome) => (outcome === 'pass' ? '✅' : '❌');
// Model output is untrusted: no mentions, images, raw HTML, or code-span breakouts under the bot's name.
const safe = (text) => String(text ?? '').replaceAll('@', '@\u200b').replaceAll('<', '&lt;').replaceAll('![', '!\\[').replaceAll('`', "'");
const cell = (text) => safe(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
const pct = (summary, metric) => {
  const value = summary?.total?.[metric]?.pct;
  return typeof value === 'number' ? `${value.toFixed(2)}%` : 'n/a';
};

export function renderComment({ report: raw, verify, baseline, after, runUrl, pushed }) {
  // The report is model output: never trust its shape.
  const report = raw && {
    summary: String(raw.summary ?? ''),
    decisions: (Array.isArray(raw.decisions) ? raw.decisions : []).map((d) => ({ ...d, tests: Array.isArray(d.tests) ? d.tests : [] })),
    testsWritten: Array.isArray(raw.testsWritten) ? raw.testsWritten : [],
    testsUpdated: Array.isArray(raw.testsUpdated) ? raw.testsUpdated : [],
    suspectedBugs: Array.isArray(raw.suspectedBugs) ? raw.suspectedBugs : [],
  };
  const verified = verify !== null && PACKAGES.every((pkg) => verify[pkg]?.typecheck === 'pass' && verify[pkg]?.tests === 'pass');
  const changed = (report?.testsWritten.length ?? 0) + (report?.testsUpdated.length ?? 0);
  const lines = [MARKER, '## 🧪 PR Test Agent', ''];

  if (!report) {
    lines.push(`❌ The agent did not produce a report. See the [workflow run](${runUrl}) for details.`, '');
  } else if (!verify) {
    lines.push(`❌ Verification did not run, so nothing was pushed (for example, the patch guard rejected the agent's changes). See the [workflow run](${runUrl}).`, '');
  } else if (pushed) {
    lines.push(`✅ Added ${report.testsWritten.length} and updated ${report.testsUpdated.length} test file(s); verified and pushed to this branch.`, '');
  } else if (changed && !verified) {
    lines.push('❌ Test changes failed verification and were not pushed.', '');
  } else if (!changed) {
    lines.push(`${verified ? '✅' : '❌'} No test changes were needed.`, '');
  } else {
    lines.push('⚠️ Test changes were not pushed.', '');
  }

  if (report) {
    lines.push(safe(report.summary), '', '### Decisions', '', '| File | Decision | Reason | Tests |', '| --- | --- | --- | --- |');
    for (const d of report.decisions) {
      lines.push(`| \`${cell(d.file)}\` | ${cell(d.action ?? '')} | ${cell(d.reason ?? '')} | ${d.tests.map((t) => `\`${cell(t)}\``).join('<br>')} |`);
    }
    lines.push('');
    if (report.suspectedBugs.length) {
      lines.push('### ⚠️ Suspected bugs', '', 'Tests for these cases were left out because they fail against the current code:', '');
      for (const bug of report.suspectedBugs) lines.push(`- \`${safe(bug.file)}\`: ${safe(bug.description)}`);
      lines.push('');
    }
  }

  if (verify) {
    lines.push('### Verification', '', '| Package | Typecheck | Tests |', '| --- | --- | --- |');
    for (const pkg of PACKAGES) {
      const r = verify[pkg];
      lines.push(`| ${pkg} | ${icon(r?.typecheck)} | ${icon(r?.tests)} ${r?.passed ?? 0} passed, ${r?.failed ?? 0} failed |`);
    }
    lines.push('');
  }

  lines.push('### Coverage', '', '| Package | Metric | Before → After |', '| --- | --- | --- |');
  for (const pkg of PACKAGES) {
    for (const metric of ['lines', 'branches']) {
      lines.push(`| ${pkg} | ${metric} | ${pct(baseline?.[pkg], metric)} → ${pct(after?.[pkg], metric)} |`);
    }
  }
  lines.push('', `<sub>[Workflow run](${runUrl}) · updated on every push</sub>`);
  return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2];
  const load = (...path) => (existsSync(join(dir, ...path)) ? JSON.parse(readFileSync(join(dir, ...path), 'utf8')) : null);
  const both = (folder) => Object.fromEntries(PACKAGES.map((pkg) => [pkg, load(folder, `${pkg}.json`)]));
  console.log(renderComment({
    report: load('report.json'),
    verify: load('verify.json'),
    baseline: both('baseline'),
    after: both('after'),
    runUrl: process.env.RUN_URL ?? '',
    pushed: process.env.PUSHED === 'true',
  }));
}
