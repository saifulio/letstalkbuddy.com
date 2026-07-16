// Generates additional random advisors.
// Usage: npm run db:add-data            (adds 20)
//        node scripts/add-advisors.js 50 (adds 50)
require('dotenv').config();
const pool = require('../db');

const FIRST = ['Ayesha', 'Rahim', 'Nusrat', 'Kamal', 'Sadia', 'Tanvir', 'Mehnaz', 'Arif', 'Farzana', 'Imran',
  'Sofia', 'Daniel', 'Grace', 'Omar', 'Elena', 'Ravi', 'Mina', 'Jonas', 'Aisha', 'Leo'];
const LAST = ['Rahman', 'Chowdhury', 'Akter', 'Hossain', 'Islam', 'Khan', 'Ahmed', 'Begum', 'Sarker', 'Uddin',
  'Chen', 'Garcia', 'Petrov', 'Okafor', 'Silva', 'Novak', 'Tanaka', 'Weber', 'Rossi', 'Kim'];

const BIOS = {
  'Health & Medical': ['Family medicine specialist offering second opinions and health guidance.', 'Nutritionist helping you build sustainable, healthy eating habits.', 'Physiotherapist advising on recovery, posture, and pain management.'],
  'Legal': ['Corporate lawyer advising startups on contracts and compliance.', 'Family law consultant for sensitive, practical guidance.', 'Property and tenancy law advice for renters and landlords.'],
  'Tech & Career': ['Senior engineer offering code reviews and system design coaching.', 'Tech recruiter sharing insider tips on interviews and offers.', 'Product manager helping you break into tech roles.'],
  'Business Mentorship': ['Serial entrepreneur mentoring early-stage founders.', 'E-commerce operator sharing playbooks for online sellers.', 'Finance professional advising on budgeting and business plans.'],
  'Life Coaching': ['Certified coach for goal-setting, habits, and accountability.', 'Mindfulness practitioner helping with stress and focus.', 'Career transition coach for people at a crossroads.'],
  'Companionship': ['A friendly, patient listener for whatever is on your mind.', 'Great conversation over coffee — virtually. No judgment, ever.', 'Here to chat about life, culture, and everything in between.'],
  'Hobbies & Games': ['Chess coach for beginners through club players.', 'Guitar teacher offering song-based, fun lessons.', 'Photography mentor for composition and editing feedback.'],
};

const LANG_SETS = ['English', 'English,Bangla', 'English,Hindi', 'English,Bangla,Hindi', 'Bangla'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.random() * (max - min) + min;

async function main() {
  const count = Math.max(1, parseInt(process.argv[2], 10) || 20);
  const [cats] = await pool.query('SELECT id, name FROM categories');
  if (!cats.length) {
    throw new Error('No categories found. Run "npm run db:setup" first.');
  }

  const rows = [];
  for (let i = 0; i < count; i++) {
    const cat = pick(cats);
    rows.push([
      `${pick(FIRST)} ${pick(LAST)}`,
      cat.id,
      pick(BIOS[cat.name] || ['Experienced advisor ready to help.']),
      (Math.round(rand(3.8, 5.0) * 10) / 10).toFixed(1),
      Math.floor(rand(5, 600)),
      Math.floor(rand(1, 30)),
      (Math.round(rand(0.5, 5.0) * 4) / 4).toFixed(2),
      pick(LANG_SETS),
      Math.random() < 0.45 ? 1 : 0,
    ]);
  }

  await pool.query(
    `INSERT INTO advisors
       (name, category_id, bio, rating, reviews_count, response_minutes, rate_per_min, languages, is_online)
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
