// Availability scheduling: manual override on users + schedule rules table.
module.exports.up = async (conn, { addColumn }) => {
  await addColumn(conn, 'users', 'override_status', "ENUM('on','off') NULL AFTER role");
  await addColumn(conn, 'users', 'override_until', 'DATETIME NULL AFTER override_status');

  await conn.query(`
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
};
