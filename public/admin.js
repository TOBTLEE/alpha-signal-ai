const $ = id => document.getElementById(id);
let users = [], signals = [], payments = [];
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1600); }
async function api(url, opts={}){ const r=await fetch(url,{credentials:'include',headers:{'Content-Type':'application/json'},...opts}); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||'操作失敗'); return d; }
async function guard(){ try{ const { user } = await api('/api/auth/me'); if(user.role !== 'admin') location.href='/dashboard.html'; }catch(e){ location.href='/'; } }
async function loadUsers(){
  const d = await api('/api/admin/users'); users = d.users; $('userCount').textContent = users.length;
  $('usersTable').innerHTML = users.map(u=>`<tr><td>${u.id}</td><td>${u.name}</td><td>${u.email}</td><td>${u.provider}</td><td>${u.password_hash_preview}</td><td><select onchange="updateUser(${u.id}, 'plan', this.value)"><option ${u.plan==='free'?'selected':''}>free</option><option ${u.plan==='pro'?'selected':''}>pro</option><option ${u.plan==='team'?'selected':''}>team</option></select></td><td><select onchange="updateUser(${u.id}, 'role', this.value)"><option ${u.role==='user'?'selected':''}>user</option><option ${u.role==='admin'?'selected':''}>admin</option></select></td><td>${u.telegram_chat_id||'—'}</td><td>${new Date(u.created_at).toLocaleString('zh-TW')}</td></tr>`).join('');
}
window.updateUser = async(id,key,value)=>{ try{ await api('/api/admin/users/'+id,{method:'PATCH',body:JSON.stringify({[key]:value})}); toast('已更新'); }catch(e){ toast(e.message); } };
async function loadSignals(){
  const d = await api('/api/admin/signals'); signals = d.signals; $('signalCount').textContent = signals.length;
  $('signalsTable').innerHTML = signals.map(s=>`<tr><td>${s.id}</td><td><b>${s.symbol}</b></td><td><span class="pill ${s.side==='short'?'red':'green'}">${s.side==='short'?'空':'多'}</span></td><td>${s.entry_low} ~ ${s.entry_high}</td><td>${s.tp1} / ${s.sl}</td><td>${s.score}</td><td>${new Date(s.created_at).toLocaleString('zh-TW')}</td><td><button class="btn small secondary" onclick="showText(${s.id})">文案</button> <button class="btn small" onclick="broadcast(${s.id})">推播</button></td></tr>`).join('');
}
window.showText = async(id)=>{ try{ const d=await api('/api/admin/signals/'+id+'/text'); alert(d.text); }catch(e){ toast(e.message); } };
window.broadcast = async(id)=>{ if(!confirm('確認推播給所有有 Telegram Chat ID 的 Pro / Team 會員？')) return; try{ const d=await api('/api/admin/signals/'+id+'/broadcast',{method:'POST',body:'{}'}); toast('推播完成：'+d.results.length+' 位'); loadTelegramCount(); }catch(e){ toast(e.message); } };
async function scan(){
  try{
    $('scanBtn').disabled = true; $('scanBtn').textContent = '掃描中...';
    await api('/api/admin/signals/scan',{method:'POST',body:JSON.stringify({limit:+$('scanLimit').value,minScore:+$('scanScore').value,side:$('scanSide').value,tf:$('scanTf').value})});
    toast('掃描保存完成'); loadSignals();
  }catch(e){ toast(e.message); }
  finally{ $('scanBtn').disabled=false; $('scanBtn').textContent='開始掃描並保存'; }
}
async function loadPayments(){
  const d = await api('/api/admin/payments'); payments = d.payments; $('paymentCount').textContent = payments.length;
  $('paymentsTable').innerHTML = payments.map(p=>`<tr><td>${p.id}</td><td>${p.name}<br><span class="muted small">${p.email}</span></td><td>${p.plan}</td><td>${p.status}</td><td>${p.provider}</td><td>${new Date(p.created_at).toLocaleString('zh-TW')}</td><td>${p.status==='paid'?'—':`<button class="btn small" onclick="approvePay(${p.id})">批准</button>`}</td></tr>`).join('');
}
window.approvePay = async(id)=>{ try{ await api('/api/admin/payments/'+id+'/approve',{method:'POST',body:'{}'}); toast('已批准並開通方案'); loadPayments(); loadUsers(); }catch(e){ toast(e.message); } };
async function loadTelegramCount(){ try{ const d=await api('/api/admin/telegram-logs'); $('telegramCount').textContent=d.logs.length; }catch(e){ $('telegramCount').textContent='0'; } }
$('refreshUsers').onclick = loadUsers; $('refreshSignals').onclick = loadSignals; $('scanBtn').onclick = scan;
$('logoutBtn').onclick = async()=>{ await api('/api/auth/logout',{method:'POST',body:'{}'}); location.href='/'; };
guard().then(()=>Promise.all([loadUsers(), loadSignals(), loadPayments(), loadTelegramCount()])).catch(e=>toast(e.message));
