const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const pool   = require('../db/pool');
const config = require('../config');

// POST /auth/register — create tenant + admin user
router.post('/register', async (req, res, next) => {
  try {
    const { storeName, email, password } = req.body;
    if (!storeName || !email || !password) {
      return res.status(400).json({ error: 'storeName, email, password required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tenantId = `tenant_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const userId   = `user_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const hash     = await bcrypt.hash(password, 12);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO tenants (id, name) VALUES ($1, $2)',
        [tenantId, storeName]
      );
      await client.query(
        'INSERT INTO users (id, tenant_id, email, password_hash) VALUES ($1, $2, $3, $4)',
        [userId, tenantId, email.toLowerCase(), hash]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      if (e.constraint === 'users_email_key') {
        return res.status(409).json({ error: 'Email already registered' });
      }
      throw e;
    } finally {
      client.release();
    }

    const token = jwt.sign({ tenantId, userId, email }, config.jwtSecret, { expiresIn: '30d' });
    res.status(201).json({ token, tenantId, email, storeName });
  } catch (e) { next(e); }
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const { rows } = await pool.query(
      'SELECT u.id, u.tenant_id, u.password_hash, t.name AS store_name FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.email = $1',
      [email.toLowerCase()]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { tenantId: user.tenant_id, userId: user.id, email },
      config.jwtSecret,
      { expiresIn: '30d' }
    );
    res.json({ token, tenantId: user.tenant_id, email, storeName: user.store_name });
  } catch (e) { next(e); }
});

// GET /auth/me — verify token and return current user info
router.get('/me', require('../middleware/auth'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT t.name AS store_name FROM tenants t WHERE t.id = $1',
      [req.tenantId]
    );
    res.json({ tenantId: req.tenantId, userId: req.userId, storeName: rows[0]?.store_name });
  } catch (e) { next(e); }
});

module.exports = router;
