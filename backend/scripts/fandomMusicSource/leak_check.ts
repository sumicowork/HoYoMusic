import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main(){
  await client.connect();
  const cjk = await client.query(`select count(*) c from music_source_nodes where en_name ~ '[一-鿿]'`);
  const url = await client.query(`select count(*) c from music_source_nodes where en_name ilike '%http%' or name ilike '%http%'`);
  const slashOnly = await client.query(`select count(*) c from music_source_nodes where en_name like '%/%' and en_name not ilike '%http%' and en_name !~ '[一-鿿]'`);
  console.log('CJK inside en_name   :', cjk.rows[0].c);
  console.log('URL inside en/name   :', url.rows[0].c);
  console.log('Slash in en_name (legit English sub-names):', slashOnly.rows[0].c);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
