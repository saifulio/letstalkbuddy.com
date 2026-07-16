-- LetsTalkBuddy MySQL schema
CREATE DATABASE IF NOT EXISTS letstalkbuddy
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE letstalkbuddy;

DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS availability_rules;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS advisors;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(120)  NOT NULL,
  email           VARCHAR(190)  NOT NULL UNIQUE,
  password_hash   VARCHAR(100)  NOT NULL,
  role            ENUM('seeker','advisor') NOT NULL DEFAULT 'seeker',
  -- Manual availability override ("go online/offline for the next N hours")
  override_status ENUM('on','off') NULL,
  override_until  DATETIME NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Recurring weekly or specific-date availability windows.
-- Times are minutes from midnight; end_minute 1440 = midnight, and
-- end < start means the window crosses midnight (e.g. 10 PM - 2 AM).
CREATE TABLE availability_rules (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  kind          ENUM('weekly','date') NOT NULL DEFAULT 'weekly',
  days_of_week  VARCHAR(20) NULL,      -- '0,1,2' (0=Sunday), weekly rules only
  specific_date DATE NULL,             -- date rules only
  start_minute  SMALLINT UNSIGNED NOT NULL,
  end_minute    SMALLINT UNSIGNED NOT NULL,
  -- Date rules only: 1 = blocked all day. Any date rule (custom hours or
  -- unavailable) replaces the weekly hours for that date.
  unavailable   TINYINT(1) NOT NULL DEFAULT 0,
  enabled       TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_avail_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_avail_user (user_id)
) ENGINE=InnoDB;

-- Booking preferences shown in Settings -> Availability.
CREATE TABLE user_settings (
  user_id              INT UNSIGNED PRIMARY KEY,
  timezone             VARCHAR(64) NOT NULL DEFAULT 'GMT+6 · Dhaka',
  buffer_before        TINYINT UNSIGNED NOT NULL DEFAULT 10,  -- minutes
  buffer_after         TINYINT UNSIGNED NOT NULL DEFAULT 5,   -- minutes
  min_notice_hours     TINYINT UNSIGNED NOT NULL DEFAULT 4,
  max_bookings_per_day TINYINT UNSIGNED NOT NULL DEFAULT 6,
  session_length       TINYINT UNSIGNED NOT NULL DEFAULT 30,  -- minutes
  instant_booking      TINYINT(1) NOT NULL DEFAULT 1,
  reschedule_notice    TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE categories (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(80) NOT NULL UNIQUE,
  parent_id INT UNSIGNED NULL,
  color     VARCHAR(40) NOT NULL,
  tag_bg    VARCHAR(40) NOT NULL,
  tag_color VARCHAR(40) NOT NULL,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE,
  INDEX idx_categories_parent (parent_id)
) ENGINE=InnoDB;

CREATE TABLE advisors (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          INT UNSIGNED NULL,
  name             VARCHAR(120) NOT NULL,
  category_id      INT UNSIGNED NOT NULL,
  title            VARCHAR(120) NOT NULL DEFAULT '',
  bio              VARCHAR(300) NOT NULL DEFAULT '',
  about            TEXT NULL,
  sessions_completed INT UNSIGNED NOT NULL DEFAULT 0,
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
) ENGINE=InnoDB;

CREATE TABLE reviews (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  advisor_id INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NULL,
  author_name VARCHAR(80) NOT NULL DEFAULT '',
  rating     TINYINT UNSIGNED NOT NULL,
  comment    VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_advisor FOREIGN KEY (advisor_id) REFERENCES advisors(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;
