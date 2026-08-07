import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  // columns of music_source_nodes
  const cols = (await client.query(`select column_name, data_type from information_schema.columns where table_name='music_source_nodes' order by ordinal_position`)).rows;
  console.log('=== music_source_nodes columns ===');
  console.log(cols.map((c:any)=>`${c.column_name}:${c.data_type}`).join('\n'));
  // a few translated rows to mirror format
  const samp = (await client.query(`select id,name,en_name,translation_status from music_source_nodes where translation_status='translated' and game_id=2 limit 5`)).rows;
  console.log('\n=== sample translated HSR rows ===');
  for (const r of samp) console.log(`  #${r.id} name=${JSON.stringify(r.name)} | en=${JSON.stringify(r.en_name)} | st=${r.translation_status}`);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
