// One-off migration: adds profile fields to an existing database and backfills
// them, so you don't have to wipe your data with db:setup.
// Usage: node scripts/migrate-profile.js
require('dotenv').config();
const pool = require('../db');

const TITLES = {
  'Health & Medical': ['General Physician', 'Nutritionist', 'Physiotherapist', 'Health Consultant'],
  'Legal': ['Corporate Lawyer', 'Family Law Consultant', 'Property Law Advisor'],
  'Tech & Career': ['Senior Software Engineer', 'Tech Recruiter', 'Product Manager'],
  'Business Mentorship': ['Startup Mentor', 'E-commerce Consultant', 'Finance Advisor'],
  'Life Coaching': ['Certified Life Coach', 'Mindfulness Coach', 'Career Transition Coach'],
  'Companionship': ['Friendly Listener', 'Conversation Partner'],
  'Hobbies & Games': ['Chess Coach', 'Guitar Teacher', 'Photography Mentor'],
};

const REVIEW_AUTHORS = ['Nusrat H.', 'Omar T.', 'Sadia K.', 'Daniel R.', 'Farhan M.', 'Anika B.', 'Rafiq I.', 'Maria G.', 'Tanim S.', 'Anonymous'];
const REVIEW_TEXTS = {
  5: [
    'Absolutely worth every minute. Clear, kind, and genuinely helpful.',
    'Connected within seconds and gave me exactly the guidance I needed.',
    'One call saved me weeks of second-guessing. Highly recommended.',
    'Patient, knowledgeable, and easy to talk to. Will book again.',
  ],
  4: [
    'Very helpful session. A little rushed at the end, but solid advice.',
    'Good practical guidance. Booking took a couple of tries, though.',
    'Knows the subject well. Would have liked more concrete next steps.',
  ],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  console.log('Altering tables...');
  await pool.query("ALTER TABLE advisors ADD COLUMN IF NOT EXISTS title VARCHAR(120) NOT NULL DEFAULT '' AFTER category_id");
  await pool.query('ALTER TABLE advisors ADD COLUMN IF NOT EXISTS about TEXT NULL AFTER bio');
  await pool.query('ALTER TABLE advisors ADD COLUMN IF NOT EXISTS sessions_completed INT UNSIGNED NOT NULL DEFAULT 0 AFTER about');
  await pool.query("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS author_name VARCHAR(80) NOT NULL DEFAULT '' AFTER user_id");

  console.log('Backfilling profile fields...');
  const [advisors] = await pool.query(`
    SELECT a.id, a.name, a.bio, a.title, a.about, a.sessions_completed, a.rating, a.reviews_count, c.name AS category
    FROM advisors a JOIN categories c ON c.id = a.category_id`);

  for (const a of advisors) {
    const title = a.title || pick(TITLES[a.category] || ['Advisor']);
    const about = a.about ||
      `${a.bio} With years of hands-on experience in ${a.category.toLowerCase()}, I keep sessions practical and friendly: tell me what's on your mind, and we'll work through it together — you only pay for the minutes we talk.`;
    const sessions = a.sessions_completed || Math.round(a.reviews_count * (2.5 + Math.random() * 2));
    await pool.query('UPDATE advisors SET title = ?, about = ?, sessions_completed = ? WHERE id = ?',
      [title, about, sessions, a.id]);
  }

  console.log('Seeding reviews for advisors that have none...');
  const [bare] = await pool.query(`
    SELECT a.id, a.rating FROM advisors a
    LEFT JOIN reviews r ON r.advisor_id = a.id
    WHERE r.id IS NULL GROUP BY a.id`);

  const rows = [];
  for (const a of bare) {
    const count = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const stars = Math.random() < Math.min(Number(a.rating) - 4, 0.95) ? 5 : 4;
      rows.push([a.id, pick(REVIEW_AUTHORS), stars, pick(REVIEW_TEXTS[stars]),
        new Date(Date.now() - Math.floor(Math.random() * 90) * 86400000)]);
    }
  }
  if (rows.length) {
    await pool.query('INSERT INTO reviews (advisor_id, author_name, rating, comment, created_at) VALUES ?', [rows]);
  }

  console.log(`Done. Backfilled ${advisors.length} advisors, added ${rows.length} reviews.`);
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
