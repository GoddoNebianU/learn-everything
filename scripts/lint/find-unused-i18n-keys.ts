/**
 * i18n lint — dead keys + translation completeness for messages/*.json.
 *
 * A. Dead-key analysis (AST-based, CONSERVATIVE — never flags a live key
 *    as dead): flatten locale JSONs to dot-path keys; parse src/.ts/.tsx
 *    for useTranslations/getTranslations bindings; a key is "used" if any
 *    literal X("key") call matches ns+"."+key. Unused = defined − used.
 *    Dynamic-key sites (t(variable)) can't be resolved and are reported.
 * B. Completeness: every locale must define the union of keys with a
 *    non-empty value. Missing keys and empty placeholders (null/""/ws)
 *    fail under --check and are NEVER baselined.
 *
 * Modes:
 *   --check            CI gate (exit 1 on any regression)
 *   --update-baseline  grow the unused-key baseline
 *   --delete-unused    remove unused keys from all locales + clear baseline
 * (run from project root)
 *
 * AST analysis lives in ./i18n/ast-analyzer, JSON helpers in ./i18n/json-utils.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { analyzeCodeReferences } from "./i18n/ast-analyzer";
import { deleteDeep, loadLocales, pruneEmptyObjects } from "./i18n/json-utils";

const ROOT = process.cwd();
const MESSAGES_DIR = path.join(ROOT, "messages");
const SRC_DIRS = [path.join(ROOT, "src"), path.join(ROOT, "app")].filter((d) => fs.existsSync(d));

if (!fs.existsSync(MESSAGES_DIR)) {
  console.error(`messages/ not found at ${MESSAGES_DIR} (run from project root)`);
  process.exit(1);
}
if (SRC_DIRS.length === 0) {
  console.error(`Neither src/ nor app/ found (run from project root)`);
  process.exit(1);
}

const { locales, keyToLocales, allKeys, localeNames } = loadLocales(MESSAGES_DIR);
const codeRefs = SRC_DIRS.map((d) => analyzeCodeReferences(d));
const usedKeys = new Set<string>(codeRefs.flatMap((r) => [...r.usedKeys]));
const dynamicKeySites = codeRefs.flatMap((r) => r.dynamicKeySites);
const rootNamespaceSites = codeRefs.flatMap((r) => r.rootNamespaceSites);

// ---------- results ----------
const unused = [...allKeys].filter((k) => !usedKeys.has(k)).sort();
const notInJson = [...usedKeys].filter((k) => !allKeys.has(k)).sort();

// ---------- translation completeness ----------
const missingByLocale = new Map<string, string[]>();
const emptiesByLocale = new Map<string, string[]>();
for (const loc of localeNames) {
  const missing = [...allKeys].filter((k) => !locales[loc].has(k)).sort();
  if (missing.length) missingByLocale.set(loc, missing);
  const empties: string[] = [];
  for (const [k, v] of locales[loc]) {
    if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) {
      empties.push(k);
    }
  }
  if (empties.length) emptiesByLocale.set(loc, empties.sort());
}
const totalMissing = [...missingByLocale.values()].reduce((n, ks) => n + ks.length, 0);
const totalEmpties = [...emptiesByLocale.values()].reduce((n, ks) => n + ks.length, 0);

const byNs = new Map<string, string[]>();
for (const k of unused) {
  const ns = k.split(".", 1)[0];
  if (!byNs.has(ns)) byNs.set(ns, []);
  byNs.get(ns)!.push(k);
}

const argv = new Set(process.argv.slice(2));
const BASELINE_PATH = path.join(ROOT, "scripts", "lint", "i18n-unused-baseline.json");

function loadBaseline(): Set<string> {
  if (!fs.existsSync(BASELINE_PATH)) return new Set();
  const data = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  return new Set(Array.isArray(data?.unused) ? data.unused : []);
}

const fmtLocaleKeys = (m: Map<string, string[]>) =>
  [...m.entries()].map(([loc, keys]) => `  ${loc} (${keys.length}): ${keys.join(", ")}`).join("\n");

if (argv.has("--update-baseline")) {
  fs.writeFileSync(BASELINE_PATH, JSON.stringify({ unused }, null, 2) + "\n");
  console.log(`Wrote ${unused.length} unused key(s) to ${path.relative(ROOT, BASELINE_PATH)}`);
  console.log("Commit this file to update the CI baseline.");
  process.exit(0);
}

if (argv.has("--delete-unused")) {
  if (argv.has("--check")) {
    console.error("--delete-unused cannot be combined with --check");
    process.exit(1);
  }
  for (const loc of localeNames) {
    const file = path.join(MESSAGES_DIR, `${loc}.json`);
    const o = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const k of unused) deleteDeep(o, k);
    pruneEmptyObjects(o);
    fs.writeFileSync(file, JSON.stringify(o, null, 2) + "\n");
  }
  fs.writeFileSync(BASELINE_PATH, JSON.stringify({ unused: [] }, null, 2) + "\n");
  console.log(
    `Deleted ${unused.length} unused key(s) from ${localeNames.length} locale(s) and pruned empty namespaces.`
  );
  console.log(
    `Cleared baseline at ${path.relative(ROOT, BASELINE_PATH)} — re-run with --check to confirm 0 unused.`
  );
  process.exit(0);
}

if (argv.has("--check")) {
  const baseline = loadBaseline();
  const unusedSet = new Set(unused);
  const newUnused = unused.filter((k) => !baseline.has(k));
  const staleBaseline = [...baseline].filter((k) => !unusedSet.has(k));
  const failures: string[] = [];
  if (notInJson.length)
    failures.push(
      `${notInJson.length} code reference(s) match no JSON key (typo/missing):\n  ${notInJson.join("\n  ")}`
    );
  if (totalMissing)
    failures.push(
      `${totalMissing} missing translation(s) across ${missingByLocale.size} locale(s) — key exists in some messages/*.json but not all:\n${fmtLocaleKeys(missingByLocale)}`
    );
  if (totalEmpties)
    failures.push(
      `${totalEmpties} empty translation value(s) across ${emptiesByLocale.size} locale(s) — null / "" / whitespace placeholder:\n${fmtLocaleKeys(emptiesByLocale)}`
    );
  if (dynamicKeySites.length)
    failures.push(
      `${dynamicKeySites.length} unresolved dynamic key site(s):\n  ${dynamicKeySites.join("\n  ")}`
    );
  if (rootNamespaceSites.length)
    failures.push(
      `${rootNamespaceSites.length} root-namespace useTranslations() site(s):\n  ${rootNamespaceSites.join("\n  ")}`
    );
  if (newUnused.length)
    failures.push(
      `${newUnused.length} NEW unused key(s) not in baseline:\n  ${newUnused.join("\n  ")}`
    );

  if (failures.length) {
    console.error(`FAIL: i18n check (${failures.length} regression(s))\n`);
    for (const f of failures) console.error(`- ${f}\n`);
    console.error(`Total unused: ${unused.length} (baseline: ${baseline.size})`);
    if (totalMissing || totalEmpties)
      console.error(
        `Translations: ${totalMissing} missing, ${totalEmpties} empty across ${localeNames.length} locales`
      );
    if (staleBaseline.length)
      console.error(
        `Note: ${staleBaseline.length} baseline key(s) are now used — run with --update-baseline to shrink it.`
      );
    process.exit(1);
  }
  console.log(
    `PASS: i18n check — ${unused.length} unused key(s) all in baseline, ${totalMissing} missing translation(s), ${totalEmpties} empty value(s), 0 regressions.`
  );
  if (staleBaseline.length)
    console.log(
      `Note: ${staleBaseline.length} baseline key(s) are now used (cleanup) — run with --update-baseline to shrink it.`
    );
  process.exit(0);
}

console.log(`Locales scanned: ${localeNames.length} (${localeNames.join(", ")})`);
console.log(`Distinct keys across all locales: ${allKeys.size}`);
console.log(
  `Keys referenced from code: ${usedKeys.size} (${notInJson.length} of those match no JSON key)`
);
console.log(`\n=== Translation completeness (${totalMissing} missing, ${totalEmpties} empty) ===`);
if (totalMissing) console.log(`\n${fmtLocaleKeys(missingByLocale)}`);
else console.log(`All ${localeNames.length} locales define the full ${allKeys.size}-key set.`);
if (totalEmpties)
  console.log(`\n--- empty / placeholder values ---\n${fmtLocaleKeys(emptiesByLocale)}`);

console.log(`\n=== ${unused.length} UNUSED key(s) across ${byNs.size} namespace(s) ===\n`);
for (const [ns, keys] of [...byNs.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`[${ns}]  (${keys.length})`);
  for (const k of keys) {
    const locs = keyToLocales.get(k)!;
    console.log(
      `  ${k}${locs.length === localeNames.length ? "" : `   (only in: ${locs.join(", ")})`}`
    );
  }
  console.log();
}

if (notInJson.length) {
  console.log(
    `\n=== ${notInJson.length} code reference(s) matching NO JSON key (typo or missing key) ===`
  );
  for (const k of notInJson) console.log(`  ${k}`);
}
if (dynamicKeySites.length) {
  console.log(
    `\n=== ${dynamicKeySites.length} dynamic key site(s) (CANNOT resolve — manual review) ===`
  );
  for (const s of dynamicKeySites) console.log(`  ${s}`);
}
if (rootNamespaceSites.length) {
  console.log(`\n=== ${rootNamespaceSites.length} root-namespace useTranslations() site(s) ===`);
  for (const s of rootNamespaceSites) console.log(`  ${s}`);
}
