import bcrypt from 'bcrypt';
import pool from './config/database';
import fs from 'fs/promises';
import path from 'path';

async function setupDatabase() {
  console.log('🔧 Setting up HoYoMusic database...');

  try {
    // Read and execute schema
    const schemaPath = path.join(__dirname, '../schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf-8');

    // Remove comments and split by semicolons
    const cleanedSchema = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSchema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      // Skip the default INSERT INTO users statement
      if (statement.includes('INSERT INTO users') && statement.includes('$2b$10$')) {
        continue;
      }

      try {
        await pool.query(statement);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.code !== '42P07') { // 42P07 = relation already exists
          throw error;
        }
      }
    }

    // Create admin user with hashed password
    const adminPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await pool.query(
      `INSERT INTO users (username, password_hash) 
       VALUES ($1, $2) 
       ON CONFLICT (username) DO UPDATE SET password_hash = $2`,
      ['admin', hashedPassword]
    );

    console.log('✅ Database setup complete!');
    console.log('📝 Admin credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('⚠️  Please change the password in production!');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    await pool.end();
    process.exit(1);
  }
}

setupDatabase();

