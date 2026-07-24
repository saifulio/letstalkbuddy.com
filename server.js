require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const pool = require('./db');
const { computeStatus } = require('./availability');
const { runMigrations } = require('./migrate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use(express.static(path.join(__dirname, 'public')));

const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
// Hard cap; the real limit comes from app_settings.max_upload_kb.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please log in first.' });
  next();
}

function requireBody(fields) {
  return (req, res, next) => {
    for (const f of fields) {
      if (!req.body || typeof req.body[f] !== 'string' || !req.body[f].trim()) {
        return res.status(400).json({ error: `Missing field: ${f}` });
      }
    }
    next();
  };
}

// ---------- Auth ----------
app.post('/api/auth/signup', requireBody(['name', 'email', 'password']), async (req, res) => {
  try {
    const name = req.body.name.trim();
    const email = req.body.email.trim().toLowerCase();
    const role = req.body.role === 'advisor' ? 'advisor' : 'seeker';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (req.body.password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const hash = await bcrypt.hash(req.body.password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, role]
    );
    if (role === 'advisor') {
      // Give new advisors a starter profile so they appear in search once
      // they set their availability. Offline until they schedule/toggle it.
      const [[cat]] = await pool.query("SELECT id FROM categories WHERE name = 'Consultant' LIMIT 1");
      if (cat) {
        await pool.query(
          `INSERT INTO advisors (user_id, name, category_id, title, bio, about, rate_per_min, languages, is_online)
           VALUES (?, ?, ?, 'Advisor', 'New advisor on LetsTalkBuddy.', 'New advisor on LetsTalkBuddy.', 1.00, 'English', 0)`,
          [result.insertId, name, cat.id]
        );
      }
    }
    req.session.userId = result.insertId;
    res.status(201).json({ user: { id: result.insertId, name, email, role } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/auth/login', requireBody(['email', 'password']), async (req, res) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    const ok = user && await bcrypt.compare(req.body.password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Incorrect email or password.' });
    req.session.userId = user.id;
    res.json({ user: { id: user.id, name: user.full_name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  try {
    const [rows] = await pool.query(
      'SELECT id, full_name, email, role FROM users WHERE id = ?', [req.session.userId]
    );
    const u = rows[0];
    res.json({ user: u ? { id: u.id, name: u.full_name, email: u.email, role: u.role } : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- Data ----------
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, parent_id, color, tag_bg, tag_color FROM categories ORDER BY id');
    res.json({ categories: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// For advisors linked to a user account, replace the static is_online flag
// with live availability computed from that user's schedule and override.
async function overlayAvailability(rows) {
  const userIds = [...new Set(rows.filter(r => r.user_id).map(r => r.user_id))];
  if (!userIds.length) return;
  const [users] = await pool.query(
    'SELECT id, override_status, override_until FROM users WHERE id IN (?)', [userIds]);
  const [rules] = await pool.query(
    'SELECT * FROM availability_rules WHERE user_id IN (?)', [userIds]);
  const userById = new Map(users.map(u => [u.id, u]));
  const rulesByUser = new Map();
  for (const r of rules) {
    if (!rulesByUser.has(r.user_id)) rulesByUser.set(r.user_id, []);
    rulesByUser.get(r.user_id).push(r);
  }
  for (const a of rows) {
    if (!a.user_id) continue;
    a.is_online = computeStatus(userById.get(a.user_id), rulesByUser.get(a.user_id) || []).online ? 1 : 0;
  }
}

// Expands category ids to include all their descendants (subcategories,
// sub-subcategories, ...), so filtering by "Professional" matches advisors
// in "Doctor", "Software Architect", etc.
async function expandCategoryIds(ids) {
  const [cats] = await pool.query('SELECT id, parent_id FROM categories');
  const children = new Map();
  for (const c of cats) {
    if (c.parent_id) {
      if (!children.has(c.parent_id)) children.set(c.parent_id, []);
      children.get(c.parent_id).push(c.id);
    }
  }
  const out = new Set();
  const stack = [...ids];
  while (stack.length) {
    const id = stack.pop();
    if (out.has(id)) continue;
    out.add(id);
    for (const child of children.get(id) || []) stack.push(child);
  }
  return [...out];
}

app.get('/api/advisors', async (req, res) => {
  try {
    const where = [];
    const params = [];

    if (req.query.q) {
      where.push('(a.name LIKE ? OR a.bio LIKE ? OR c.name LIKE ?)');
      const like = `%${req.query.q}%`;
      params.push(like, like, like);
    }
    if (req.query.categories) {
      const ids = String(req.query.categories).split(',').map(Number).filter(Number.isInteger);
      if (ids.length) {
        const expanded = await expandCategoryIds(ids);
        where.push(`a.category_id IN (${expanded.map(() => '?').join(',')})`);
        params.push(...expanded);
      }
    }
    // For user-linked advisors, is_online is computed after the query, so
    // keep them in the SQL result and filter below.
    if (req.query.online === '1') where.push('(a.is_online = 1 OR a.user_id IS NOT NULL)');
    if (req.query.minRating) {
      where.push('a.rating >= ?');
      params.push(Number(req.query.minRating) || 0);
    }
    if (req.query.maxRate) {
      where.push('a.rate_per_min <= ?');
      params.push(Number(req.query.maxRate) || 999);
    }
    if (req.query.language) {
      where.push('FIND_IN_SET(?, a.languages)');
      params.push(String(req.query.language));
    }

    let orderBy = 'a.rating DESC, a.reviews_count DESC';
    let limit = Math.min(Number(req.query.limit) || 60, 100);
    if (req.query.featured === '1') {
      orderBy = 'a.rating * LOG(a.reviews_count + 1) DESC';
      limit = 4;
    }

    const sql = `
      SELECT a.id, a.user_id, a.name, a.bio, a.rating, a.reviews_count, a.response_minutes,
             a.rate_per_min, a.languages, a.is_online,
             c.id AS category_id, c.name AS category, c.tag_bg, c.tag_color
      FROM advisors a
      JOIN categories c ON c.id = a.category_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ${orderBy}
      LIMIT ${limit}`;

    let [rows] = await pool.query(sql, params);
    await overlayAvailability(rows);
    if (req.query.online === '1') rows = rows.filter(a => a.is_online);
    res.json({ advisors: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.get('/api/advisors/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: 'Advisor not found.' });
  try {
    const [rows] = await pool.query(`
      SELECT a.id, a.user_id, a.name, a.title, a.bio, a.about, a.sessions_completed, a.rating,
             a.reviews_count, a.response_minutes, a.rate_per_min, a.languages, a.is_online,
             c.id AS category_id, c.name AS category, c.tag_bg, c.tag_color
      FROM advisors a
      JOIN categories c ON c.id = a.category_id
      WHERE a.id = ?`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Advisor not found.' });
    await overlayAvailability(rows);

    // Real photos for user-linked advisors (display picture + gallery).
    if (rows[0].user_id) {
      const [photos] = await pool.query(
        "SELECT kind, url FROM photos WHERE user_id = ? ORDER BY kind = 'display' DESC, id DESC LIMIT 20",
        [rows[0].user_id]);
      rows[0].photos = photos;
    }

    // Category breadcrumb, e.g. ["Professional", "Lawyer", "Immigration Consultant"]
    const [cats] = await pool.query('SELECT id, name, parent_id FROM categories');
    const byId = new Map(cats.map(c => [c.id, c]));
    const path = [];
    for (let cur = byId.get(rows[0].category_id); cur; cur = byId.get(cur.parent_id)) {
      path.unshift(cur.name);
    }
    rows[0].category_path = path;

    const [reviews] = await pool.query(
      `SELECT author_name, rating, comment, created_at
       FROM reviews WHERE advisor_id = ?
       ORDER BY created_at DESC LIMIT 20`, [id]);
    res.json({ advisor: rows[0], reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- Profile (settings -> profile) ----------
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

async function getAppSetting(name, fallback) {
  const [rows] = await pool.query('SELECT value FROM app_settings WHERE name = ?', [name]);
  return rows.length ? rows[0].value : fallback;
}

app.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userId;
    const [[user]] = await pool.query('SELECT id, full_name, email FROM users WHERE id = ?', [uid]);
    const [profiles] = await pool.query(`
      SELECT a.id, a.category_id, a.title, a.about, a.rate_per_min, c.name AS category
      FROM advisors a JOIN categories c ON c.id = a.category_id
      WHERE a.user_id = ? ORDER BY a.id`, [uid]);
    const [albums] = await pool.query('SELECT id, name FROM albums WHERE user_id = ? ORDER BY id', [uid]);
    const [photos] = await pool.query(
      'SELECT id, album_id, kind, url, size_bytes FROM photos WHERE user_id = ? ORDER BY id', [uid]);
    const maxUploadKb = Number(await getAppSetting('max_upload_kb', 500));
    res.json({
      name: user.full_name,
      email: user.email,
      profiles,
      displayPhotos: photos.filter(p => p.kind === 'display'),
      albums: albums.map(al => ({
        ...al,
        photos: photos.filter(p => p.kind === 'gallery' && p.album_id === al.id),
      })),
      maxUploadKb,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.put('/api/profile/name', requireAuth, requireBody(['name']), async (req, res) => {
  try {
    const name = req.body.name.trim().slice(0, 120);
    await pool.query('UPDATE users SET full_name = ? WHERE id = ?', [name, req.session.userId]);
    await pool.query('UPDATE advisors SET name = ? WHERE user_id = ?', [name, req.session.userId]);
    res.json({ ok: true, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

function cleanProfileFields(body) {
  const title = String(body.title || '').trim().slice(0, 120);
  const about = String(body.about || '').trim().slice(0, 2000);
  let rate = Number(body.rate_per_min);
  if (!(rate >= 0.25 && rate <= 999)) rate = 1.0;
  return { title, about, rate };
}

app.post('/api/profile/categories', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userId;
    const categoryId = Number(req.body?.category_id);
    const [[cat]] = await pool.query(`
      SELECT c.id, c.name FROM categories c
      LEFT JOIN categories k ON k.parent_id = c.id
      WHERE c.id = ? AND k.id IS NULL`, [categoryId]);
    if (!cat) return res.status(400).json({ error: 'Pick a valid (leaf) category.' });

    const [dupe] = await pool.query(
      'SELECT id FROM advisors WHERE user_id = ? AND category_id = ?', [uid, categoryId]);
    if (dupe.length) return res.status(409).json({ error: `You already have a ${cat.name} profile.` });

    const [[user]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [uid]);
    const { title, about, rate } = cleanProfileFields(req.body || {});
    const [result] = await pool.query(
      `INSERT INTO advisors (user_id, name, category_id, title, bio, about, rate_per_min, languages, is_online)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'English', 0)`,
      [uid, user.full_name, categoryId, title || cat.name,
       (about || 'New advisor on LetsTalkBuddy.').slice(0, 300), about || null, rate]);
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.put('/api/profile/categories/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userId;
    const advisorId = Number(req.params.id);
    const categoryId = Number(req.body?.category_id);
    const [[cat]] = await pool.query(`
      SELECT c.id, c.name FROM categories c
      LEFT JOIN categories k ON k.parent_id = c.id
      WHERE c.id = ? AND k.id IS NULL`, [categoryId]);
    if (!cat) return res.status(400).json({ error: 'Pick a valid (leaf) category.' });
    const [dupe] = await pool.query(
      'SELECT id FROM advisors WHERE user_id = ? AND category_id = ? AND id <> ?', [uid, categoryId, advisorId]);
    if (dupe.length) return res.status(409).json({ error: `You already have a ${cat.name} profile.` });

    const { title, about, rate } = cleanProfileFields(req.body || {});
    const [result] = await pool.query(
      `UPDATE advisors SET category_id = ?, title = ?, about = ?, bio = ?, rate_per_min = ?
       WHERE id = ? AND user_id = ?`,
      [categoryId, title || cat.name, about || null,
       (about || 'New advisor on LetsTalkBuddy.').slice(0, 300), rate, advisorId, uid]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Profile not found.' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.delete('/api/profile/categories/:id', requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM advisors WHERE id = ? AND user_id = ?', [Number(req.params.id), req.session.userId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Profile not found.' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.post('/api/profile/albums', requireAuth, requireBody(['name']), async (req, res) => {
  try {
    const [result] = await pool.query('INSERT INTO albums (user_id, name) VALUES (?, ?)',
      [req.session.userId, req.body.name.trim().slice(0, 80)]);
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.delete('/api/profile/albums/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userId;
    const albumId = Number(req.params.id);
    const [photos] = await pool.query(
      'SELECT url FROM photos WHERE album_id = ? AND user_id = ?', [albumId, uid]);
    const [result] = await pool.query(
      'DELETE FROM albums WHERE id = ? AND user_id = ?', [albumId, uid]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Album not found.' });
    for (const p of photos) {
      fs.unlink(path.join(__dirname, 'public', p.url), () => {});
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.post('/api/profile/photos', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const uid = req.session.userId;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const ext = IMAGE_TYPES[req.file.mimetype];
    if (!ext) return res.status(400).json({ error: 'Only JPEG, PNG, WebP, or GIF images are allowed.' });

    const maxKb = Number(await getAppSetting('max_upload_kb', 500));
    if (req.file.size > maxKb * 1024) {
      return res.status(400).json({ error: `Image is too large — the limit is ${maxKb} kB.` });
    }

    const kind = req.body.kind === 'display' ? 'display' : 'gallery';
    let albumId = null;
    if (kind === 'gallery') {
      albumId = Number(req.body.album_id);
      if (!Number.isInteger(albumId)) {
        return res.status(400).json({ error: 'Create an album first, then upload into it.' });
      }
      const [[album]] = await pool.query(
        'SELECT id FROM albums WHERE id = ? AND user_id = ?', [albumId, uid]);
      if (!album) return res.status(400).json({ error: 'Create an album first, then upload into it.' });
    }

    const filename = `u${uid}-${crypto.randomUUID()}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);
    const url = '/uploads/' + filename;
    const [result] = await pool.query(
      'INSERT INTO photos (user_id, album_id, kind, url, size_bytes) VALUES (?, ?, ?, ?, ?)',
      [uid, albumId, kind, url, req.file.size]);
    res.status(201).json({ id: result.insertId, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.delete('/api/profile/photos/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userId;
    const [[photo]] = await pool.query(
      'SELECT url FROM photos WHERE id = ? AND user_id = ?', [Number(req.params.id), uid]);
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });
    await pool.query('DELETE FROM photos WHERE id = ? AND user_id = ?', [Number(req.params.id), uid]);
    fs.unlink(path.join(__dirname, 'public', photo.url), () => {});
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- Availability settings ----------
const DEFAULT_SETTINGS = {
  timezone: 'GMT+6 · Dhaka', buffer_before: 10, buffer_after: 5, min_notice_hours: 4,
  max_bookings_per_day: 6, session_length: 30, instant_booking: 1, reschedule_notice: 0,
};

function validSlots(slots) {
  if (!Array.isArray(slots)) return null;
  const out = [];
  for (const s of slots) {
    const start = Number(s?.start_minute);
    const end = Number(s?.end_minute);
    if (!Number.isInteger(start) || !Number.isInteger(end) ||
        start < 0 || start >= 1440 || end < 1 || end > 1440 || end <= start) return null;
    out.push({ start_minute: start, end_minute: end });
  }
  return out;
}

app.get('/api/availability', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userId;
    const [[user]] = await pool.query(
      'SELECT id, override_status, override_until FROM users WHERE id = ?', [uid]);
    const [rules] = await pool.query(
      'SELECT * FROM availability_rules WHERE user_id = ? ORDER BY specific_date, start_minute, id', [uid]);
    const [[settingsRow]] = await pool.query('SELECT * FROM user_settings WHERE user_id = ?', [uid]);

    // Weekly rules grouped per day (legacy multi-day rules are expanded).
    const weekly = Array.from({ length: 7 }, () => []);
    for (const r of rules.filter(r => r.kind === 'weekly' && r.enabled)) {
      for (const d of String(r.days_of_week || '').split(',').map(Number)) {
        if (d >= 0 && d <= 6) weekly[d].push({ start_minute: r.start_minute, end_minute: r.end_minute });
      }
    }

    // Date overrides grouped per date.
    const byDate = new Map();
    for (const r of rules.filter(r => r.kind === 'date' && r.enabled)) {
      const date = String(r.specific_date).slice(0, 10);
      if (!byDate.has(date)) byDate.set(date, { date, unavailable: false, slots: [] });
      const o = byDate.get(date);
      if (r.unavailable) o.unavailable = true;
      else o.slots.push({ start_minute: r.start_minute, end_minute: r.end_minute });
    }

    const status = computeStatus(user, rules);
    const overrideActive = user.override_status && user.override_until && new Date(user.override_until) > new Date();
    res.json({
      online: status.online,
      source: status.source,
      override: overrideActive ? { status: user.override_status, until: user.override_until } : null,
      weekly: weekly.map((slots, day) => ({ day, slots })),
      overrides: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
      settings: settingsRow ? { ...settingsRow } : { ...DEFAULT_SETTINGS },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Replaces the whole weekly schedule: [{ day: 0-6, slots: [{start_minute,end_minute}] }]
app.put('/api/availability/weekly', requireAuth, async (req, res) => {
  try {
    const days = Array.isArray(req.body?.days) ? req.body.days : null;
    if (!days) return res.status(400).json({ error: 'Missing days.' });

    const rows = [];
    for (const d of days) {
      const day = Number(d?.day);
      if (!Number.isInteger(day) || day < 0 || day > 6) return res.status(400).json({ error: 'Invalid day.' });
      const slots = validSlots(d?.slots || []);
      if (!slots) return res.status(400).json({ error: 'Each time slot needs a valid start and end.' });
      for (const s of slots) rows.push([req.session.userId, 'weekly', String(day), s.start_minute, s.end_minute]);
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM availability_rules WHERE user_id = ? AND kind = 'weekly'", [req.session.userId]);
      if (rows.length) {
        await conn.query(
          'INSERT INTO availability_rules (user_id, kind, days_of_week, start_minute, end_minute) VALUES ?', [rows]);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Adds/replaces a date override: { date, unavailable } or { date, slots: [...] }
app.post('/api/availability/overrides', requireAuth, async (req, res) => {
  try {
    const date = String(req.body?.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) {
      return res.status(400).json({ error: 'Please pick a valid date.' });
    }
    const unavailable = !!req.body?.unavailable;
    const slots = unavailable ? [] : validSlots(req.body?.slots || []);
    if (!unavailable && (!slots || !slots.length)) {
      return res.status(400).json({ error: 'Add at least one time slot, or mark the date unavailable.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM availability_rules WHERE user_id = ? AND kind = 'date' AND specific_date = ?",
        [req.session.userId, date]);
      const rows = unavailable
        ? [[req.session.userId, 'date', date, 0, 1440, 1]]
        : slots.map(s => [req.session.userId, 'date', date, s.start_minute, s.end_minute, 0]);
      await conn.query(
        'INSERT INTO availability_rules (user_id, kind, specific_date, start_minute, end_minute, unavailable) VALUES ?', [rows]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.delete('/api/availability/overrides/:date', requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM availability_rules WHERE user_id = ? AND kind = 'date' AND specific_date = ?",
      [req.session.userId, req.params.date]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Override not found.' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.put('/api/availability/settings', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const s = {
      timezone: typeof b.timezone === 'string' && b.timezone.length <= 64 ? b.timezone : DEFAULT_SETTINGS.timezone,
      buffer_before: [0, 5, 10, 15].includes(Number(b.buffer_before)) ? Number(b.buffer_before) : DEFAULT_SETTINGS.buffer_before,
      buffer_after: [0, 5, 10, 15].includes(Number(b.buffer_after)) ? Number(b.buffer_after) : DEFAULT_SETTINGS.buffer_after,
      min_notice_hours: [0, 4, 12, 24].includes(Number(b.min_notice_hours)) ? Number(b.min_notice_hours) : DEFAULT_SETTINGS.min_notice_hours,
      max_bookings_per_day: Math.min(50, Math.max(1, Number(b.max_bookings_per_day) || DEFAULT_SETTINGS.max_bookings_per_day)),
      session_length: [15, 30, 45, 60].includes(Number(b.session_length)) ? Number(b.session_length) : DEFAULT_SETTINGS.session_length,
      instant_booking: b.instant_booking ? 1 : 0,
      reschedule_notice: b.reschedule_notice ? 1 : 0,
    };
    await pool.query(
      `INSERT INTO user_settings (user_id, timezone, buffer_before, buffer_after, min_notice_hours,
                                  max_bookings_per_day, session_length, instant_booking, reschedule_notice)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE timezone=VALUES(timezone), buffer_before=VALUES(buffer_before),
         buffer_after=VALUES(buffer_after), min_notice_hours=VALUES(min_notice_hours),
         max_bookings_per_day=VALUES(max_bookings_per_day), session_length=VALUES(session_length),
         instant_booking=VALUES(instant_booking), reschedule_notice=VALUES(reschedule_notice)`,
      [req.session.userId, s.timezone, s.buffer_before, s.buffer_after, s.min_notice_hours,
       s.max_bookings_per_day, s.session_length, s.instant_booking, s.reschedule_notice]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.post('/api/availability/override', requireAuth, async (req, res) => {
  try {
    const status = req.body?.status;
    const hours = Number(req.body?.hours);
    if (!['on', 'off'].includes(status) || !(hours >= 0.5 && hours <= 24)) {
      return res.status(400).json({ error: 'Choose on/off and a duration between 30 minutes and 24 hours.' });
    }
    const until = new Date(Date.now() + hours * 3600000);
    await pool.query('UPDATE users SET override_status = ?, override_until = ? WHERE id = ?',
      [status, until, req.session.userId]);
    res.json({ status, until });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.delete('/api/availability/override', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE users SET override_status = NULL, override_until = NULL WHERE id = ?',
      [req.session.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Apply any pending database migrations before accepting traffic.
runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`LetsTalkBuddy running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Could not start: database migration failed:', err.message);
    process.exit(1);
  });
