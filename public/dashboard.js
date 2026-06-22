const $ = id => document.getElementById(id);
let me = null;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1600); }
async function api(url, opts={}){ const r=await fetch(url,{credentials:'include',headers:{'Content-Type':'application/json'},...opts}); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||'操作失敗'); return d; }
async function init(){
  try{
    const data = await api('/api/auth/me');
    me = data.user;
    $('meText').textContent = `${me.name}｜${me.email}｜${me.provider}`;
    $('planText').textContent = String(me.plan || 'free').toUpperCase();
    $('telegramId').value = me.telegram_chat_id || '';
    if(me.role === 'admin') $('adminLink').style.display = '';
    await loadMemberSignals();
  }catch(e){ location.href = '/'; }
}
async function loadMemberSignals(){
  try{
    const { signals } = await api('/api/signals/member');
    if(!signals.length){ $('memberSignals').innerHTML = '<div class="notice">目前尚無保存訊號，請等待管理員掃描。</div>'; return; }
    $('memberSignals').innerHTML = signals.map(s=>`<div class="signalCard"><div class="signalTop"><div><div class="symbol">${s.symbol}</div><div class="muted small">${s.reasons||''}</div></div><span class="pill ${s.side==='short'?'red':'green'}">${s.side==='short'?'空':'多'}</span></div><div class="levels"><div class="level"><span>ENTRY</span><b>${s.entry_low} ~ ${s.entry_high}</b></div><div class="level"><span>TP / SL</span><b>${s.tp1} / ${s.sl}</b></div><div class="level"><span>分數</span><b>${s.score}/100</b></div><div class="level"><span>R:R</span><b>${s.rr||'—'}</b></div></div><p class="muted small">${s.logic||''}</p></div>`).join('');
  }catch(e){ $('memberSignals').innerHTML = `<div class="notice">${e.message}，請升級 Pro 或等待管理員開通。</div>`; }
}
$('saveTelegram').onclick = async()=>{ try{ const d=await api('/api/user/telegram',{method:'PUT',body:JSON.stringify({telegram_chat_id:$('telegramId').value})}); me=d.user; toast('已儲存 Telegram Chat ID'); }catch(e){ toast(e.message); } };
$('logoutBtn').onclick = async()=>{ await api('/api/auth/logout',{method:'POST',body:'{}'}); location.href='/'; };
$('payBtn').onclick = async()=>{ try{ const d=await api('/api/payments/create-checkout',{method:'POST',body:'{}'}); if(d.url) location.href=d.url; else toast(d.message||'已建立付款紀錄'); }catch(e){ toast(e.message); } };
init();
