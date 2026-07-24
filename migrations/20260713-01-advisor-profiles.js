// Advisor profile page: title, about text, session count, and review authors.
module.exports.up = async (conn, { addColumn }) => {
  await addColumn(conn, 'advisors', 'title', "VARCHAR(120) NOT NULL DEFAULT '' AFTER category_id");
  await addColumn(conn, 'advisors', 'about', 'TEXT NULL AFTER bio');
  await addColumn(conn, 'advisors', 'sessions_completed', 'INT UNSIGNED NOT NULL DEFAULT 0 AFTER about');
  await addColumn(conn, 'reviews', 'author_name', "VARCHAR(80) NOT NULL DEFAULT '' AFTER user_id");
};
