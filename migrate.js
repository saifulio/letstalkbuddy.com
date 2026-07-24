// Database migration runner.
//
// Migrations live in ./migrations as date-prefixed files (YYYYMMDD-NN-name.js),
// each exporting an async `up(conn)`. A `migrations` table records every file
// that has run, so each migration executes exactly once per database: a fresh
// server runs the whole sequence, an up-to-date one runs nothing.
//
// Runs automatically when the server starts; can also be run manually:
//   npm run db:migrate
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_NAME = process.env.DB_NAME || 'letstalkbuddy';
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function connectionConfig(withDatabase) {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    dateStrings: ['DATE'],
    ...(withDatabase ? { database: DB_NAME } : {}),
  };
}

/* ---------- helpers usable inside migrations ---------- */

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]);
  return rows.length > 0;
}

// Adds a column only if missing (portable across MySQL and MariaDB).
async function addColumn(conn, table, column, ddl) {
  if (await columnExists(conn, table, column)) return false;
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`);
  return true;
}

async function constraintExists(conn, name) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?`, [name]);
  return rows.length > 0;
}

/* ---------- runner ---------- */

async function runMigrations({ log = console.log } = {}) {
  // Connect without a database first so a brand-new server bootstraps itself.
  const boot = await mysql.createConnection(connectionConfig(false));
  await boot.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await boot.end();

  const conn = await mysql.createConnection(connectionConfig(true));
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name   VARCHAR(190) NOT NULL UNIQUE,
        ran_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`);

    const [done] = await conn.query('SELECT name FROM migrations');
    const doneSet = new Set(done.map(r => r.name));

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => /^\d{8}-\d{2}-.+\.js$/.test(f))
      .sort(); // date prefix keeps the sequence chronological

    let ran = 0;
    for (const file of files) {
      if (doneSet.has(file)) continue;
      log(`[migrate] running ${file}`);
      const migration = require(path.join(MIGRATIONS_DIR, file));
      if (typeof migration.up !== 'function') {
        throw new Error(`Migration ${file} does not export an up() function`);
      }
      await migration.up(conn, { columnExists, addColumn, constraintExists });
      await conn.query('INSERT INTO migrations (name) VALUES (?)', [file]);
      ran++;
    }

    log(ran ? `[migrate] ${ran} migration(s) applied.` : '[migrate] database is up to date.');
    return ran;
  } finally {
    await conn.end();
  }
}

module.exports = { runMigrations, columnExists, addColumn, constraintExists };

if (require.main === module) {
  runMigrations().catch((err) => {
    console.error('[migrate] failed:', err.message);
    process.exit(1);
  });
}
