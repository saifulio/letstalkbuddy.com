require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const pool = require('./db');

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
    const [rows] = await pool.query('SELECT id, name, color, tag_bg, tag_color FROM categories ORDER BY id');
    res.json({ categories: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

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
        where.push(`a.category_id IN (${ids.map(() => '?').join(',')})`);
        params.push(...ids);
      }
    }
    if (req.query.online === '1') where.push('a.is_online = 1');
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
      SELECT a.id, a.name, a.bio, a.rating, a.reviews_count, a.response_minutes,
             a.rate_per_min, a.languages, a.is_online,
             c.id AS category_id, c.name AS category, c.tag_bg, c.tag_color
      FROM advisors a
      JOIN categories c ON c.id = a.category_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ${orderBy}
      LIMIT ${limit}`;

    const [rows] = await pool.query(sql, params);
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
      SELECT a.id, a.name, a.title, a.bio, a.about, a.sessions_completed, a.rating,
             a.reviews_count, a.response_minutes, a.rate_per_min, a.languages, a.is_online,
             c.id AS category_id, c.name AS category, c.tag_bg, c.tag_color
      FROM advisors a
      JOIN categories c ON c.id = a.category_id
      WHERE a.id = ?`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Advisor not found.' });
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

app.listen(PORT, () => {
  console.log(`LetsTalkBuddy running at http://localhost:${PORT}`);
});
