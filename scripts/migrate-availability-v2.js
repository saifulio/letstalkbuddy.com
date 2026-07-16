// One-off migration for the redesigned Settings -> Availability page:
// adds date-override semantics and the user_settings table. Idempotent.
// Usage: node scripts/migrate-availability-v2.js
require('dotenv').config();
const pool = require('../db');

async function main() {
  console.log('Adding unavailable flag to availability_rules...');
  await pool.query('ALTER TABLE availability_rules ADD COLUMN IF NOT EXISTS unavailable TINYINT(1) NOT NULL DEFAULT 0 AFTER end_minute');

  console.log('Creating user_settings table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id              INT UNSIGNED PRIMARY KEY,
      timezone             VARCHAR(64) NOT NULL DEFAULT 'GMT+6 · Dhaka',
      buffer_before        TINYINT UNSIGNED NOT NULL DEFAULT 10,
      buffer_after         TINYINT UNSIGNED NOT NULL DEFAULT 5,
      min_notice_hours     TINYINT UNSIGNED NOT NULL DEFAULT 4,
      max_bookings_per_day TINYINT UNSIGNED NOT NULL DEFAULT 6,
      session_length       TINYINT UNSIGNED NOT NULL DEFAULT 30,
      instant_booking      TINYINT(1) NOT NULL DEFAULT 1,
      reschedule_notice    TINYINT(1) NOT NULL DEFAULT 0,
      CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

  console.log('Done.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
