/**
 * Auth schema drift guard.
 *
 * Prevents consumer `prisma db push` from silently dropping auth identity
 * columns. The auth schema (User/Session/Account/Verification) is owned by the
 * auth host (learn-everything); every consumer keeps a mirror in schema.prisma
 * and must never push auth DDL. This script diffs the consumer's auth mirror
 * against the actual auth schema in the dev DB and refuses to proceed on
 * identity-column drift.
 *
 * What counts (identity):
 *   - scalar field name
 *   - mapped DB type
 *   - nullability
 *   - default
 *   - single-column uniqueness (scalar @unique, single-col @@unique, or @id PK)
 *
 * What is intentionally ignored:
 *   - relation fields (each consumer's User mirror carries its own
 *     back-relations pointing at consumer-owned tables; cross-repo divergence
 *     is normal and NOT drift).
 *
 * DB side: `information_schema.columns` + `pg_index` for the `auth` schema.
 * Schema side: regex parse of `prisma/schema.prisma` for the 4 auth models,
 * restricted to scalar (non-relation) fields.
 *
 * Exit 0 = in sync; exit 1 = drift or error.
 */
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "pg";

const SCHEMA_FILE = path.join(process.cwd(), "prisma/schema.prisma");
const AUTH_SCHEMA = "auth";

// Order is stable for diff output. Maps Prisma model name → DB table name.
const AUTH_MODELS: ReadonlyArray<{ model: string; table: string }> = [
  { model: "User", table: "user" },
  { model: "Session", table: "session" },
  { model: "Account", table: "account" },
  { model: "Verification", table: "verification" },
];

// Prisma scalar type → canonical DB data_type token (matches
// information_schema.columns.data_type for Postgres + Prisma 7 defaults).
const SCALAR_TO_DB: Record<string, string> = {
  String: "text",
  Int: "integer",
  BigInt: "bigint",
  Float: "double precision",
  Decimal: "numeric",
  Boolean: "boolean",
  DateTime: "timestamp without time zone",
  Json: "json",
  Bytes: "bytea",
};

// Refine dbType when a @db.X modifier is present. Only the modifiers used in
// this workspace are mapped; unknown modifiers leave the base mapping intact.
const DB_MODIFIER_OVERRIDES: Record<string, string> = {
  Text: "text",
  Int: "integer",
  Int4: "integer",
  Int8: "bigint",
  Smallint: "smallint",
  Boolean: "boolean",
  Timestamptz: "timestamp with time zone",
  Timestamp: "timestamp without time zone",
  Json: "json",
  Jsonb: "jsonb",
};

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default: string;
  unique: boolean;
}

// -----------------------------------------------------------------------------
// Schema side: parse prisma/schema.prisma
// -----------------------------------------------------------------------------

function parseSchema(): Map<string, Column[]> {
  const src = fs.readFileSync(SCHEMA_FILE, "utf8");
  const out = new Map<string, Column[]>();

  for (const { model } of AUTH_MODELS) {
    const blockRe = new RegExp(`model\\s+${model}\\s*\\{([\\s\\S]*?)\\n\\}`);
    const m = blockRe.exec(src);
    if (!m) {
      throw new Error(`Model ${model} not found in ${SCHEMA_FILE}`);
    }
    const body = m[1];

    if (!/@@schema\(\s*"auth"\s*\)/.test(body)) {
      throw new Error(
        `Model ${model} is missing @@schema("auth"); cannot treat it as an auth model.`
      );
    }

    // Collect single-column @@unique(...) entries. Composite @@unique is
    // intentionally ignored — identity columns are scalar-uniqueness only.
    const blockUniqueCols = new Set<string>();
    const blockUniqueRe = /@@unique\(\s*\[([^\]]+)\]\s*(?:,[^)]*)?\)/g;
    let bum: RegExpExecArray | null;
    while ((bum = blockUniqueRe.exec(body)) !== null) {
      const cols = bum[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (cols.length === 1) blockUniqueCols.add(cols[0]);
    }

    const cols: Column[] = [];
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;

      // Field line shape:  name Type?   @attr @attr ...
      // Skip lines that don't look like a field declaration.
      const fieldMatch = /^(\w+)\s+([\w.]+\??)(\s+|$)/.exec(line);
      if (!fieldMatch) continue;
      const [, name, typeRaw] = fieldMatch;

      // List-typed (e.g. `Deck[]`) → relation, skip.
      if (typeRaw.endsWith("[]")) continue;
      // @relation → relation field, skip.
      if (line.includes("@relation")) continue;

      const isNullable = typeRaw.endsWith("?");
      const baseType = typeRaw.replace(/\?$/, "").replace(/^.*\.(\w+)$/, "$1");
      // Only Prisma scalar types count as identity columns. Custom/Model
      // types here would be relations without @relation (e.g. `User?`).
      if (!(baseType in SCALAR_TO_DB)) continue;

      let dbType = SCALAR_TO_DB[baseType];
      const dbAttrMatch = /@db\.(\w+)/.exec(line);
      if (dbAttrMatch && dbAttrMatch[1] in DB_MODIFIER_OVERRIDES) {
        dbType = DB_MODIFIER_OVERRIDES[dbAttrMatch[1]];
      }

      // Default extraction. Allow one level of nested parens so `now()` and
      // `autoincrement()` round-trip intact. @updatedAt alone carries no DB
      // default (the Prisma client handles the write).
      let def = "";
      const defMatch = /@default\(\s*((?:[^()]|\([^)]*\))*)\s*\)/.exec(line);
      if (defMatch) {
        def = normalizeSchemaDefault(defMatch[1]);
      }

      // Uniqueness: scalar @unique, single-col @@unique, or @id (PK is unique).
      const isUnique = /@unique\b/.test(line) || blockUniqueCols.has(name) || /@id\b/.test(line);

      cols.push({
        name,
        type: dbType,
        nullable: isNullable,
        default: def,
        unique: isUnique,
      });
    }
    out.set(model, cols);
  }
  return out;
}

function normalizeSchemaDefault(raw: string): string {
  const v = raw.trim();
  if (v === "now()") return "CURRENT_TIMESTAMP";
  if (v === "autoincrement()") return "__autoincrement__";
  // Prisma string defaults are written as `"..."`; DB casts to `'<value>'::text`.
  const strMatch = /^"(.*)"$/.exec(v);
  if (strMatch) return `'${strMatch[1]}'`;
  // Boolean / numeric / enum-fallback are emitted verbatim by Postgres.
  return v;
}

// -----------------------------------------------------------------------------
// DB side: information_schema.columns + pg_index
// -----------------------------------------------------------------------------

async function fetchDbColumns(): Promise<Map<string, Column[]>> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const cols = await client.query(
      `SELECT table_name, column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = $1
        ORDER BY table_name, ordinal_position`,
      [AUTH_SCHEMA]
    );

    // Single-column UNIQUE indexes (covers both @unique and PK). We treat any
    // single-column unique index as `unique=true` because the identity contract
    // is "this column is unique in the auth host DB".
    const uniq = await client.query(
      `SELECT c.relname AS table_name, a.attname AS column_name
         FROM pg_index i
         JOIN pg_class c       ON c.oid = i.indrelid
         JOIN pg_namespace n   ON n.oid = c.relnamespace
         JOIN pg_attribute a   ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
        WHERE n.nspname = $1
          AND i.indisunique
          AND array_length(i.indkey::smallint[], 1) = 1`,
      [AUTH_SCHEMA]
    );

    const uniqueByTable = new Map<string, Set<string>>();
    for (const row of uniq.rows) {
      let set = uniqueByTable.get(row.table_name);
      if (!set) {
        set = new Set();
        uniqueByTable.set(row.table_name, set);
      }
      set.add(row.column_name);
    }

    const byTable = new Map<string, Column[]>();
    for (const row of cols.rows) {
      let arr = byTable.get(row.table_name);
      if (!arr) {
        arr = [];
        byTable.set(row.table_name, arr);
      }
      arr.push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === "YES",
        default: normalizeDbDefault(row.column_default),
        unique: uniqueByTable.get(row.table_name)?.has(row.column_name) ?? false,
      });
    }
    return byTable;
  } finally {
    await client.end();
  }
}

function normalizeDbDefault(raw: string | null): string {
  if (raw === null || raw === "") return "";
  // Strip PG type casts: `'foo'::text`, `false::boolean`, `0::numeric`, etc.
  const stripped = raw.replace(/::[\w ]+(\([^)]*\))?/g, "").trim();
  if (/^now\(\)$/i.test(stripped) || /^current_timestamp$/i.test(stripped)) {
    return "CURRENT_TIMESTAMP";
  }
  if (stripped.startsWith("nextval(")) return "__autoincrement__";
  return stripped;
}

// -----------------------------------------------------------------------------
// Diff
// -----------------------------------------------------------------------------

function diffModel(model: string, schemaCols: Column[], dbCols: Column[]): string[] {
  const schemaMap = new Map(schemaCols.map((c) => [c.name, c]));
  const dbMap = new Map(dbCols.map((c) => [c.name, c]));
  const names = new Set<string>([...schemaMap.keys(), ...dbMap.keys()]);
  const out: string[] = [];

  for (const name of names) {
    const s = schemaMap.get(name);
    const d = dbMap.get(name);
    if (!s) {
      out.push(
        `  ${model}.${name}: exists in DB only — auth mirror in schema.prisma is missing this identity column`
      );
      continue;
    }
    if (!d) {
      out.push(
        `  ${model}.${name}: exists in schema.prisma only — DB auth.${model.toLowerCase()} is missing this column (a db push would drop it)`
      );
      continue;
    }
    if (s.type !== d.type) {
      out.push(`  ${model}.${name}.type:     schema=${s.type} | db=${d.type}`);
    }
    if (s.nullable !== d.nullable) {
      out.push(`  ${model}.${name}.nullable: schema=${s.nullable} | db=${d.nullable}`);
    }
    const sDef = s.default || "(none)";
    const dDef = d.default || "(none)";
    if (sDef !== dDef) {
      out.push(`  ${model}.${name}.default:  schema=${sDef} | db=${dDef}`);
    }
    if (s.unique !== d.unique) {
      out.push(`  ${model}.${name}.unique:   schema=${s.unique} | db=${d.unique}`);
    }
  }
  return out;
}

// -----------------------------------------------------------------------------

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("FAIL: DATABASE_URL is not set (expected dev DB).");
    process.exit(1);
  }
  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error(`FAIL: schema file not found at ${SCHEMA_FILE}`);
    process.exit(1);
  }

  const schemaCols = parseSchema();
  const dbCols = await fetchDbColumns();

  const diffs: string[] = [];
  for (const { model, table } of AUTH_MODELS) {
    const s = schemaCols.get(model);
    if (!s) {
      diffs.push(`  ${model}: not parsed from schema.prisma`);
      continue;
    }
    const d = dbCols.get(table);
    if (!d || d.length === 0) {
      diffs.push(
        `  ${model}: table auth.${table} not found in DB — run the host auth migration first`
      );
      continue;
    }
    diffs.push(...diffModel(model, s, d));
  }

  if (diffs.length > 0) {
    console.error(`FAIL: auth schema drift detected (${diffs.length} difference(s)).`);
    console.error("");
    for (const line of diffs) console.error(line);
    console.error("");
    console.error("Identity columns compared only (relations intentionally ignored).");
    console.error(`  schema: prisma/schema.prisma (User/Session/Account/Verification)`);
    console.error(`  db:     ${process.env.DATABASE_URL} (schema "auth")`);
    console.error("");
    console.error(
      "Consumer rule: never push auth DDL. Refresh the mirror with `prisma db pull` first, then push consumer-owned tables only."
    );
    process.exit(1);
  }

  console.log(
    "PASS: auth schema in sync — 4 auth models' identity columns match DB (relations ignored)."
  );
}

main().catch((e: unknown) => {
  console.error(`FAIL: guard crashed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  process.exit(1);
});
