// Profile section: photo albums, display/gallery photos, and admin-tunable
// app settings (upload size limit, default 500 kB).
module.exports.up = async (conn) => {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS albums (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id    INT UNSIGNED NOT NULL,
      name       VARCHAR(80) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_albums_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_albums_user (user_id)
    ) ENGINE=InnoDB`);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS photos (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id    INT UNSIGNED NOT NULL,
      album_id   INT UNSIGNED NULL,          -- gallery photos live in an album
      kind       ENUM('display','gallery') NOT NULL DEFAULT 'gallery',
      url        VARCHAR(255) NOT NULL,
      size_bytes INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_photos_user  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_photos_album FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
      INDEX idx_photos_user (user_id)
    ) ENGINE=InnoDB`);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      name  VARCHAR(64) PRIMARY KEY,
      value VARCHAR(190) NOT NULL
    ) ENGINE=InnoDB`);

  // Admin-customizable upload limit (kB) for profile/gallery images.
  await conn.query("INSERT IGNORE INTO app_settings (name, value) VALUES ('max_upload_kb', '500')");
};
