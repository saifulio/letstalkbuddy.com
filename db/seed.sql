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

INSERT INTO advisors (name, category_id, title, bio, about, sessions_completed, rating, reviews_count, response_minutes, rate_per_min, languages, is_online) VALUES
  ('Dr. Ayesha Rahman', (SELECT id FROM categories WHERE name='Health & Medical'),    'General Physician',      'General physician, 12 yrs experience. Second opinions & wellness advice.',      'I''m a licensed general physician with 12 years of clinical experience, now offering second opinions, symptom guidance, and general wellness consultations over voice and chat. I keep things clear and judgment-free — bring your questions, reports, or just a nagging worry you want to talk through.', 1240, 4.9, 312, 2,  2.50, 'English,Bangla', 1),
  ('James Whitfield',   (SELECT id FROM categories WHERE name='Legal'),               'Contract & Immigration Lawyer', 'Contract & immigration law consultations for individuals and startups.',   'Practicing lawyer with 15 years across contract and immigration law. I help individuals and startups understand agreements, visas, and disputes in plain English — before things get expensive.', 780, 4.8, 201, 10, 4.00, 'English',        0),
  ('Marcus Chen',       (SELECT id FROM categories WHERE name='Tech & Career'),       'Senior Software Engineer','Ex-FAANG engineer. Resume reviews, interview prep, career pivots.',             'Ex-FAANG senior engineer and interview coach. I''ve run 500+ mock interviews and resume reviews. Whether you''re breaking into tech or aiming for staff level, I''ll give you direct, actionable feedback.', 1820, 5.0, 458, 1,  1.80, 'English',        1),
  ('Fatima Noor',       (SELECT id FROM categories WHERE name='Life Coaching'),       'Certified Life Coach',   'Certified coach helping with habits, focus, and life transitions.',             'ICF-certified coach specialising in habits, focus, and major life transitions. My sessions are structured but warm — we set one clear goal per call and leave with concrete next steps.', 640, 4.9, 176, 5,  1.50, 'English,Bangla', 0),
  ('Rashed Karim',      (SELECT id FROM categories WHERE name='Business Mentorship'), 'Startup Founder & Mentor','Startup founder turned advisor. Fundraising & go-to-market strategy.',         'Founded and exited two startups in Dhaka and Singapore. I mentor early-stage founders on fundraising, go-to-market, and the hundred small decisions no one warns you about.', 310, 4.7, 89,  15, 3.20, 'English,Bangla', 1),
  ('Priya Sharma',      (SELECT id FROM categories WHERE name='Companionship'),       'Friendly Listener',      'A warm, friendly ear for whenever you need to talk something through.',         'Sometimes you just need someone to talk to — no advice, no judgment, just a warm, attentive ear. I''m here for late-night worries, everyday adda, and everything in between.', 2150, 4.9, 540, 1,  0.80, 'English,Hindi',  1),
  ('Dr. Naveed Islam',  (SELECT id FROM categories WHERE name='Health & Medical'),    'Psychiatrist',           'Psychiatrist offering supportive, judgment-free mental health sessions.',       'Board-certified psychiatrist offering supportive, judgment-free conversations about anxiety, low mood, sleep, and stress. Note: sessions are advisory and not a substitute for emergency care.', 890, 5.0, 233, 8,  3.50, 'English,Bangla', 0),
  ('Tomas Brennan',     (SELECT id FROM categories WHERE name='Hobbies & Games'),     'FIDE Chess Coach',       'FIDE-rated chess coach. Openings, endgames, and live game reviews.',            'FIDE-rated coach (2100+) teaching players from beginner to club level. We''ll review your games live, fix your openings, and build an endgame you can trust.', 450, 4.8, 122, 20, 1.20, 'English',        1),
  ('Laila Ahsan',       (SELECT id FROM categories WHERE name='Life Coaching'),       'Career & Relationship Coach', 'Career & relationship coaching in English and Bangla.',                    'Career and relationship coach working in English and Bangla. I help you untangle hard decisions — job offers, family expectations, difficult conversations — with structure and empathy.', 380, 4.9, 97,  3,  1.60, 'English,Bangla', 0);

INSERT INTO reviews (advisor_id, author_name, rating, comment, created_at) VALUES
  ((SELECT id FROM advisors WHERE name='Dr. Ayesha Rahman'), 'Nusrat H.',  5, 'Incredibly patient and thorough. Explained my lab results in plain language and put my mind at ease.', NOW() - INTERVAL 2 DAY),
  ((SELECT id FROM advisors WHERE name='Dr. Ayesha Rahman'), 'Michael O.', 5, 'Quick to connect and genuinely knowledgeable. Worth every minute.', NOW() - INTERVAL 7 DAY),
  ((SELECT id FROM advisors WHERE name='Dr. Ayesha Rahman'), 'Farzana A.', 4, 'Great second opinion before a procedure. Would have liked a slightly longer call, but very helpful.', NOW() - INTERVAL 21 DAY),
  ((SELECT id FROM advisors WHERE name='Marcus Chen'),       'Sadia K.',   5, 'His mock interview was harder than my real one — and that''s exactly why I passed.', NOW() - INTERVAL 3 DAY),
  ((SELECT id FROM advisors WHERE name='Marcus Chen'),       'Daniel R.',  5, 'Rewrote my resume live on the call. Got three callbacks the following week.', NOW() - INTERVAL 12 DAY),
  ((SELECT id FROM advisors WHERE name='Priya Sharma'),      'Anonymous',  5, 'I just needed someone to listen after a rough week. She was kind, present, and never rushed me.', NOW() - INTERVAL 1 DAY),
  ((SELECT id FROM advisors WHERE name='James Whitfield'),   'Omar T.',    5, 'Reviewed my employment contract clause by clause. Saved me from a nasty non-compete.', NOW() - INTERVAL 9 DAY),
  ((SELECT id FROM advisors WHERE name='Tomas Brennan'),     'Rafiq I.',   5, 'Found the exact hole in my Sicilian prep within ten minutes. Brilliant coach.', NOW() - INTERVAL 5 DAY);
