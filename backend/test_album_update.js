const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hoyomusic',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testUpdate() {
  try {
    // Test updating album with game_id
    const albumId = 1; // First album
    const gameId = 2; // 崩坏：星穹铁道

    console.log(`Testing album update: Setting album ${albumId} to game ${gameId}`);

    const result = await pool.query(
      `UPDATE albums 
       SET game_id = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [gameId, albumId]
    );

    console.log('\nUpdate successful!');
    console.log('Updated album:');
    console.table(result.rows);

    // Verify the update
    const verify = await pool.query(`
      SELECT a.id, a.title, a.game_id, g.name as game_name 
      FROM albums a 
      LEFT JOIN games g ON a.game_id = g.id 
      WHERE a.id = $1;
    `, [albumId]);

    console.log('\nVerification:');
    console.table(verify.rows);

  } catch (error) {
    console.error('Error during test update:', error);
  } finally {
    await pool.end();
  }
}

testUpdate();

