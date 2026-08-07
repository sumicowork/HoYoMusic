import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

interface NodeRow { id: number; category_id: number; parent_id: number | null; name: string; en_name: string | null; translation_status: string; }
interface CatRow { id: number; name: string; en_name: string | null; }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function main() {
  await client.connect();
  const games = await client.query(`select id, name from games where id in (1,2) order by id`);
  const cats = await client.query(
    `select id, name, en_name, game_id from music_source_categories where game_id in (1,2) order by game_id, display_order, name`
  );
  const nodes = await client.query(
    `select id, category_id, parent_id, name, en_name, translation_status
     from music_source_nodes where game_id in (1,2) order by category_id, display_order, name`
  );
  const tms = await client.query(`select count(*)::int as c from track_music_sources`);
  const tmsCount = Number(tms.rows[0].c);

  const catsByGame = new Map<number, CatRow[]>();
  for (const c of cats.rows) {
    if (!catsByGame.has(c.game_id)) catsByGame.set(c.game_id, []);
    catsByGame.get(c.game_id)!.push({ id: c.id, name: c.name, en_name: c.en_name });
  }

  const nodesByCat = new Map<number, NodeRow[]>();
  for (const n of nodes.rows) {
    if (!nodesByCat.has(n.category_id)) nodesByCat.set(n.category_id, []);
    nodesByCat.get(n.category_id)!.push(n);
  }

  // build tree per category
  const renderTree = (list: NodeRow[]): string => {
    const byId = new Map<number, NodeRow>();
    for (const n of list) byId.set(n.id, n);
    const childrenOf = new Map<number | null, NodeRow[]>();
    for (const n of list) {
      const k = n.parent_id && byId.has(n.parent_id) ? n.parent_id : null;
      if (!childrenOf.has(k)) childrenOf.set(k, []);
      childrenOf.get(k)!.push(n);
    }
    const walk = (pid: number | null, depth: number): string => {
      const kids = childrenOf.get(pid) || [];
      if (!kids.length) return '';
      let html = '<ul>';
      for (const n of kids) {
        const sub = walk(n.id, depth + 1);
        const en = n.en_name && n.en_name !== n.name ? `<span class="en">${esc(n.en_name)}</span>` : '';
        const badge = n.translation_status === 'translated'
          ? '<span class="badge ok">译</span>'
          : '<span class="badge pend">待译</span>';
        if (sub) {
          html += `<li><details><summary>${badge}<span class="zh">${esc(n.name)}</span>${en}</summary>${sub}</details></li>`;
        } else {
          html += `<li>${badge}<span class="zh">${esc(n.name)}</span>${en}</li>`;
        }
      }
      html += '</ul>';
      return html;
    };
    return walk(null, 0);
  };

  let sections = '';
  let gtrans = 0, gpend = 0, htrans = 0, hpend = 0;
  for (const g of games.rows) {
    const gid = g.id;
    const isG = gid === 1;
    const clist = catsByGame.get(gid) || [];
    let blocks = '';
    for (const c of clist) {
      const list = nodesByCat.get(c.id) || [];
      const trans = list.filter(n => n.translation_status === 'translated').length;
      const pend = list.length - trans;
      if (isG) { gtrans += trans; gpend += pend; } else { htrans += trans; hpend += pend; }
      const tree = renderTree(list);
      blocks += `<div class="cat">
        <h3>${esc(c.en_name || c.name)} <span class="muted">(${esc(c.name)})</span>
          <span class="count">${list.length} 节点 · ${trans} 译 / ${pend} 待译</span></h3>
        ${tree}
      </div>`;
    }
    sections += `<section><h2>游戏 ${gid}：${esc(g.name)}</h2>${blocks}</section>`;
  }

  const html = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>音乐来源场景树预览（验收用）</title>
<style>
  body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;background:#f6f7f9;color:#1f2329}
  header{background:#2b3a55;color:#fff;padding:18px 24px}
  header h1{margin:0 0 6px;font-size:20px}
  .meta{font-size:13px;opacity:.9}
  .warn{background:#fff4e5;border:1px solid #ffd591;color:#7a4b00;padding:10px 14px;margin:14px 24px;border-radius:8px;font-size:13px}
  .summary{display:flex;gap:18px;flex-wrap:wrap;padding:6px 24px 0}
  .card{background:#fff;border:1px solid #e3e6eb;border-radius:10px;padding:12px 16px;min-width:150px}
  .card b{font-size:22px;display:block}
  .card span{font-size:12px;color:#666}
  section{padding:8px 24px 24px}
  h2{font-size:17px;border-left:4px solid #2b3a55;padding-left:8px;margin-top:24px}
  .cat{background:#fff;border:1px solid #e3e6eb;border-radius:10px;padding:12px 16px;margin:12px 0}
  .cat h3{margin:0 0 8px;font-size:15px}
  .count{font-size:12px;color:#888;font-weight:normal;margin-left:8px}
  ul{list-style:none;padding-left:18px;margin:4px 0}
  li{margin:2px 0;line-height:1.5}
  details>summary{cursor:pointer;list-style:none}
  details>summary::-webkit-details-marker{display:none}
  details>summary::before{content:"▸ ";color:#2b3a55}
  details[open]>summary::before{content:"▾ "}
  .zh{font-weight:500}
  .en{color:#8a94a6;font-size:12px;margin-left:6px}
  .badge{font-size:11px;padding:1px 6px;border-radius:10px;margin-right:5px;vertical-align:middle}
  .badge.ok{background:#e6f7ec;color:#1a7f43}
  .badge.pend{background:#fdeede;color:#a06200}
  .muted{color:#999;font-weight:normal;font-size:13px}
</style></head>
<body>
<header><h1>音乐来源 · 场景树预览（数据验收用）</h1>
<div class="meta">生成时间 ${new Date().toLocaleString('zh-CN')} · 数据源：本地调试库 hoyomusic_import · 仅展示层级与翻译，不含曲库连线</div></header>
<div class="warn">⚠️ 已知缺口：<b>track_music_sources（曲↔场景边表）= ${tmsCount} 条</b>。所以本预览<b>只验证树形结构与中文翻译</b>；
点击地点后"显示哪些歌"的功能要等补完边表才能验收。树本身已落库且经脚本校验（无中文泄漏 / 无空值 / 无孤儿节点）。</div>
<div class="summary">
  <div class="card"><b>${gtrans + gpend}</b><span>原神 节点</span></div>
  <div class="card"><b style="color:#1a7f43">${gtrans}</b><span>原神 已译</span></div>
  <div class="card"><b style="color:#a06200">${gpend}</b><span>原神 待译</span></div>
  <div class="card"><b>${htrans + hpend}</b><span>星铁 节点</span></div>
  <div class="card"><b style="color:#1a7f43">${htrans}</b><span>星铁 已译</span></div>
  <div class="card"><b style="color:#a06200">${hpend}</b><span>星铁 待译</span></div>
</div>
${sections}
</body></html>`;

  const out = path.join(__dirname, 'out', 'music_source_tree_preview.html');
  fs.writeFileSync(out, html, 'utf8');
  console.log('wrote', out, '(', html.length, 'bytes )');
  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
