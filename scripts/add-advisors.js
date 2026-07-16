// Generates additional random advisors.
// Usage: npm run db:add-data            (adds 20)
//        node scripts/add-advisors.js 50 (adds 50)
require('dotenv').config();
const pool = require('../db');

const FIRST = ['Ayesha', 'Rahim', 'Nusrat', 'Kamal', 'Sadia', 'Tanvir', 'Mehnaz', 'Arif', 'Farzana', 'Imran',
  'Sofia', 'Daniel', 'Grace', 'Omar', 'Elena', 'Ravi', 'Mina', 'Jonas', 'Aisha', 'Leo'];
const LAST = ['Rahman', 'Chowdhury', 'Akter', 'Hossain', 'Islam', 'Khan', 'Ahmed', 'Begum', 'Sarker', 'Uddin',
  'Chen', 'Garcia', 'Petrov', 'Okafor', 'Silva', 'Novak', 'Tanaka', 'Weber', 'Rossi', 'Kim'];

const LANG_SETS = ['English', 'English,Bangla', 'English,Hindi', 'English,Bangla,Hindi', 'Bangla'];

const BIO_TEMPLATES = [
  (c) => `Experienced ${c} with a warm, practical approach. Ask me anything.`,
  (c) => `${c} sessions tailored to your exact situation — clear, honest, actionable.`,
  (c) => `Friendly ${c} helping people one conversation at a time.`,
  (c) => `Seasoned ${c} offering per-minute guidance whenever you need it.`,
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.random() * (max - min) + min;

async function main() {
  const count = Math.max(1, parseInt(process.argv[2], 10) || 20);
  // Advisors are only assigned to leaf categories (nodes with no children).
  const [cats] = await pool.query(`
    SELECT c.id, c.name FROM categories c
    LEFT JOIN categories k ON k.parent_id = c.id
    WHERE k.id IS NULL`);
  if (!cats.length) {
    throw new Error('No categories found. Run "npm run db:setup" first.');
  }

  const rows = [];
  for (let i = 0; i < count; i++) {
    const cat = pick(cats);
    const bio = pick(BIO_TEMPLATES)(cat.name.toLowerCase());
    const reviewsCount = Math.floor(rand(5, 600));
    rows.push([
      `${pick(FIRST)} ${pick(LAST)}`,
      cat.id,
      cat.name,
      bio,
      `${bio} With years of hands-on experience in ${cat.name.toLowerCase()}, I keep sessions practical and friendly: tell me what's on your mind, and we'll work through it together — you only pay for the minutes we talk.`,
      Math.round(reviewsCount * rand(2.5, 4.5)),
      (Math.round(rand(3.8, 5.0) * 10) / 10).toFixed(1),
      reviewsCount,
      Math.floor(rand(1, 30)),
      (Math.round(rand(0.5, 5.0) * 4) / 4).toFixed(2),
      pick(LANG_SETS),
      Math.random() < 0.45 ? 1 : 0,
    ]);
  }

  await pool.query(
    `INSERT INTO advisors
       (name, category_id, title, bio, about, sessions_completed, rating, reviews_count, response_minutes, rate_per_min, languages, is_online)
     VALUES ?`,
    [rows]
  );

  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM advisors');
  console.log(`Added ${count} advisors. Total advisors: ${n}.`);
  await pool.end();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
