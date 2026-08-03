const https = require('https');
const { Client } = require('pg');
require('dotenv').config({ path: '/opt/hoyomusic/.env' });

function countCredits(lines) {
  return lines.filter(l => {
    const m = l.match(/^\[\d{2}:\d{2}\.\d{2,3}\]\s*(.+)/);
    if (!m) return false;
    const txt = m[1];
    return /(作词|作曲|编曲|制作人|混音师?|母带|录音|出品|吉他|钢琴|弦乐|和声|人声|乐器|演唱者?|Lyricist|Composer|Arranger|Producer|Mixing|Mastering|Recording|Engineer|Vocal|Guitar|Piano|Strings|Backing|Lyrics|Music|Orchestra|Copyist)/i.test(txt) && txt.length < 60;
  });
}

(async () => {
  const db = new Client({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
  await db.connect();
  const {rows} = await db.query("SELECT id, title, lyrics_path FROM tracks WHERE lyrics_status='has' ORDER BY random() LIMIT 15");
  console.log('Sampling', rows.length, 'random tracks...\n');

  let totalMixed = 0;
  let totalClean = 0;
  for (const t of rows) {
    try {
      const url = t.lyrics_path.startsWith('/lyrics/')
        ? 'https://api.music.hoyodb.com/api' + t.lyrics_path
        : t.lyrics_path;
      const buf = await new Promise((r, rej) => {
        https.get(url, res => { let d=[]; res.on('data',c=>d.push(c)); res.on('end',()=>r(Buffer.concat(d))); }).on('error', rej);
      });
      const text = buf.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(l => /^\[\d{2}:\d{2}\.\d{2,3}\]/.test(l));
      const credits = countCredits(lines);
      if (credits.length === 0) {
        console.log('CLEAN  #'+t.id, t.title.slice(0,35), '('+lines.length+' lines)');
        totalClean++;
      } else {
        console.log('MIXED  #'+t.id, t.title.slice(0,35), '('+lines.length+' lines, '+credits.length+' credits)');
        credits.slice(0,3).forEach(c => console.log('       ', c.trim().slice(0,70)));
        totalMixed++;
      }
    } catch(e) {
      console.log('ERROR  #'+t.id, t.title.slice(0,30), e.message.slice(0,50));
    }
  }
  console.log('\nClean:', totalClean, 'Mixed:', totalMixed);
  await db.end();
})();
