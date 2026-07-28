import * as fs from "node:fs";
import * as path from "node:path";

export type LocaleMap = Map<string, unknown>;

export interface LocaleData {
  locales: Record<string, LocaleMap>;
  keyToLocales: Map<string, string[]>;
  allKeys: Set<string>;
  localeNames: string[];
}

export function flatten(obj: unknown, prefix: string, out: LocaleMap): void {
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else {
    out.set(prefix, obj);
  }
}

export function deleteDeep(obj: Record<string, unknown>, dottedPath: string): void {
  const parts = dottedPath.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]];
    if (!next || typeof next !== "object") return;
    cur = next as Record<string, unknown>;
  }
  delete cur[parts[parts.length - 1]];
}

export function pruneEmptyObjects(obj: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      pruneEmptyObjects(v as Record<string, unknown>);
      if (Object.keys(v).length === 0) delete obj[k];
    }
  }
}

export function loadLocales(messagesDir: string): LocaleData {
  const locales: Record<string, LocaleMap> = {};
  const keyToLocales = new Map<string, string[]>();
  for (const f of fs.readdirSync(messagesDir)) {
    if (!f.endsWith(".json")) continue;
    const locale = f.replace(/\.json$/, "");
    const map: LocaleMap = new Map();
    flatten(JSON.parse(fs.readFileSync(path.join(messagesDir, f), "utf8")), "", map);
    locales[locale] = map;
    for (const k of map.keys()) {
      if (!keyToLocales.has(k)) keyToLocales.set(k, []);
      keyToLocales.get(k)!.push(locale);
    }
  }
  return {
    locales,
    keyToLocales,
    allKeys: new Set(keyToLocales.keys()),
    localeNames: Object.keys(locales),
  };
}
