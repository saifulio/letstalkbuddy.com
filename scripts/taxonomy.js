// Category taxonomy: top-level categories with subcategories and
// sub-subcategories. Shared by setup-db.js and migrate-categories.js.

const TAXONOMY = [
  { name: 'Professional', hue: 35, children: [
    'Doctor',
    { name: 'Engineer', children: ['Civil Engineer', 'Software Architect'] },
    'Architect',
    { name: 'Lawyer', children: ['Immigration Consultant'] },
    { name: 'Accountant', children: ['Tax Consultant'] },
    'Consultant', 'Teacher', 'UX Designer', 'Interior Designer',
  ] },
  { name: 'Business', hue: 90, children: [
    'CEO', 'Founder', 'Startup Mentor', 'Investor', 'Business Mentor',
  ] },
  { name: 'Career', hue: 250, children: [
    { name: 'Interview Practice', children: ['Mock HR Interview'] },
    'Resume Review', 'Public Speaking Coach', 'College Admissions Advisor',
  ] },
  { name: 'Education', hue: 220, children: [
    'Tutor', 'Language Tutor',
    { name: 'Coding', children: ['Live Coding', 'Pair Programming', 'Live Debugging'] },
    'Chess Coach', 'Mathematics', 'Music Teacher', 'Cooking Lessons', 'Photography',
  ] },
  { name: 'Lifestyle', hue: 165, children: [
    'Fitness Trainer', 'Yoga', 'Nutrition', 'Fashion Advice', 'Travel Planner',
  ] },
  { name: 'Entertainment', hue: 300, children: [
    'Gaming Partner', 'Chess Partner', 'Movie Discussion', 'Anime', 'Travel Stories',
    'Celebrity Q&A', 'Influencer Fan Calls',
  ] },
  { name: 'Mental Wellness', hue: 260, children: [
    'Psychologist', 'Psychiatrist', 'Listener', 'Life Coach', 'Relationship Coach', 'Parent Advice',
  ] },
  { name: 'Social', hue: 15, children: [
    'Friend', 'Elderly Companion', 'Language Exchange', 'Coffee Chat',
  ] },
  { name: 'Spiritual', hue: 60, children: [
    'Religious Scholar', 'Spiritual Guide',
  ] },
];

function colorsFor(hue) {
  return {
    color: `oklch(64% 0.14 ${hue})`,
    tag_bg: `oklch(94% 0.03 ${hue})`,
    tag_color: `oklch(45% 0.12 ${hue})`,
  };
}

// Inserts the whole tree; returns a Map of category name -> id.
async function seedCategories(pool) {
  const ids = new Map();

  async function insertNode(node, hue, parentId) {
    const name = typeof node === 'string' ? node : node.name;
    const c = colorsFor(hue);
    const [result] = await pool.query(
      'INSERT INTO categories (name, parent_id, color, tag_bg, tag_color) VALUES (?, ?, ?, ?, ?)',
      [name, parentId, c.color, c.tag_bg, c.tag_color]
    );
    ids.set(name, result.insertId);
    for (const child of (typeof node === 'string' ? [] : node.children || [])) {
      await insertNode(child, hue, result.insertId);
    }
  }

  for (const top of TAXONOMY) {
    await insertNode(top, top.hue, null);
  }
  return ids;
}

module.exports = { TAXONOMY, seedCategories };
