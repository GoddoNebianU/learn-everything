/**
 * lint:auth — every "use server" export must perform an auth check.
 *
 * Ported from learn-languages/scripts/lint/check-auth.ts. Scans `src/` for
 * files starting with a `"use server"` directive, walks each exported
 * function/const, and fails if the first WINDOW_LINES lines of its body
 * mention none of AUTH_PATTERNS. Public-by-design exports opt out with a
 * `// @public` line directly above their declaration.
 *
 * learn-everything is an auth HOST (login/signup/forgot-password/reset are
 * inherently public), so most legitimate work here is `// @public`. The
 * guard exists to catch any NEW server action that touches private/scoped
 * data without first calling auth.api.getSession.
 *
 * Run with `pnpm lint:auth` (exit 1 on any violation).
 */
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();
const WINDOW_LINES = 20;
const PUBLIC_MARKER = "// @public";

// Any of these in the function body counts as an auth check.
const AUTH_PATTERNS = [
  "auth.api.getSession",
  "getCurrentUserId",
  "requireUserId",
  "requireAdmin",
  "getApiUserId",
  "verifyAdminSession",
];

function walk(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "generated") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.ts$/.test(entry.name)) out.push(full);
  }
}

const files: string[] = [];
walk("src", files);

type Finding = { file: string; fn: string; line: number };
const findings: Finding[] = [];

for (const filePath of files) {
  const src = fs.readFileSync(filePath, "utf8");
  if (!src.startsWith('"use server"') && !src.startsWith("'use server'")) continue;

  const lines = src.split("\n");
  const fnRegex = /export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g;
  let match: RegExpExecArray | null;

  while ((match = fnRegex.exec(src)) !== null) {
    const fnName = match[1];
    const charIdx = match.index;
    let lineNum = 1;
    for (let i = 0; i < charIdx; i++) if (src[i] === "\n") lineNum++;

    const prevLine = lines[lineNum - 2]?.trim() ?? "";
    if (prevLine === PUBLIC_MARKER) continue;

    const bodyLines = lines.slice(lineNum - 1, lineNum + WINDOW_LINES).join("\n");
    const hasAuth = AUTH_PATTERNS.some((p) => bodyLines.includes(p));
    if (!hasAuth) {
      findings.push({ file: path.relative(ROOT, filePath), fn: fnName, line: lineNum });
    }
  }
}

if (findings.length > 0) {
  console.error(`FAIL: ${findings.length} server action(s) missing auth check:\n`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.fn}()`);
  console.error(`\nFix options:`);
  console.error(`  1. Call auth.api.getSession() in the function`);
  console.error(`  2. Add '${PUBLIC_MARKER}' above the export if it is intentionally public`);
  process.exit(1);
}
console.log(`PASS: all server actions have auth checks.`);
