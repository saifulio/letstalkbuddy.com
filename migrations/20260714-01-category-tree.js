// Hierarchical categories: parent_id + the full taxonomy from
// scripts/taxonomy.js. If the old flat categories are present (pre-tree
// databases), their advisors are remapped to equivalent leaves and the old
// rows removed.
const { seedCategories } = require('../scripts/taxonomy');

const OLD_CATEGORIES = ['Health & Medical', 'Legal', 'Tech & Career', 'Business Mentorship',
  'Life Coaching', 'Companionship', 'Hobbies & Games'];

const OLD_TO_NEW = {
  'Health & Medical': 'Doctor',
  'Legal': 'Lawyer',
  'Tech & Career': 'Software Architect',
  'Business Mentorship': 'Business Mentor',
  'Life Coaching': 'Life Coach',
  'Companionship': 'Friend',
  'Hobbies & Games': 'Gaming Partner',
};

module.exports.up = async (conn, { addColumn, constraintExists }) => {
  await addColumn(conn, 'categories', 'parent_id', 'INT UNSIGNED NULL AFTER name');
  if (!await constraintExists(conn, 'fk_categories_parent')) {
    await conn.query(
      'ALTER TABLE categories ADD CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE');
  }

  const [[{ n }]] = await conn.query(
    'SELECT COUNT(*) AS n FROM categories WHERE parent_id IS NOT NULL');
  if (n > 0) return; // taxonomy already present

  const ids = await seedCategories(conn);

  const [oldCats] = await conn.query('SELECT id, name FROM categories WHERE name IN (?)', [OLD_CATEGORIES]);
  for (const cat of oldCats) {
    await conn.query('UPDATE advisors SET category_id = ? WHERE category_id = ?',
      [ids.get(OLD_TO_NEW[cat.name]), cat.id]);
  }
  if (oldCats.length) {
    await conn.query('DELETE FROM categories WHERE id IN (?)', [oldCats.map(c => c.id)]);
  }
};
