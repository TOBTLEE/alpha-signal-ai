const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const crypto = require('crypto');
const { query } = require('./db');

const COOKIE_NAME = 'alpha_token';

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    provider: user.provider,
    role: user.role,
    plan: user.plan,
    telegram_chat_id: user.telegram_chat_id || '',
    created_at: user.created_at,
    last_login_at: user.last_login_at,
    has_password: !!user.password_hash
  };
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, plan: user.plan },
    process.env.JWT_SECRET || 'dev_secret_change_me',
    { expiresIn: '7d' }
  );
}

function setAuthCookie(res, user) {
  res.cookie(COOKIE_NAME, signToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

async function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: '請先登入' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me');
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [payload.id]);
    if (!rows[0]) return res.status(401).json({ error: '登入狀態已失效' });
    req.user = rows[0];
    next();
  } catch (err) {
    res.status(401).json({ error: '登入狀態已失效' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: '需要管理員權限' });
  next();
}

function authRoutes(app) {
  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: '請填寫名稱、信箱、密碼' });
    if (String(password).length < 8) return res.status(400).json({ error: '密碼至少 8 碼' });
    const normalizedEmail = String(email).toLowerCase().trim();
    const exists = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (exists.rowCount) return res.status(409).json({ error: '此信箱已註冊' });
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (name, email, password_hash, provider, role, plan)
       VALUES ($1,$2,$3,'email','user','free') RETURNING *`,
      [name, normalizedEmail, hash]
    );
    setAuthCookie(res, result.rows[0]);
    res.json({ user: sanitizeUser(result.rows[0]) });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const result = await query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: '信箱或密碼錯誤' });
    const ok = await bcrypt.compare(password || '', user.password_hash);
    if (!ok) return res.status(401).json({ error: '信箱或密碼錯誤' });
    const fresh = await query('UPDATE users SET last_login_at = NOW() WHERE id = $1 RETURNING *', [user.id]);
    setAuthCookie(res, fresh.rows[0]);
    res.json({ user: sanitizeUser(fresh.rows[0]) });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: sanitizeUser(req.user) }));

  app.get('/api/auth/google', (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(400).send('尚未設定 GOOGLE_CLIENT_ID');
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL}/api/auth/google/callback`;
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie('google_oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000 });
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || !state || state !== req.cookies.google_oauth_state) return res.status(400).send('Google 登入驗證失敗');
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL}/api/auth/google/callback`;
      const tokenResp = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const userInfo = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResp.data.access_token}` }
      });
      const google = userInfo.data;
      const email = String(google.email || '').toLowerCase();
      if (!email) return res.status(400).send('Google 帳號沒有信箱資料');
      let result = await query('SELECT * FROM users WHERE email = $1', [email]);
      let user = result.rows[0];
      if (!user) {
        result = await query(
          `INSERT INTO users (name, email, provider, google_id, role, plan, last_login_at)
           VALUES ($1,$2,'google',$3,'user','free',NOW()) RETURNING *`,
          [google.name || email, email, google.sub]
        );
        user = result.rows[0];
      } else {
        result = await query(
          `UPDATE users SET provider = CASE WHEN provider = 'email' THEN 'email+google' ELSE provider END,
            google_id = COALESCE(google_id, $1), last_login_at = NOW()
           WHERE id = $2 RETURNING *`,
          [google.sub, user.id]
        );
        user = result.rows[0];
      }
      setAuthCookie(res, user);
      res.clearCookie('google_oauth_state');
      res.redirect('/dashboard.html');
    } catch (err) {
      console.error(err.response?.data || err.message);
      res.status(500).send('Google 登入失敗，請檢查 OAuth 設定');
    }
  });
}

module.exports = { authRoutes, requireAuth, requireAdmin, sanitizeUser };
