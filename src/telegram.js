const axios = require('axios');
const { query } = require('./db');

function formatSignal(s) {
  const dir = s.side === 'short' ? '空🔴' : '多🟢';
  const entryNote = s.side === 'short' ? '回測空單區間' : '回踩多單區間';
  return `幣種：${s.symbol}\n\n方向：${dir}\n\nENTRY：${s.entry_low} ~ ${s.entry_high} ${entryNote}\n\nTP1：${s.tp1}\nTP2：${s.tp2}\nTP3：${s.tp3}\n\nSL：${s.sl}\n\n【交易邏輯】\n${s.logic || ''}\n\n【AI 掃描依據】\n分數：${s.score}/100｜R:R 約 ${s.rr || '-'}\n${s.reasons || ''}\n\n⚠️風險提示：\n此內容僅為市場掃描與交易計畫參考，非投資建議或獲利保證。合約交易屬高風險商品，請自行評估資金配置、槓桿倍數與可承受虧損，嚴格執行停損。`;
}

async function sendTelegram(chatId, text) {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN 未設定');
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const resp = await axios.post(url, { chat_id: chatId, text, disable_web_page_preview: true });
  return resp.data;
}

async function pushSignal(signal, user) {
  if (!user.telegram_chat_id) throw new Error('使用者尚未設定 Telegram Chat ID');
  try {
    const result = await sendTelegram(user.telegram_chat_id, formatSignal(signal));
    await query('INSERT INTO telegram_logs (signal_id, user_id, chat_id, status, response) VALUES ($1,$2,$3,$4,$5)', [signal.id, user.id, user.telegram_chat_id, 'sent', JSON.stringify(result)]);
    return result;
  } catch (err) {
    await query('INSERT INTO telegram_logs (signal_id, user_id, chat_id, status, response) VALUES ($1,$2,$3,$4,$5)', [signal.id, user.id, user.telegram_chat_id, 'failed', err.message]);
    throw err;
  }
}

module.exports = { sendTelegram, pushSignal, formatSignal };
