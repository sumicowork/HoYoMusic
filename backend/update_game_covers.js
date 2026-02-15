// 游戏封面图标数据库更新脚本
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hoyomusic',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function updateGameCovers() {
  console.log('🎮 开始更新游戏封面路径...\n');

  try {
    // 测试数据库连接
    await pool.query('SELECT NOW()');
    console.log('✅ 数据库连接成功\n');

    // 读取并执行 SQL 脚本
    const sqlPath = join(__dirname, 'update_game_covers.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    console.log('执行以下 SQL 语句:');
    console.log('─'.repeat(50));
    console.log(sql);
    console.log('─'.repeat(50));
    console.log();

    // 执行更新
    const updates = [
      { name: '原神', path: '/games/genshin.png' },
      { name: '崩坏：星穹铁道', path: '/games/starrail.png' },
      { name: '绝区零', path: '/games/zzz.png' }
    ];

    for (const update of updates) {
      const result = await pool.query(
        'UPDATE games SET cover_path = $1 WHERE name = $2 RETURNING *',
        [update.path, update.name]
      );

      if (result.rowCount > 0) {
        console.log(`✅ ${update.name}: ${update.path}`);
      } else {
        console.log(`⚠️  ${update.name}: 未找到对应的游戏记录`);
      }
    }

    console.log('\n🎉 游戏封面路径更新完成！\n');

    // 验证更新结果
    console.log('验证更新结果:');
    console.log('─'.repeat(50));
    const result = await pool.query('SELECT id, name, cover_path FROM games ORDER BY display_order');
    result.rows.forEach(row => {
      const icon = row.cover_path ? '✅' : '❌';
      console.log(`${icon} ${row.name}: ${row.cover_path || '(未设置)'}`);
    });
    console.log('─'.repeat(50));
    console.log();

    console.log('下一步:');
    console.log('  1. 启动后端: cd backend && npm run dev');
    console.log('  2. 启动前端: cd frontend && npm run dev');
    console.log('  3. 访问 http://localhost:5173 查看效果\n');

  } catch (error) {
    console.error('❌ 更新失败:', error.message);
    console.error('\n可能的原因:');
    console.error('  1. 数据库未启动');
    console.error('  2. 数据库连接信息错误 (检查 .env 文件)');
    console.error('  3. games 表不存在 (需要先运行 schema_game_categories.sql)');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateGameCovers();

