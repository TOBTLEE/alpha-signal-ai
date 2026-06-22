require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDb } = require('./src/db');
const { authRoutes, requireAuth, requireAdmin } = require('./src/auth');
const { appRoutes } = require('./src/routes');
const { paymentsRoutes } = require('./src/payments');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.BASE_URL || true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

initDb().then(() => console.log('Database ready')).catch(err => {
  console.error('Database init failed', err);
  process.exit(1);
});

authRoutes(app);
paymentsRoutes(app, requireAuth);
appRoutes(app, requireAuth, requireAdmin);

app.get('/health', (req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Alpha Signal AI running on port ${port}`));
