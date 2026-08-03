import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// The 2 nodes verified to have authoritative, non-song Chinese from fandom entity pages.
// #7436 -> "匹诺康尼"  (fandom: Penacony)
// #7482 -> "星穹列车"  (fandom: Astral Express)
interface Fill { id: number; zh: string; en: string; }
const FILLS: Fill[] = [
  { id: 7436, zh: '匹诺康尼', en: 'The Reverie (Dreamscape) (Dreamwalker)' },
  { id: 7482, zh: '星穹列车', en: 'Parlor Car; Passenger Cabin; Party Car (default music in the Phonograph)' },
];

const APPLY = process.argv.includes('--apply');

const client = new Client({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

async function main() {
  await client.connect();

  // 0) pre-check: these rows must currently be pending, and en_name must match expected clean English
  const rows = (await client.query(
    'select id, name, en_name, translation_status from music_source_nodes where id = ANY($1)',
    [FILLS.map((f) => f.id)]
  )).rows;
  const byId = new Map(rows.map((r: any) => [r.id, r]));
  console.log('=== pre-check (current DB state) ===');
  for (const f of FILLS) {
    const cur = byId.get(f.id);
    if (!cur) { console.log(`  #${f.id} ❌ NOT FOUND`); process.exit(1); }
    const enOk = cur.en_name === f.en;
    const stOk = cur.translation_status === 'pending';
    console.log(`  #${f.id} cur: name=${JSON.stringify(cur.name)} st=${cur.translation_status} | en_match=${enOk} st_pending=${stOk} -> ${enOk && stOk ? 'OK to fill' : '⚠ MISMATCH'}`);
    if (!enOk || !stOk) { console.log('  ABORT: pre-check failed'); await client.end(); process.exit(1); }
  }

  if (!APPLY) {
    console.log('\n=== DRY-RUN: no changes made ===');
    for (const f of FILLS) {
      console.log(`  UPDATE #${f.id}: name ${JSON.stringify(byId.get(f.id).name)} -> ${JSON.stringify(f.zh)} ; translation_status -> 'translated' ; en_name kept=${JSON.stringify(f.en)}`);
    }
    console.log('\nRe-run with --apply to actually write (after backup).');
    await client.end();
    return;
  }

  // 1) backup full table first
  const ts = Date.now();
  const bak = `music_source_nodes_fill2_bak_${ts}`;
  await client.query(`create table ${bak} as select * from music_source_nodes`);
  console.log(`\n[backup] created ${bak} (full table snapshot)`);

  // 2) apply (parameterized)
  for (const f of FILLS) {
    const r = await client.query(
      'update music_source_nodes set name=$1, translation_status=$2, updated_at=now() where id=$3',
      [f.zh, 'translated', f.id]
    );
    console.log(`  applied #${f.id}: ${r.rowCount} row(s) -> name=${JSON.stringify(f.zh)} status=translated`);
  }

  // 3) verify
  const after = (await client.query(
    'select id, name, en_name, translation_status from music_source_nodes where id = ANY($1)',
    [FILLS.map((f) => f.id)]
  )).rows;
  console.log('\n=== post-apply verification ===');
  for (const r of after) console.log(`  #${r.id} name=${JSON.stringify(r.name)} | en=${JSON.stringify(r.en_name)} | st=${r.translation_status}`);

  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
