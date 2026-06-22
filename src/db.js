const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      provider TEXT NOT NULL DEFAULT 'email',
      google_id TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      plan TEXT NOT NULL DEFAULT 'free',
      telegram_chat_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS signals (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      entry_low NUMERIC NOT NULL,
      entry_high NUMERIC NOT NULL,
      tp1 NUMERIC NOT NULL,
      tp2 NUMERIC NOT NULL,
      tp3 NUMERIC NOT NULL,
      sl NUMERIC NOT NULL,
      score INTEGER NOT NULL,
      rr TEXT,
      logic TEXT,
      reasons TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      source TEXT NOT NULL DEFAULT 'scanner',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      provider TEXT NOT NULL,
      provider_session_id TEXT,
      amount INTEGER,
      currency TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      plan TEXT NOT NULL DEFAULT 'pro',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS telegram_logs (
      id SERIAL PRIMARY KEY,
      signal_id INTEGER REFERENCES signals(id),
      user_id INTEGER REFERENCES users(id),
      chat_id TEXT,
      status TEXT NOT NULL,
      response TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const exists = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);
  if (exists.rowCount === 0) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12);
    await query(
      `INSERT INTO users (name, email, password_hash, provider, role, plan)
       VALUES ($1, $2, $3, 'email', 'admin', 'pro')`,
      [process.env.ADMIN_NAME || '站長', adminEmail, hash]
    );
  }
}

module.exports = { pool, query, initDb };
