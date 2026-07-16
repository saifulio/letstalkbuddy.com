// One-off migration: adds availability scheduling to an existing database.
// Idempotent; keeps all data.
// Usage: node scripts/migrate-availability.js
require('dotenv').config();
const pool = require('../db');

async function main() {
  console.log('Adding override columns to users...');
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS override_status ENUM('on','off') NULL AFTER role");
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS override_until DATETIME NULL AFTER override_status');

  console.log('Creating availability_rules table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS availability_rules (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id       INT UNSIGNED NOT NULL,
      kind          ENUM('weekly','date') NOT NULL DEFAULT 'weekly',
      days_of_week  VARCHAR(20) NULL,
      specific_date DATE NULL,
      start_minute  SMALLINT UNSIGNED NOT NULL,
      end_minute    SMALLINT UNSIGNED NOT NULL,
      enabled       TINYINT(1) NOT NULL DEFAULT 1,
      created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_avail_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_avail_user (user_id)
    ) ENGINE=InnoDB`);

  console.log('Done.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
