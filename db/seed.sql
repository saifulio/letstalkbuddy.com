-- Sample data for LetsTalkBuddy
USE letstalkbuddy;

INSERT INTO categories (name, color, tag_bg, tag_color) VALUES
  ('Health & Medical',    '#E8603C',              'oklch(94% 0.03 35)',  '#B0472C'),
  ('Legal',               'oklch(64% 0.14 260)',  'oklch(94% 0.03 260)', 'oklch(45% 0.12 260)'),
  ('Tech & Career',       'oklch(64% 0.14 220)',  'oklch(94% 0.03 220)', 'oklch(45% 0.12 220)'),
  ('Business Mentorship', 'oklch(64% 0.14 90)',   'oklch(94% 0.03 90)',  'oklch(45% 0.12 90)'),
  ('Life Coaching',       'oklch(64% 0.14 165)',  'oklch(94% 0.03 165)', 'oklch(42% 0.1 165)'),
  ('Companionship',       'oklch(64% 0.14 15)',   'oklch(94% 0.03 15)',  'oklch(45% 0.12 15)'),
  ('Hobbies & Games',     'oklch(64% 0.14 300)',  'oklch(94% 0.03 300)', 'oklch(45% 0.12 300)');

-- Demo user: demo@letstalkbuddy.com / password123 (bcrypt hash)
INSERT INTO users (full_name, email, password_hash, role) VALUES
  ('Demo Seeker', 'demo@letstalkbuddy.com', '$2a$10$/tiBMO0I9J.m3V9QiDRpIOhB1b/u8M20vKU5xY/M3ew4ULBx0GSD.', 'seeker');

INSERT INTO advisors (name, category_id, bio, rating, reviews_count, response_minutes, rate_per_min, languages, is_online) VALUES
  ('Dr. Ayesha Rahman', (SELECT id FROM categories WHERE name='Health & Medical'),    'General physician, 12 yrs experience. Second opinions & wellness advice.',      4.9, 312, 2,  2.50, 'English,Bangla', 1),
  ('James Whitfield',   (SELECT id FROM categories WHERE name='Legal'),               'Contract & immigration law consultations for individuals and startups.',        4.8, 201, 10, 4.00, 'English',        0),
  ('Marcus Chen',       (SELECT id FROM categories WHERE name='Tech & Career'),       'Ex-FAANG engineer. Resume reviews, interview prep, career pivots.',             5.0, 458, 1,  1.80, 'English',        1),
  ('Fatima Noor',       (SELECT id FROM categories WHERE name='Life Coaching'),       'Certified coach helping with habits, focus, and life transitions.',             4.9, 176, 5,  1.50, 'English,Bangla', 0),
  ('Rashed Karim',      (SELECT id FROM categories WHERE name='Business Mentorship'), 'Startup founder turned advisor. Fundraising & go-to-market strategy.',          4.7, 89,  15, 3.20, 'English,Bangla', 1),
  ('Priya Sharma',      (SELECT id FROM categories WHERE name='Companionship'),       'A warm, friendly ear for whenever you need to talk something through.',         4.9, 540, 1,  0.80, 'English,Hindi',  1),
  ('Dr. Naveed Islam',  (SELECT id FROM categories WHERE name='Health & Medical'),    'Psychiatrist offering supportive, judgment-free mental health sessions.',       5.0, 233, 8,  3.50, 'English,Bangla', 0),
  ('Tomas Brennan',     (SELECT id FROM categories WHERE name='Hobbies & Games'),     'FIDE-rated chess coach. Openings, endgames, and live game reviews.',            4.8, 122, 20, 1.20, 'English',        1),
  ('Laila Ahsan',       (SELECT id FROM categories WHERE name='Life Coaching'),       'Career & relationship coaching in English and Bangla.',                         4.9, 97,  3,  1.60, 'English,Bangla', 0);
