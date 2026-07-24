// Redesigned availability settings: date overrides can block a whole day,
// plus per-user booking preferences.
module.exports.up = async (conn, { addColumn }) => {
  await addColumn(conn, 'availability_rules', 'unavailable',
    'TINYINT(1) NOT NULL DEFAULT 0 AFTER end_minute');

  await conn.query(`
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
};
