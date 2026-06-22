require('dotenv').config();
const { initDb } = require('../src/db');
const { scanSignals } = require('../src/scanner');
const { saveSignal } = require('../src/routes');

(async()=>{
  await initDb();
  const signals = await scanSignals({
    limit: Number(process.env.SCAN_LIMIT || 25),
    minScore: Number(process.env.SCAN_MIN_SCORE || 65),
    side: process.env.SCAN_SIDE || 'auto',
    tf: process.env.SCAN_TF || '5m'
  });
  for(const s of signals.slice(0,12)) await saveSignal(s, null);
  console.log(`saved ${signals.length} signals`);
  process.exit(0);
})().catch(err=>{ console.error(err); process.exit(1); });
