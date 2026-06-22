const $ = id => document.getElementById(id);
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1600); }
async function api(url, opts={}){ const r=await fetch(url,{credentials:'include',headers:{'Content-Type':'application/json'},...opts}); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||'操作失敗'); return d; }
function openAuth(){ $('authModal').classList.add('active'); }
function closeAuth(){ $('authModal').classList.remove('active'); }
async function loadSignals(){
  try{
    const {signals}=await api('/api/signals/public');
    const rows = signals.length ? signals : [{symbol:'RESOLVUSDT',side:'short',entry_low:0.01755,entry_high:0.01770,score:82,reasons:'上方掃流動性、CHoCH 轉弱',created_at:'Demo'},{symbol:'SOLUSDT',side:'long',entry_low:166.9,entry_high:167.55,score:76,reasons:'下方掃流動性、BOS 轉強',created_at:'Demo'}];
    $('heroSignal').innerHTML = `<div class="signalCard"><div class="signalTop"><div><div class="symbol">${rows[0].symbol}</div><div class="muted small">${rows[0].reasons||''}</div></div><span class="pill ${rows[0].side==='short'?'red':'green'}">${rows[0].side==='short'?'空':'多'}</span></div><div class="levels"><div class="level"><span>ENTRY 摘要</span><b>${rows[0].entry_low} ~ ${rows[0].entry_high}</b></div><div class="level"><span>分數</span><b>${rows[0].score}/100</b></div></div></div>`;
    $('signalsGrid').innerHTML = rows.slice(0,6).map(s=>`<div class="signalCard"><div class="signalTop"><div><div class="symbol">${s.symbol}</div><div class="muted small">${s.reasons||''}</div></div><span class="pill ${s.side==='short'?'red':'green'}">${s.side==='short'?'空':'多'}</span></div><div class="levels"><div class="level"><span>ENTRY 摘要</span><b>${s.entry_low} ~ ${s.entry_high}</b></div><div class="level"><span>分數</span><b>${s.score}/100</b></div></div><p class="muted small">完整 TP / SL / 交易邏輯需登入 Pro 會員。</p></div>`).join('');
    $('marketTable').innerHTML = rows.map(s=>`<tr><td><b>${s.symbol}</b></td><td><span class="pill ${s.side==='short'?'red':'green'}">${s.side==='short'?'空':'多'}</span></td><td>${s.entry_low} ~ ${s.entry_high}</td><td>${s.score}</td><td>${s.created_at}</td></tr>`).join('');
  }catch(e){ toast(e.message); }
}
async function login(){ try{ await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:$('loginEmail').value,password:$('loginPassword').value})}); location.href='/dashboard.html'; }catch(e){ toast(e.message); } }
async function register(){ try{ await api('/api/auth/register',{method:'POST',body:JSON.stringify({name:$('regName').value,email:$('regEmail').value,password:$('regPassword').value})}); location.href='/dashboard.html'; }catch(e){ toast(e.message); } }
async function pay(){ try{ const data=await api('/api/payments/create-checkout',{method:'POST',body:'{}'}); if(data.url) location.href=data.url; else toast(data.message||'已建立付款紀錄'); }catch(e){ openAuth(); toast('請先登入'); } }
['loginBtn','loginBtn2'].forEach(id=>$(id).onclick=openAuth); $('closeAuth').onclick=closeAuth; $('emailLogin').onclick=login; $('emailRegister').onclick=register; $('payBtn').onclick=pay; loadSignals();
