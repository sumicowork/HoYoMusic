/**
 * Drift-detector test.
 *
 * When TEST_DATABASE_URL is set, connects to a live Postgres database and
 * verifies that every real table referenced in the backend SQL (FROM/JOIN/
 * INTO/UPDATE) actually exists in the public schema. CTE aliases defined in
 * the same source (WITH x AS (...)) are NOT treated as missing tables.
 *
 * When TEST_DATABASE_URL is NOT set, the test is skipped (does not fail) so
 * the suite stays green in environments without a database.
 */
import { test, expect } from 'vitest';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(__dirname, '..', 'src');
const TABLE_KW = ['FROM', 'JOIN', 'INTO', 'UPDATE'];
// Words that may legitimately follow a table keyword but are NOT tables.
// Includes set-returning functions and common SQL keywords to avoid false
// positives from comments / non-SQL text.
const STOPWORDS = new Set([
  'lateral',
  'unnest',
  'values',
  'generate_series',
  'json',
  'jsonb',
  'information_schema',
  'pg_catalog',
  'coalesce',
  'ts',
  'select',
  'insert',
  'update',
  'delete',
  'set',
  'from',
  'join',
  'into',
  'where',
  'and',
  'or',
  'on',
  'as',
  'by',
  'order',
  'group',
  'having',
  'limit',
  'offset',
  'distinct',
  'case',
  'when',
  'then',
  'else',
  'end',
  'null',
  'not',
  'in',
  'exists',
  'between',
  'like',
  'ilike',
  'true',
  'false',
  'default',
  'returning',
  'using',
  'natural',
  'cross',
  'inner',
  'left',
  'right',
  'full',
  'outer',
  'union',
  'all',
  'intersect',
  'except',
  'with',
  'recursive',
  'array',
  'cast',
  'with',
]);

/** Recursively collect *.ts files under a directory. */
function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Extract real table references (FROM/JOIN/INTO/UPDATE targets). */
function extractTableRefs(sql: string): Set<string> {
  const refs = new Set<string>();
  const re = new RegExp(
    `\\b(?:${TABLE_KW.join('|')})\\s+(?:public\\.)?["\`]?([a-z_][a-z0-9_]*)["\`]?`,
    'gi'
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const name = m[1].toLowerCase(); // `i` flag preserves case; normalize it
    // Skip set-returning functions / subqueries like FROM unnest(...)
    const rest = sql.slice(m.index + m[0].lastIndexOf(name) + name.length);
    if (/^\s*[("`]/.test(rest)) continue;
    if (STOPWORDS.has(name)) continue;
    refs.add(name);
  }
  return refs;
}

/** Extract CTE aliases (name AS (...) — covers multi-CTE WITH clauses). */
function extractCteNames(sql: string): Set<string> {
  const ctes = new Set<string>();
  const re = /\b(\w+)\s+AS\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    ctes.add(m[1]);
  }
  return ctes;
}

/**
 * Pull only SQL-bearing string/template literals out of a .ts file.
 * This avoids matching FROM/JOIN/etc. that appear in comments or plain JS code,
 * which would create false-positive "missing table" reports.
 */
function extractSqlCorpus(source: string): string {
  // Strip block and line comments first (incl. SQL -- comments inside strings).
  const noComments = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/--[^\n]*/g, ' ');

  // Match single-quoted, double-quoted, and backtick template literals.
  const strRe = /(['"`])(?:\\.|(?!\1)[^\\])*\1/g;
  let m: RegExpExecArray | null;
  const parts: string[] = [];
  while ((m = strRe.exec(noComments))) {
    const content = m[0].slice(1, -1); // drop surrounding quotes
    // A string is SQL if it begins with a statement verb (case-insensitive),
    // or contains an UPPERCASE clause keyword. Requiring uppercase for the
    // clause keywords avoids treating prose like 'from HoYoMusic' / 'from OSS'
    // (which is lowercased) as SQL. Real SQL in this codebase is upper-cased.
    const looksSql =
      /^\s*(select|insert|with|create|alter|drop|delete|begin|call|merge|replace)\b/i.test(
        content
      ) ||
      /\b(FROM|JOIN|INTO|SET|VALUES|WHERE|RETURNING|GROUP BY|ORDER BY|HAVING|ON CONFLICT)\b/.test(
        content
      );
    if (looksSql) {
      parts.push(content);
    }
  }
  return parts.join('\n');
}

test('drift: referenced SQL tables exist in the database', async () => {
  const dbUrl = process.env.TEST_DATABASE_URL;
  if (!dbUrl) {
    console.warn(
      '\n⏭️  Skipping drift test: TEST_DATABASE_URL is not set.\n' +
        '   Set it to a live Postgres connection string to enable schema drift detection.\n'
    );
    return; // skip — do not fail when no DB is configured
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    // (a) Live schema: all base tables in the public schema.
    const tableRes = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    const realTables = new Set(tableRes.rows.map((r) => r.table_name));

    // (b) Static scan of src for table refs + CTE aliases.
    const files = collectTsFiles(SRC_DIR);
    const referenced = new Set<string>();
    const ctes = new Set<string>();
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const sql = extractSqlCorpus(content);
      for (const ref of extractTableRefs(sql)) referenced.add(ref);
      for (const cte of extractCteNames(sql)) ctes.add(cte);
    }

    // (c) Determine missing real tables (excluding CTE aliases & system catalogs).
    const missing = [...referenced].filter((name) => {
      if (realTables.has(name)) return false; // exists in DB
      if (ctes.has(name)) return false; // it's a CTE alias, not a missing table
      if (name.startsWith('pg_')) return false; // system catalog
      return true;
    });

    // Report
    console.log('\n📊 Drift report:');
    console.log(`   Scanned ${files.length} source file(s) under src/.`);
    console.log(`   Live public tables: ${realTables.size}`);
    console.log(`   Distinct table references found: ${referenced.size}`);
    console.log(
      `   CTE aliases excluded: ${[...ctes].sort().join(', ') || '(none)'}`
    );
    const realRefs = [...referenced].filter(
      (n) => realTables.has(n) || ctes.has(n)
    );
    console.log(`   Resolved references: ${realRefs.sort().join(', ') || '(none)'}`);
    if (missing.length > 0) {
      console.error(`   ❌ Missing tables: ${missing.sort().join(', ')}`);
    } else {
      console.log('   ✅ No missing tables — schema is in sync.');
    }

    expect(missing, `Referenced tables missing from DB: ${missing.join(', ')}`).toEqual(
      []
    );
  } finally {
    await client.end();
  }
});
