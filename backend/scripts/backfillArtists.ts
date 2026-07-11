/**
 * Idempotent backfill: materialize the `artists` entity table from the
 * free-text `track_credits.credit_value` strings, then link every credit row
 * to its canonical artist via `track_credits.artist_id`.
 *
 * De-duplication:
 *   - Each distinct credit_value becomes one artist (its canonical name).
 *   - `artist_aliases(canonical_name, alias_name)` is honored: any credit_value
 *     that equals an `alias_name` is merged into the artist whose name is the
 *     corresponding `canonical_name`.
 *
 * Re-runnable: existing artists are matched by name, missing ones are inserted,
 * and track_credits.artist_id is only updated when it differs (no churn).
 *
 * Run with: npm run backfill:artists   (or: npx ts-node scripts/backfillArtists.ts)
 */
import 'dotenv/config';
import { Client } from 'pg';

function getConnectionConfig() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'hoyomusic',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  };
}

function slugify(name: string, id: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'artist'}-${id}`;
}

async function main() {
  const client = new Client(getConnectionConfig());
  await client.connect();
  console.log('🔌 Connected for artist backfill.');

  try {
    // 1. Distinct credit values
    const valsRes = await client.query<{ credit_value: string }>(
      `SELECT DISTINCT credit_value FROM track_credits
       WHERE credit_value IS NOT NULL AND credit_value <> ''`
    );
    const values = valsRes.rows.map((r) => r.credit_value);
    console.log(`📋 ${values.length} distinct credit values.`);

    // 2. Alias map (alias_name -> canonical_name), case-insensitive keys
    const aliasRes = await client.query<{ canonical_name: string; alias_name: string }>(
      `SELECT canonical_name, alias_name FROM artist_aliases`
    );
    const aliasToCanonical = new Map<string, string>();
    for (const row of aliasRes.rows) {
      aliasToCanonical.set(row.alias_name.trim().toLowerCase(), row.canonical_name.trim());
    }
    console.log(`🔗 ${aliasToCanonical.size} alias rules loaded.`);

    // 3. Existing artists (name -> id)
    const existingRes = await client.query<{ id: number; name: string }>(
      `SELECT id, name FROM artists`
    );
    const nameToId = new Map<string, number>();
    for (const row of existingRes.rows) {
      nameToId.set(row.name.trim().toLowerCase(), row.id);
    }
    console.log(`📦 ${nameToId.size} existing artists.`);

    // 4. Resolve the target canonical name for every credit value
    const targetForValue = new Map<string, string>();
    for (const v of values) {
      const key = v.trim().toLowerCase();
      const target = aliasToCanonical.get(key) ?? v.trim();
      targetForValue.set(v, target);
    }

    // 5. Insert artists for any target not yet present
    let inserted = 0;
    const neededTargets = Array.from(new Set(Array.from(targetForValue.values())));
    for (const target of neededTargets) {
      const key = target.toLowerCase();
      if (nameToId.has(key)) continue;
      const ins = await client.query<{ id: number }>(
        `INSERT INTO artists (name, slug, type, created_at, updated_at)
         VALUES ($1, NULL, 'person', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`,
        [target]
      );
      const id = ins.rows[0].id;
      nameToId.set(key, id);
      inserted++;
    }
    if (inserted) console.log(`➕ Inserted ${inserted} new artists.`);

    // 6. Fix slugs (unique: base-name + id)
    const allArtists = await client.query<{ id: number; name: string; slug: string | null }>(
      `SELECT id, name, slug FROM artists`
    );
    let slugFixed = 0;
    for (const a of allArtists.rows) {
      if (a.slug) continue;
      const slug = slugify(a.name, a.id);
      await client.query(`UPDATE artists SET slug = $1 WHERE id = $2`, [slug, a.id]);
      slugFixed++;
    }
    if (slugFixed) console.log(`🏷️  Fixed ${slugFixed} slugs.`);

    // 7. Link every credit row to its artist (only when it changes)
    let linked = 0;
    for (const v of values) {
      const artistId = nameToId.get(targetForValue.get(v)!.toLowerCase());
      if (artistId == null) continue;
      const upd = await client.query(
        `UPDATE track_credits SET artist_id = $1
         WHERE credit_value = $2 AND artist_id IS DISTINCT FROM $1`,
        [artistId, v]
      );
      linked += upd.rowCount ?? 0;
    }
    console.log(`🔗 Linked ${linked} credit rows to artists.`);

    // 8. Report
    const counts = await client.query(
      `SELECT
         (SELECT COUNT(*) FROM artists) AS artists,
         (SELECT COUNT(*) FROM track_credits WHERE artist_id IS NOT NULL) AS linked_credits,
         (SELECT COUNT(*) FROM track_credits) AS total_credits`
    );
    console.log('📊', counts.rows[0]);
    console.log('🎉 Artist backfill complete.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Artist backfill failed:', err);
  process.exit(1);
});
