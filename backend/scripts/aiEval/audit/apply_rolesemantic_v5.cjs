// 职务语义归一化 v5 执行脚本
// A/B/C 类精确修正 + D 类批量合并 + E 类拆分 → 重填 norm → 校验
const { Client } = require('pg');

const P = { host: 'localhost', port: 5432, user: 'sumicowork', password: 'cKj46Xyw8tfT5znQ', database: 'hoyomusic' };

async function main() {
  const client = new Client(P);
  await client.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    // ── A 类：机械 bug 修正（按 role_key 精确）──
    const exact = [
      ['１st Violin', '第一小提琴'],
      ['２nd Violin', '第二小提琴'],
      ['12弦吉他 12-String Guitar', '十二弦吉他'],
      ['A调单簧管 A Clarinet', 'A调单簧管'],
      ['降B调单簧管 B-flat Clarinet', '降B调单簧管'],
      ['降E调单簧管 E-flat Clarinet', '降E调单簧管'],
    ];
    // ── B 类：日文 → 中文 ──
    const jp = [
      ['プロデューサー', '制作人'],
      ['レコーディング・スタジオ', '录音棚'],
      ['ヴォーカル・ディレクター', '人声导演'],
      ['作詞', '作词'],
      ['編曲/Arranger', '编曲'],
    ];
    // ── C 类：繁简/异体/撇号 ──
    const cc = [
      ['萧', '箫'],
      ['萧 Xiao', '箫'],
      ['合声/Chorus', '和声'],
      ["童声合唱 Children's Choir", '童声合唱'],
      ["童声合唱指挥 Children's Choir Conductor", '童声合唱指挥'],
      ["哥伦比娅清唱 Columbina's Voice", '哥伦比娅清唱'],
      ['合声演唱', '和声演唱'],
    ];
    // 人声 Vocal Artist 精确并入演唱（主唱级）
    const vocalArtist = [['人声 Vocal Artist', '演唱']];

    for (const [k, v] of [...exact, ...jp, ...cc, ...vocalArtist]) {
      const r = await client.query('UPDATE credit_role_map SET role_norm = $2 WHERE role_key = $1', [k, v]);
      if (r.rowCount === 0) log.push(`⚠️ 映射行缺失: ${k}`);
    }
    log.push(`A/B/C/人声VocalArtist 精确修正完成`);

    // ── E 类拆分（先拆，避免被批量合并吞掉）──
    // 待拆：norm='混音母带' 4行 / key='混音 Mastering' 1行 / key='レコーディング·ミックス·エンジニア' 2行 / key='吉他贝斯鼓' 2行
    const splitRows = await client.query(`
      SELECT id, track_id, credit_key, credit_value, display_order, artist_id
      FROM track_credits
      WHERE credit_role_norm = '混音母带'
         OR credit_key = '混音 Mastering'
         OR credit_key = 'レコーディング·ミックス·エンジニア'
         OR credit_key = '吉他贝斯鼓'
      ORDER BY track_id, display_order
    `);
    log.push(`E 类待拆行: ${splitRows.rows.length}`);
    let splitCount = 0;
    for (const row of splitRows.rows) {
      const targets =
        row.credit_key === 'レコーディング·ミックス·エンジニア'
          ? ['录音师', '混音师']
          : row.credit_key === '吉他贝斯鼓'
            ? ['吉他', '贝斯', '鼓']
            : ['混音师', '母带制作']; // 混音母带 / 混音 Mastering
      // 该 track 内 display_order 后移
      await client.query(
        `UPDATE track_credits SET display_order = display_order + $1 WHERE track_id = $2 AND display_order > $3`,
        [targets.length - 1, row.track_id, row.display_order],
      );
      await client.query(`DELETE FROM track_credits WHERE id = $1`, [row.id]);
      targets.forEach((norm, i) => {
        return client.query(
          `INSERT INTO track_credits (track_id, credit_key, credit_value, credit_role_norm, display_order, artist_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [row.track_id, row.credit_key, row.credit_value, norm, row.display_order + i, row.artist_id],
        );
      });
      splitCount += targets.length;
    }
    log.push(`E 类拆分完成: ${splitRows.rows.length} 行 → ${splitCount} 行`);

    // ── D 类批量合并（按当前 role_norm 合并）──
    const merges = [
      ['混音', '混音师'], ['混音技师', '混音师'], ['混音室', '混音棚'],
      ['母带', '母带制作'], ['母带处理', '母带制作'], ['母带工程师', '母带制作'],
      ['录音', '录音师'], ['录音技师', '录音师'],
      ['曲', '作曲'], ['词', '作词'],
      ['英语作词', '英文作词'], ['演唱者', '演唱'],
      ['乐队', '乐团'], ['乐团', '乐团'], ['管弦乐团', '乐团'],
      ['尼龙吉他', '尼龙弦吉他'], ['爵士鼓', '架子鼓'],
      ['小提独奏', '小提琴独奏'], ['第一提琴', '第一小提琴'], ['第二提琴', '第二小提琴'],
      ['吉他演奏', '吉他'], ['弦乐录制', '弦乐录音'],
      ['人声录音室', '人声录音棚'], ['器乐录音棚', '乐器录音棚'],
      ['童声指挥', '童声合唱指挥'], ['童声合唱团', '童声合唱'],
      ['制作', '制作人'],
      ['歌手', '演唱'],
      ['木吉他', '民谣吉他'],
    ];
    for (const [from, to] of merges) {
      if (from === to) continue;
      const r = await client.query(
        'UPDATE credit_role_map SET role_norm = $2 WHERE role_norm = $1 AND role_norm <> role_key',
        [from, to],
      );
      // 纯中文 key（role_norm = role_key 自身）也要改
      const r2 = await client.query(
        'UPDATE credit_role_map SET role_norm = $2 WHERE role_key = $1',
        [from, to],
      );
      log.push(`合并 ${from}→${to}: ${r.rowCount + r2.rowCount} 个映射`);
    }

    // ── 重填 track_credits ──
    const refill = await client.query(`
      UPDATE track_credits tc
      SET credit_role_norm = m.role_norm
      FROM credit_role_map m
      WHERE tc.credit_key = m.role_key
        AND tc.credit_role_norm IS DISTINCT FROM m.role_norm
    `);
    log.push(`track_credits 重填: ${refill.rowCount} 行`);

    // ── 校验 ──
    const v1 = await client.query(`SELECT count(*)::int AS c FROM track_credits`);
    const v2 = await client.query(`SELECT count(*)::int AS c FROM track_credits WHERE credit_role_norm IS NULL`);
    const v3 = await client.query(`
      SELECT count(*)::int AS c FROM track_credits tc
      LEFT JOIN credit_role_map m ON m.role_key = tc.credit_key
      WHERE m.role_key IS NULL
    `);
    const v4 = await client.query(`SELECT count(DISTINCT credit_role_norm)::int AS c FROM track_credits`);
    log.push(`校验: 总数 ${v1.rows[0].c} | NULL ${v2.rows[0].c} | 无映射 ${v3.rows[0].c} | 规范名种类 ${v4.rows[0].c}`);

    // 抽查
    const sample = await client.query(`
      SELECT credit_role_norm, count(*) AS n FROM track_credits
      WHERE credit_role_norm IN ('乐团','架子鼓','原声吉他','民谣吉他','人声','演唱','和声','和声演唱','混音师','母带制作','录音师','作曲','作词','制作人','A调单簧管','降B调单簧管','尼龙弦吉他','箫','童声合唱','童声合唱指挥','哥伦比娅清唱','第一小提琴','第二小提琴','小提琴独奏','十二弦吉他')
      GROUP BY 1 ORDER BY 2 DESC
    `);
    log.push('抽查:');
    for (const r of sample.rows) log.push(`  ${r.credit_role_norm} ×${r.n}`);

    await client.query('COMMIT');
    console.log(log.join('\n'));
    console.log('✅ 全部完成');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ 失败已回滚:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
