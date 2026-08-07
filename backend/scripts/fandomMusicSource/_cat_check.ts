import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  const cats = (await client.query(`select id, game_id, name, en_name from music_source_categories where game_id=2 order by id`)).rows;
  console.log('=== HSR categories (game 2) ===');
  for (const c of cats) console.log(`  id=${c.id} name=${JSON.stringify(c.name)} en_name=${JSON.stringify(c.en_name)}`);
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
