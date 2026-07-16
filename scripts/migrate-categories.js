// One-off migration: converts the flat 7-category setup to the hierarchical
// taxonomy in taxonomy.js, remapping existing advisors to the new leaves.
// Safe to run on a live database; keeps users, advisors, and reviews.
// Usage: node scripts/migrate-categories.js
require('dotenv').config();
const pool = require('../db');
const { seedCategories } = require('./taxonomy');

const OLD_CATEGORIES = ['Health & Medical', 'Legal', 'Tech & Career', 'Business Mentorship',
  'Life Coaching', 'Companionship', 'Hobbies & Games'];

// Advisor title -> new leaf category (most specific match first).
const BY_TITLE = {
  'General Physician': 'Doctor',
  'Health Consultant': 'Doctor',
  'Physiotherapist': 'Doctor',
  'Psychiatrist': 'Psychiatrist',
  'Nutritionist': 'Nutrition',
  'Contract & Immigration Lawyer': 'Immigration Consultant',
  'Corporate Lawyer': 'Lawyer',
  'Family Law Consultant': 'Lawyer',
  'Property Law Advisor': 'Lawyer',
  'Senior Software Engineer': 'Interview Practice',
  'Tech Recruiter': 'Mock HR Interview',
  'Product Manager': 'Consultant',
  'Startup Founder & Mentor': 'Startup Mentor',
  'Startup Mentor': 'Startup Mentor',
  'E-commerce Consultant': 'Business Mentor',
  'Finance Advisor': 'Accountant',
  'Certified Life Coach': 'Life Coach',
  'Mindfulness Coach': 'Life Coach',
  'Career Transition Coach': 'Life Coach',
  'Career & Relationship Coach': 'Relationship Coach',
  'Friendly Listener': 'Friend',
  'Conversation Partner': 'Coffee Chat',
  'FIDE Chess Coach': 'Chess Coach',
  'Chess Coach': 'Chess Coach',
  'Guitar Teacher': 'Music Teacher',
  'Photography Mentor': 'Photography',
};

// Fallback: old flat category -> new leaf category.
const BY_OLD_CATEGORY = {
  'Health & Medical': 'Doctor',
  'Legal': 'Lawyer',
  'Tech & Career': 'Software Architect',
  'Business Mentorship': 'Business Mentor',
  'Life Coaching': 'Life Coach',
  'Companionship': 'Friend',
  'Hobbies & Games': 'Gaming Partner',
};

async function main() {
  console.log('Adding parent_id column...');
  await pool.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INT UNSIGNED NULL AFTER name');

  const [existing] = await pool.query('SELECT COUNT(*) AS n FROM categories WHERE parent_id IS NOT NULL');
  if (existing[0].n > 0) {
    console.log('Categories already look hierarchical — nothing to do.');
    await pool.end();
    return;
  }
  const [fks] = await pool.query(`
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_categories_parent'`);
  if (!fks.length) {
    await pool.query('ALTER TABLE categories ADD CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE');
  }

  console.log('Inserting new taxonomy...');
  const ids = await seedCategories(pool);

  console.log('Remapping advisors...');
  const [advisors] = await pool.query(`
    SELECT a.id, a.title, c.name AS old_category
    FROM advisors a JOIN categories c ON c.id = a.category_id
    WHERE c.name IN (?)`, [OLD_CATEGORIES]);

  for (const a of advisors) {
    const target = BY_TITLE[a.title] || BY_OLD_CATEGORY[a.old_category] || 'Consultant';
    const newId = ids.get(target);
    if (!newId) throw new Error(`No taxonomy entry named "${target}"`);
    await pool.query('UPDATE advisors SET category_id = ? WHERE id = ?', [newId, a.id]);
  }

  console.log('Removing old flat categories...');
  await pool.query('DELETE FROM categories WHERE name IN (?)', [OLD_CATEGORIES]);

  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM categories');
  console.log(`Done. Remapped ${advisors.length} advisors; ${n} categories in the tree.`);
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
