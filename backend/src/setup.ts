import bcrypt from 'bcrypt';
import pool from './config/database';
import fs from 'fs/promises';
import path from 'path';

// NOTE: setup.ts is the bootstrap path for a FRESH database (idempotent, safe to
// re-run). For INCREMENTAL schema changes prefer the migration system:
//   - Migrations live in db/migrations/*.sql and are applied by `npm run migrate`
//     (see scripts/migrate.ts), which tracks applied state in the _migrations table.
//   - db/schema.sql is the authoritative full schema; its content is mirrored as the
//     baseline migration db/migrations/0001_init.sql. New changes should add new,
//     numbered migration files rather than editing schema.sql directly.
async function setupDatabase() {
  console.log('🔧 Setting up HoYoMusic database...');

  try {
    // Read and execute schema
    const schemaPath = path.join(__dirname, '../db/schema.sql');
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

    // Create admin user with hashed password.
    // The password is read from the ADMIN_PASSWORD environment variable so that
    // secrets are never committed to source. For local/dev convenience it falls
    // back to a weak default ('changeme'); override it via ADMIN_PASSWORD in any
    // shared or production environment. See backend/.env.example.
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'changeme';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await pool.query(
      `INSERT INTO users (username, password_hash, email_verified, is_admin)
       VALUES ($1, $2, TRUE, TRUE)
       ON CONFLICT (username) DO UPDATE
       SET password_hash = $2,
           email_verified = TRUE,
           is_admin = TRUE`,
      ['admin', hashedPassword]
    );

    console.log('✅ Database setup complete!');
    console.log('📝 Admin credentials:');
    console.log('   Username: admin');
    if (adminPassword === 'changeme') {
      console.warn('⚠️  使用了弱默认密码 (changeme)。请通过 ADMIN_PASSWORD 环境变量设置强密码，生产环境务必修改！');
    } else {
      console.log('   Password: 已通过 ADMIN_PASSWORD 环境变量设置');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    await pool.end();
    process.exit(1);
  }
}

setupDatabase();

