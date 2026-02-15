const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hoyomusic',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkSchema() {
  try {
    // Check if games table exists
    const gamesTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'games'
      );
    `);
    console.log('Games table exists:', gamesTableCheck.rows[0].exists);

    // Check if albums.game_id column exists
    const gameIdColumnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'albums' 
        AND column_name = 'game_id'
      );
    `);
    console.log('Albums.game_id column exists:', gameIdColumnCheck.rows[0].exists);

    // If games table exists, check games
    if (gamesTableCheck.rows[0].exists) {
      const games = await pool.query('SELECT id, name, name_en, cover_path FROM games ORDER BY display_order;');
      console.log('\nGames in database:');
      console.table(games.rows);
    }

    // Check albums with game_id
    if (gameIdColumnCheck.rows[0].exists) {
      const albums = await pool.query(`
        SELECT a.id, a.title, a.game_id, g.name as game_name 
        FROM albums a 
        LEFT JOIN games g ON a.game_id = g.id 
        ORDER BY a.id 
        LIMIT 10;
      `);
      console.log('\nSample albums with game associations:');
      console.table(albums.rows);
    }

  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();

