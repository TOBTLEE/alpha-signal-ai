const { query } = require('./db');

function paymentsRoutes(app, requireAuth) {
  app.post('/api/payments/create-checkout', requireAuth, async (req, res) => {
    const result = await query(
      `INSERT INTO payments (user_id, provider, status, plan) VALUES ($1, 'manual', 'pending', 'pro') RETURNING id`,
      [req.user.id]
    );
    res.json({ mode: 'manual', payment_id: result.rows[0].id, message: '已建立付款紀錄，請管理員在後台批准開通 Pro。' });
  });

  app.post('/api/admin/payments/:id/approve', requireAuth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理員權限' });
    const p = await query('SELECT * FROM payments WHERE id=$1', [req.params.id]);
    if (!p.rows[0]) return res.status(404).json({ error: '找不到付款紀錄' });
    await query('UPDATE payments SET status=$1, updated_at=NOW() WHERE id=$2', ['paid', req.params.id]);
    await query('UPDATE users SET plan=$1 WHERE id=$2', [p.rows[0].plan, p.rows[0].user_id]);
    res.json({ ok: true });
  });
}
module.exports = { paymentsRoutes };
