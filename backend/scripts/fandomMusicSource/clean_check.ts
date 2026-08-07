import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main(){
  await client.connect();
  const nulls = await client.query(`select count(*) c from music_source_nodes where name is null or name='' or en_name is null or en_name=''`);
  const statusNull = await client.query(`select count(*) c from music_source_nodes where translation_status is null`);
  const catNull = await client.query(`select count(*) c from music_source_categories where name is null or en_name is null`);
  const orphanParent = await client.query(`select count(*) c from music_source_nodes n left join music_source_nodes p on p.id=n.parent_id where n.parent_id is not null and p.id is null`);
  console.log('nodes with null/empty name or en_name :', nulls.rows[0].c);
  console.log('nodes with null translation_status   :', statusNull.rows[0].c);
  console.log('categories with null name/en_name     :', catNull.rows[0].c);
  console.log('nodes referencing missing parent_id   :', orphanParent.rows[0].c);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
