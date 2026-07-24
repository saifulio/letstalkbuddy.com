// Sample advisor account with a linked user login, weekly availability
// schedule, and booking settings — so every install has one ready-made
// advisor account to test the availability features with.
//
// Login: sara@example.com / testpass123
const PASSWORD_HASH = '$2a$10$38yinkJ4fhteNq4oX7QF.uW56nyzKlGJFIr0lMYhU63bUOiUGDiza'; // testpass123

// Weekly hours (0 = Sunday): Sun-Thu four slots a day, Fri evenings only,
// Sat same as weekdays.
const SLOTS = [
  { start: 540, end: 720 },   // 9:00 AM – 12:00 PM
  { start: 840, end: 1020 },  // 2:00 PM – 5:00 PM
  { start: 1140, end: 1290 }, // 7:00 PM – 9:30 PM
  { start: 1350, end: 1440 }, // 10:30 PM – 12:00 AM
];
const WEEKLY = [
  { day: 0, slots: SLOTS },
  { day: 1, slots: SLOTS },
  { day: 2, slots: SLOTS },
  { day: 3, slots: SLOTS },
  { day: 4, slots: SLOTS },
  { day: 5, slots: [{ start: 1350, end: 1440 }] },
  { day: 6, slots: SLOTS },
];

module.exports.up = async (conn) => {
  const [existing] = await conn.query(
    "SELECT id FROM users WHERE email = 'sara@example.com'");
  if (existing.length) return; // already present

  const [userResult] = await conn.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES ('Sara Advisor', 'sara@example.com', ?, 'advisor')`, [PASSWORD_HASH]);
  const userId = userResult.insertId;

  const [[cat]] = await conn.query("SELECT id FROM categories WHERE name = 'Consultant' LIMIT 1");
  await conn.query(
    `INSERT INTO advisors (user_id, name, category_id, title, bio, about, rate_per_min, languages, is_online)
     VALUES (?, 'Sara Advisor', ?, 'Advisor', 'New advisor on LetsTalkBuddy.',
             'New advisor on LetsTalkBuddy.', 1.00, 'English', 0)`,
    [userId, cat.id]);

  const rows = [];
  for (const d of WEEKLY) {
    for (const s of d.slots) rows.push([userId, 'weekly', String(d.day), s.start, s.end]);
  }
  await conn.query(
    'INSERT INTO availability_rules (user_id, kind, days_of_week, start_minute, end_minute) VALUES ?', [rows]);

  await conn.query(
    `INSERT INTO user_settings (user_id, timezone, buffer_before, buffer_after, min_notice_hours,
                                max_bookings_per_day, session_length, instant_booking, reschedule_notice)
     VALUES (?, 'GMT+0 · London', 15, 0, 12, 8, 15, 1, 1)`, [userId]);
};
