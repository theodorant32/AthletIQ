/**
 * Database migration script
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'athletiq',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
});

async function runMigrations() {
  console.log('Running database migrations...');

  try {
    // Read migration file
    const migrationPath = join(__dirname, '../../migrations/001_initial_schema.sql');
    const migration = readFileSync(migrationPath, 'utf-8');

    // Execute migration
    await pool.query(migration);

    console.log('✅ Migrations completed successfully');

    // Verify tables exist
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\nTables created:');
    tables.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
