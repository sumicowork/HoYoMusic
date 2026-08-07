#!/usr/bin/env node
/**
 * 监管协查数据导出工具（一键式）
 * 用法（在服务器 /opt/hoyomusic 下执行）:
 *   node scripts/compliance/exportForCompliance.cjs --user=用户名或邮箱
 *   node scripts/compliance/exportForCompliance.cjs --phone=13800138000
 *   node scripts/compliance/exportForCompliance.cjs --ip=1.2.3.4
 *   node scripts/compliance/exportForCompliance.cjs --days=30
 * 可组合: --user=x --days=365
 * 输出: /opt/hoyomusic/compliance-exports/<时间戳>_<查询键>/ 目录下
 *   report.json  —— 完整汇总（机器可读，含数据来源说明）
 *   *.csv        —— 分表明细（用户/评论/评分/举报/访问日志/验证码短信/反馈）
 *   README.txt   —— 协查响应说明（数据覆盖与口径）
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ── 参数解析 ──
const args = process.argv.slice(2);
const get = (key) => {
  const a = args.find((x) => x.startsWith(`--${key}=`));
  return a ? a.slice(key.length + 3).trim() : null;
};
const userKey = get('user');
const phoneKey = get('phone');
const ipKey = get('ip');
const days = parseInt(get('days') || '30', 10);

const allMode = args.includes('--all') || !!get('all');

if (!userKey && !phoneKey && !ipKey && !allMode) {
  console.error('用法: node exportForCompliance.cjs --user=<用户名|邮箱> | --phone=<手机号> | --ip=<IP> | --all [--days=N]');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'sumicowork',
  password: process.env.PGPASSWORD || 'cKj46Xyw8tfT5znQ',
  database: process.env.PGDATABASE || 'hoyomusic',
});

const OUT_ROOT = path.join(__dirname, '..', '..', 'compliance-exports');

const fmt = (v) => (v === null || v === undefined ? '' : String(v));
const csv = (rows) => {
  if (!rows.length) return '无数据\n';
  const headers = Object.keys(rows[0]);
  const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
  return headers.join(',') + '\n' + rows.map((r) => headers.map((h) => esc(fmt(r[h]))).join(',')).join('\n') + '\n';
};

const q = async (sql, params = []) => (await pool.query(sql, params)).rows;

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const key = allMode ? `all_${days}d` : userKey ? `user_${userKey}` : phoneKey ? `phone_${phoneKey}` : `ip_${ipKey}`;
  const outDir = path.join(OUT_ROOT, `${stamp}_${key}`);
  fs.mkdirSync(outDir, { recursive: true });

  const report = {
    generated_at: new Date().toISOString(),
    query: { user: userKey, phone: phoneKey, ip: ipKey, days, all: allMode },
    data: {},
    sources: {},
  };

  // ── 0. 全站时间段汇总模式（--all --days=N）──
  if (allMode) {
    const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
    const sinceSql = `$1::timestamptz`;
    const summary = {
      since,
      new_users: (await q(`SELECT count(*)::int AS c FROM users WHERE created_at >= ${sinceSql}`, [since])).map(r=>r.c)[0],
      new_comments: (await q(`SELECT count(*)::int AS c FROM comments WHERE created_at >= ${sinceSql}`, [since])).map(r=>r.c)[0],
      new_ratings: (await q(`SELECT count(*)::int AS c FROM ratings WHERE created_at >= ${sinceSql}`, [since])).map(r=>r.c)[0],
      new_reports: (await q(`SELECT count(*)::int AS c FROM reports WHERE created_at >= ${sinceSql}`, [since])).map(r=>r.c)[0],
      new_sms: (await q(`SELECT count(*)::int AS c FROM sms_send_log WHERE created_at >= ${sinceSql}`, [since])).map(r=>r.c)[0],
      feedback: (await q(`SELECT count(*)::int AS c FROM feedback_messages WHERE created_at >= ${sinceSql}`, [since])).map(r=>r.c)[0],
      visits: (await q(`SELECT count(*)::int AS c FROM visit_logs WHERE ts >= ${sinceSql}`, [since])).map(r=>r.c)[0],
    };
    const detail = {
      comments: await q(
        `SELECT c.id, c.target_type, c.target_id, c.user_id, u.username, c.content, c.status,
                c.ip, c.created_at, c.deleted_at, rv.username AS reviewed_by_name, c.reviewed_at
         FROM comments c JOIN users u ON u.id = c.user_id
         LEFT JOIN users rv ON rv.id = c.reviewed_by
         WHERE c.created_at >= ${sinceSql} ORDER BY c.created_at`, [since]),
      reports: await q(
        `SELECT r.id, r.comment_id, r.reason, r.detail, r.status, r.created_at, r.handled_at,
                rp.username AS reporter_name, h.username AS handler_name
         FROM reports r
         LEFT JOIN users rp ON rp.id = r.reporter_id
         LEFT JOIN users h ON h.id = r.handler_id
         WHERE r.created_at >= ${sinceSql} ORDER BY r.created_at`, [since]),
      feedback: await q(`SELECT * FROM feedback_messages WHERE created_at >= ${sinceSql} ORDER BY created_at`, [since]),
    };
    report.data = { summary, detail };
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(outDir, '全站汇总.json'), JSON.stringify(summary, null, 2));
    fs.writeFileSync(path.join(outDir, '评论明细.csv'), csv(detail.comments));
    fs.writeFileSync(path.join(outDir, '举报明细.csv'), csv(detail.reports));
    fs.writeFileSync(path.join(outDir, '反馈明细.csv'), csv(detail.feedback));
    fs.writeFileSync(path.join(outDir, 'README.txt'), [
      '监管协查数据导出说明（全站时间段模式）',
      '====================',
      `生成时间: ${report.generated_at}`,
      `统计区间: 近 ${days} 天（自 ${since} 起）`,
      `新增用户 ${summary.new_users} | 评论 ${summary.new_comments} | 评分 ${summary.new_ratings} | 举报 ${summary.new_reports} | 短信 ${summary.new_sms} | 反馈 ${summary.feedback} | 访问 ${summary.visits}`,
      '明细文件: 评论明细.csv / 举报明细.csv / 反馈明细.csv',
    ].join('\n'));
    console.log('════ 全站协查汇总（近 ' + days + ' 天）════');
    console.log(`输出目录: ${outDir}`);
    console.log(JSON.stringify(summary, null, 2));
    await pool.end();
    return;
  }

  // ── 1. 用户定位 ──
  let users = [];
  if (userKey) {
    users = await q(
      `SELECT id, username, email, phone, phone_verified, is_admin, account_status, status_reason,
              created_at, updated_at, last_login_at, last_login_ip, accept_terms_at
       FROM users WHERE username = $1 OR LOWER(email) = LOWER($1)`,
      [userKey],
    );
  } else if (phoneKey) {
    users = await q(`SELECT * FROM users WHERE phone = $1`, [phoneKey]);
  } else if (ipKey) {
    // IP 反查：users.last_login_ip 匹配 + 访问日志关联的用户
    const byLastLogin = await q(`SELECT * FROM users WHERE last_login_ip = $1`, [ipKey]);
    const byVisit = await q(
      `SELECT DISTINCT actor_user_id AS id, actor_username AS username FROM visit_logs WHERE ip = $1 AND actor_user_id IS NOT NULL`,
      [ipKey],
    );
    const byVisitIds = byVisit.map((r) => r.id);
    const byVisitUsers = byVisitIds.length
      ? await q(
          `SELECT id, username, email, phone, phone_verified, is_admin, account_status, status_reason,
                  created_at, updated_at, last_login_at, last_login_ip, accept_terms_at
           FROM users WHERE id = ANY($1)`,
          [byVisitIds],
        )
      : [];
    users = [...byLastLogin, ...byVisitUsers];
    // 去重
    const seen = new Set();
    users = users.filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)));
  }
  report.data.users = users.map((u) => ({ ...u, password_hash: '[已隐藏]' }));
  report.sources.users = 'users 表';

  // ── 2. 按用户聚合的明细（IP 查询模式：全站该 IP 的活动）──
  const userIds = users.map((u) => u.id);
  const hasUserScope = userIds.length > 0;

  // 评论（含审核/删除留痕）
  const comments = hasUserScope
    ? await q(
        `SELECT c.id, c.target_type, c.target_id, c.content, c.status, c.ip, c.user_agent,
                c.report_count, c.created_at, c.updated_at, c.deleted_at,
                rv.username AS reviewed_by_name, c.reviewed_at,
                d.username AS deleted_by_name
         FROM comments c
         LEFT JOIN users rv ON rv.id = c.reviewed_by
         LEFT JOIN users d ON d.id = c.deleted_by
         WHERE c.user_id = ANY($1) ORDER BY c.created_at`,
        [userIds],
      )
    : await q(
        `SELECT c.id, c.target_type, c.target_id, c.user_id, u.username, c.content, c.status, c.ip,
                c.created_at, c.deleted_at,
                rv.username AS reviewed_by_name, c.reviewed_at
         FROM comments c JOIN users u ON u.id = c.user_id
         LEFT JOIN users rv ON rv.id = c.reviewed_by
         WHERE c.ip = $1 OR c.user_agent = (SELECT user_agent FROM visit_logs WHERE ip = $1 LIMIT 1)
         ORDER BY c.created_at`,
        [ipKey],
      );
  report.data.comments = comments;
  report.sources.comments = 'comments 表（含审核人/审核时间/删除人留痕）';

  // 评分
  const ratings = hasUserScope
    ? await q(`SELECT * FROM ratings WHERE user_id = ANY($1) ORDER BY created_at`, [userIds])
    : await q(`SELECT * FROM ratings WHERE 1 = 0`);
  report.data.ratings = ratings;

  // 举报（用户作为举报人）
  const reportsAsReporter = hasUserScope
    ? await q(
        `SELECT r.id, r.comment_id, r.reason, r.detail, r.status, r.created_at, r.handled_at,
                h.username AS handler_name
         FROM reports r LEFT JOIN users h ON h.id = r.handler_id
         WHERE r.reporter_id = ANY($1) ORDER BY r.created_at`,
        [userIds],
      )
    : [];
  report.data.reports_as_reporter = reportsAsReporter;

  // 举报（用户作为被举报评论作者）
  const reportsOnUserComments = hasUserScope
    ? await q(
        `SELECT r.id, r.comment_id, c.content AS comment_content, r.reason, r.status, r.created_at,
                rp.username AS reporter_name
         FROM reports r
         JOIN comments c ON c.id = r.comment_id
         JOIN users rp ON rp.id = r.reporter_id
         WHERE c.user_id = ANY($1) ORDER BY r.created_at`,
        [userIds],
      )
    : [];
  report.data.reports_on_my_comments = reportsOnUserComments;

  // 访问/登录日志（IP 模式：该 IP 全量；用户模式：该用户已登录态请求 + 登录接口记录）
  let visits = [];
  if (ipKey) {
    visits = await q(
      `SELECT ts, ip, method, path, status, duration_ms, user_agent, actor_user_id, actor_username
       FROM visit_logs WHERE ip = $1 ORDER BY ts DESC LIMIT 5000`,
      [ipKey],
    );
  } else if (hasUserScope) {
    visits = await q(
      `SELECT ts, ip, method, path, status, duration_ms, user_agent
       FROM visit_logs
       WHERE actor_user_id = ANY($1)
          OR (path LIKE '/api/auth/login%' AND user_agent IN
              (SELECT DISTINCT user_agent FROM visit_logs WHERE actor_user_id = ANY($1)))
       ORDER BY ts DESC LIMIT 5000`,
      [userIds],
    );
  }
  report.data.visit_logs = visits;
  report.sources.visit_logs = 'visit_logs 表（含登录/注册请求与已登录态请求，IP+UA+时间）';

  // 登录记录（从访问日志中提取）
  const logins = visits.filter((v) => v.path.startsWith('/api/auth/login') || v.path.startsWith('/api/auth/register'));
  report.data.login_register_records = logins;

  // 验证码与短信记录
  let codes = [];
  let sms = [];
  if (phoneKey) {
    codes = await q(`SELECT id, email, phone, challenge_id, created_at, expires_at, consumed_at, attempt_count FROM auth_verification_codes WHERE phone = $1 ORDER BY created_at`, [phoneKey]);
    sms = await q(`SELECT id, phone, purpose, created_at FROM sms_send_log WHERE phone = $1 ORDER BY created_at`, [phoneKey]);
  } else if (hasUserScope) {
    codes = await q(
      `SELECT id, email, phone, created_at, expires_at, consumed_at, attempt_count FROM auth_verification_codes
       WHERE LOWER(email) IN (SELECT LOWER(email) FROM users WHERE id = ANY($1)) ORDER BY created_at`,
      [userIds],
    );
  }
  report.data.verification_codes = codes;
  report.data.sms_send_log = sms;
  report.sources.codes_sms = 'auth_verification_codes / sms_send_log 表';

  // 意见反馈（按用户邮箱/联系方式匹配）
  const feedback = hasUserScope
    ? await q(
        `SELECT f.id, f.content, f.contact, f.ip, f.user_agent, f.created_at
         FROM feedback_messages f
         WHERE EXISTS (
           SELECT 1 FROM users u
           WHERE u.id = ANY($1) AND f.contact ILIKE '%' || u.email || '%'
         )
         ORDER BY f.created_at`,
        [userIds],
      )
    : await q(`SELECT id, content, contact, ip, user_agent, created_at FROM feedback_messages WHERE ip = $1 ORDER BY created_at`, [ipKey]);
  report.data.feedback = feedback;

  // ── 3. 写出文件 ──
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, '用户信息.csv'), csv(report.data.users));
  fs.writeFileSync(path.join(outDir, '评论记录.csv'), csv(comments));
  fs.writeFileSync(path.join(outDir, '评分记录.csv'), csv(ratings));
  fs.writeFileSync(path.join(outDir, '举报记录_发出.csv'), csv(reportsAsReporter));
  fs.writeFileSync(path.join(outDir, '举报记录_收到.csv'), csv(reportsOnUserComments));
  fs.writeFileSync(path.join(outDir, '访问与登录日志.csv'), csv(visits));
  fs.writeFileSync(path.join(outDir, '验证码短信记录.csv'), csv([...codes, ...sms.map((s) => ({ ...s, email: '', challenge_id: '' }))]));
  fs.writeFileSync(path.join(outDir, '意见反馈.csv'), csv(feedback));

  const readme = [
    '监管协查数据导出说明',
    '====================',
    `生成时间: ${report.generated_at}`,
    `查询条件: ${JSON.stringify(report.query)}`,
    '',
    '文件清单:',
    '  report.json              —— 完整数据（机器可读，密码哈希已隐藏）',
    '  用户信息.csv              —— 注册/实名/状态/最后登录',
    '  评论记录.csv              —— 内容/状态/IP/审核人/审核时间/删除人',
    '  评分记录.csv              —— 评分与时间',
    '  举报记录_发出.csv         —— 该用户发出的举报',
    '  举报记录_收到.csv         —— 针对该用户评论的举报',
    '  访问与登录日志.csv        —— IP/时间/路径/UA（含登录注册请求）',
    '  验证码短信记录.csv        —— 邮箱/手机验证码与短信发送记录',
    '  意见反馈.csv              —— 用户提交的反馈',
    '',
    '口径说明:',
    `  评论日志按《互联网跟帖评论服务管理规定》留存不少于 6 个月（当前表内最早 ${comments.length ? comments[comments.length - 1].created_at : '无'}）。`,
    '  登录记录来自全局访问日志（visit_logs），包含登录/注册请求的时间、IP、UA。',
    '  密码、验证码原文不存储（bcrypt 哈希），无法提供明文。',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'README.txt'), readme);

  // ── 4. 控制台摘要 ──
  console.log('════ 协查导出完成 ════');
  console.log(`输出目录: ${outDir}`);
  console.log(`用户数: ${users.length} | 评论: ${comments.length} | 评分: ${ratings.length} | 举报(发出): ${reportsAsReporter.length} | 举报(收到): ${reportsOnUserComments.length}`);
  console.log(`访问日志: ${visits.length} 条 | 登录/注册记录: ${logins.length} 条 | 验证码: ${codes.length} | 短信: ${sms.length} | 反馈: ${feedback.length}`);
  await pool.end();
}

main().catch((e) => { console.error('导出失败:', e.message); process.exit(1); });
