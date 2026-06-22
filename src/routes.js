const bcrypt = require('bcryptjs');
const { query } = require('./db');
const { scanSignals } = require('./scanner');
const { pushSignal, formatSignal } = require('./telegram');
const { sanitizeUser } = require('./auth');

function round(v){ const n=Number(v); if(!Number.isFinite(n)) return v; if(Math.abs(n)>=1000)return Number(n.toFixed(1)); if(Math.abs(n)>=1)return Number(n.toFixed(4)); if(Math.abs(n)>=0.01)return Number(n.toFixed(5)); return Number(n.toFixed(8)); }
function normalize(s){ return { ...s, entry_low:round(s.entry_low), entry_high:round(s.entry_high), tp1:round(s.tp1), tp2:round(s.tp2), tp3:round(s.tp3), sl:round(s.sl) }; }
async function saveSignal(s, createdBy=null){
  const n=normalize(s);
  const result=await query(
    `INSERT INTO signals (symbol, side, entry_low, entry_high, tp1, tp2, tp3, sl, score, rr, logic, reasons, source, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [n.symbol,n.side,n.entry_low,n.entry_high,n.tp1,n.tp2,n.tp3,n.sl,n.score,n.rr||'',n.logic||'',n.reasons||'',n.source||'scanner',createdBy]
  );
  return result.rows[0];
}

function appRoutes(app, requireAuth, requireAdmin){
  app.get('/api/signals/public', async (req,res)=>{
    const { rows } = await query(`SELECT id,symbol,side,entry_low,entry_high,score,rr,reasons,created_at FROM signals WHERE status='active' ORDER BY created_at DESC LIMIT 12`);
    res.json({ signals: rows });
  });

  app.get('/api/signals/member', requireAuth, async (req,res)=>{
    if(!['pro','team'].includes(req.user.plan) && req.user.role!=='admin') return res.status(402).json({ error:'此功能需要 Pro 會員' });
    const { rows } = await query(`SELECT * FROM signals WHERE status='active' ORDER BY created_at DESC LIMIT 50`);
    res.json({ signals: rows });
  });

  app.put('/api/user/telegram', requireAuth, async (req,res)=>{
    const { telegram_chat_id } = req.body || {};
    const result = await query('UPDATE users SET telegram_chat_id=$1 WHERE id=$2 RETURNING *', [telegram_chat_id||null, req.user.id]);
    res.json({ user: sanitizeUser(result.rows[0]) });
  });

  app.get('/api/admin/users', requireAuth, requireAdmin, async (req,res)=>{
    const { rows } = await query(`SELECT id,name,email,provider,role,plan,telegram_chat_id,created_at,last_login_at,password_hash FROM users ORDER BY created_at DESC`);
    res.json({ users: rows.map(u=>({ ...u, has_password:!!u.password_hash, password_hash_preview:u.password_hash ? u.password_hash.slice(0,18)+'...' : 'Google 登入，無本機密碼', password_hash:undefined })) });
  });

  app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req,res)=>{
    const { role, plan, name } = req.body || {};
    await query('UPDATE users SET role=COALESCE($1,role), plan=COALESCE($2,plan), name=COALESCE($3,name) WHERE id=$4', [role||null, plan||null, name||null, req.params.id]);
    res.json({ ok:true });
  });

  app.post('/api/admin/users/:id/reset-password', requireAuth, requireAdmin, async (req,res)=>{
    const { new_password } = req.body || {};
    if(!new_password || new_password.length<8) return res.status(400).json({ error:'新密碼至少 8 碼' });
    const hash = await bcrypt.hash(new_password, 12);
    await query(`UPDATE users SET password_hash=$1, provider=CASE WHEN provider='google' THEN 'email+google' ELSE provider END WHERE id=$2`, [hash, req.params.id]);
    res.json({ ok:true });
  });

  app.get('/api/admin/signals', requireAuth, requireAdmin, async (req,res)=>{
    const { rows } = await query('SELECT * FROM signals ORDER BY created_at DESC LIMIT 100');
    res.json({ signals: rows });
  });

  app.post('/api/admin/signals/scan', requireAuth, requireAdmin, async (req,res)=>{
    const { limit=25, minScore=65, side='auto', tf='5m' } = req.body || {};
    const found = await scanSignals({ limit:Number(limit), minScore:Number(minScore), side, tf });
    const saved=[];
    for(const s of found.slice(0,12)) saved.push(await saveSignal(s, req.user.id));
    res.json({ signals: saved });
  });

  app.get('/api/admin/signals/:id/text', requireAuth, requireAdmin, async (req,res)=>{
    const { rows } = await query('SELECT * FROM signals WHERE id=$1', [req.params.id]);
    if(!rows[0]) return res.status(404).json({ error:'找不到訊號' });
    res.json({ text: formatSignal(rows[0]) });
  });

  app.post('/api/admin/signals/:id/broadcast', requireAuth, requireAdmin, async (req,res)=>{
    const signal = (await query('SELECT * FROM signals WHERE id=$1', [req.params.id])).rows[0];
    if(!signal) return res.status(404).json({ error:'找不到訊號' });
    const users = (await query(`SELECT * FROM users WHERE plan IN ('pro','team') AND telegram_chat_id IS NOT NULL`)).rows;
    const results=[];
    for(const u of users){ try{ await pushSignal(signal, u); results.push({ user_id:u.id, status:'sent' }); }catch(e){ results.push({ user_id:u.id, status:'failed', error:e.message }); } }
    res.json({ ok:true, results });
  });

  app.get('/api/admin/payments', requireAuth, requireAdmin, async (req,res)=>{
    const { rows } = await query(`SELECT p.*, u.email, u.name FROM payments p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC`);
    res.json({ payments: rows });
  });

  app.get('/api/admin/telegram-logs', requireAuth, requireAdmin, async (req,res)=>{
    const { rows } = await query(`SELECT l.*, u.email, s.symbol FROM telegram_logs l LEFT JOIN users u ON u.id=l.user_id LEFT JOIN signals s ON s.id=l.signal_id ORDER BY l.created_at DESC LIMIT 100`);
    res.json({ logs: rows });
  });
}
module.exports = { appRoutes, saveSignal };
