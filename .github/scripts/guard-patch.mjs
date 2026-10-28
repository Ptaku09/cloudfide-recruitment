// Rejects agent patches that touch anything but test files or that contain secrets.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ALLOWED = [
  /^backend\/tests\/.+\.test\.ts$/,
  /^backend\/tests\/fixture\.ts$/,
  /^frontend\/src\/.+\.test\.tsx?$/,
  /^frontend\/src\/test\/.+\.tsx?$/,
];
const SECRET = /sk-ant-[A-Za-z0-9_-]{10,}/;

export function checkPatch(patchText, token = '') {
  const violations = [];
  let file = '';
  let inHunk = false;
  for (const line of patchText.split('\n')) {
    if (line.startsWith('diff --git ')) {
      inHunk = false;
      // Quoted headers (unusual characters) are rejected rather than parsed.
      const match = /^diff --git a\/(\S+) b\/(\S+)$/.exec(line);
      if (!match) {
        violations.push(`Unparseable patch header: ${line}`);
        continue;
      }
      file = match[2];
      for (const path of new Set([match[1], match[2]])) {
        if (!ALLOWED.some((pattern) => pattern.test(path))) violations.push(`Not a test file: ${path}`);
      }
    } else if (!inHunk) {
      // Extended headers: only regular, non-executable text files are allowed.
      if (line.startsWith('@@')) inHunk = true;
      else if (/^(new file mode|new mode|deleted file mode|old mode) /.test(line) && !line.endsWith(' 100644')) {
        violations.push(`Unsupported file mode in ${file}: ${line}`);
      } else if (line === 'GIT binary patch' || line.startsWith('Binary files ')) {
        violations.push(`Binary patch for ${file}: cannot be scanned for secrets`);
      }
    } else if (line.startsWith('+')) {
      // Never echo the line itself: it may contain the secret.
      if (SECRET.test(line) || (token && line.includes(token))) violations.push(`Possible secret in an added line of ${file}`);
    }
  }
  return violations;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const violations = checkPatch(readFileSync(process.argv[2], 'utf8'), process.env.CLAUDE_CODE_OAUTH_TOKEN);
  if (violations.length) {
    console.error(`Agent patch rejected:\n${violations.map((v) => `- ${v}`).join('\n')}`);
    process.exit(1);
  }
  console.log('Agent patch touches test files only.');
}
