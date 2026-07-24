// Initial database: users, flat categories, advisors, reviews.
// Later migrations evolve this schema in sequence.
module.exports.up = async (conn) => {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      full_name     VARCHAR(120)  NOT NULL,
      email         VARCHAR(190)  NOT NULL UNIQUE,
      password_hash VARCHAR(100)  NOT NULL,
      role          ENUM('seeker','advisor') NOT NULL DEFAULT 'seeker',
      created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name      VARCHAR(80) NOT NULL UNIQUE,
      color     VARCHAR(40) NOT NULL,
      tag_bg    VARCHAR(40) NOT NULL,
      tag_color VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB`);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS advisors (
      id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id          INT UNSIGNED NULL,
      name             VARCHAR(120) NOT NULL,
      category_id      INT UNSIGNED NOT NULL,
      bio              VARCHAR(300) NOT NULL DEFAULT '',
      rating           DECIMAL(2,1) NOT NULL DEFAULT 5.0,
      reviews_count    INT UNSIGNED NOT NULL DEFAULT 0,
      response_minutes INT UNSIGNED NOT NULL DEFAULT 5,
      rate_per_min     DECIMAL(5,2) NOT NULL,
      languages        VARCHAR(120) NOT NULL DEFAULT 'English',
      is_online        TINYINT(1) NOT NULL DEFAULT 0,
      created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_advisors_user     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_advisors_category FOREIGN KEY (category_id) REFERENCES categories(id),
      INDEX idx_advisors_category (category_id),
      INDEX idx_advisors_rating (rating),
      INDEX idx_advisors_online (is_online)
    ) ENGINE=InnoDB`);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      advisor_id INT UNSIGNED NOT NULL,
      user_id    INT UNSIGNED NULL,
      rating     TINYINT UNSIGNED NOT NULL,
      comment    VARCHAR(500) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_reviews_advisor FOREIGN KEY (advisor_id) REFERENCES advisors(id) ON DELETE CASCADE,
      CONSTRAINT fk_reviews_user    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
    ) ENGINE=InnoDB`);
};
