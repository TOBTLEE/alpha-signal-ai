const axios = require('axios');

const BASE = 'https://fapi.binance.com';

function mean(a){ return a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0; }
function kline(k){ return { open:+k[1], high:+k[2], low:+k[3], close:+k[4], volume:+k[5] }; }
function ema(values, period){ const k=2/(period+1); let out=[], prev=values[0]||0; values.forEach((v,i)=>{ prev=i===0?v:v*k+prev*(1-k); out.push(prev); }); return out; }
function rsi(values, period=14){ if(values.length<period+2)return 50; let g=0,l=0; for(let i=values.length-period;i<values.length;i++){ const d=values[i]-values[i-1]; if(d>=0)g+=d; else l-=d; } if(l===0)return 100; const rs=g/l; return 100-100/(1+rs); }
function atr(c, period=14){ if(c.length<period+2)return 0; const out=[]; for(let i=c.length-period;i<c.length;i++){ const x=c[i], p=c[i-1]; out.push(Math.max(x.high-x.low, Math.abs(x.high-p.close), Math.abs(x.low-p.close))); } return mean(out); }
function swing(c, lookback=38, exclude=4){ const p=c.slice(Math.max(0,c.length-lookback-exclude), c.length-exclude); return { high:Math.max(...p.map(x=>x.high)), low:Math.min(...p.map(x=>x.low)) }; }
function higherTf(tf){ return tf === '5m' ? '15m' : '1h'; }
async function getJson(url){ const r=await axios.get(url,{timeout:12000}); return r.data; }
async function getKlines(symbol, interval, limit=160){ return (await getJson(`${BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)).map(kline); }

async function getSymbols(limit=25){
  const [info,tickers] = await Promise.all([getJson(`${BASE}/fapi/v1/exchangeInfo`), getJson(`${BASE}/fapi/v1/ticker/24hr`)]);
  const ok = new Set((info.symbols||[]).filter(s=>s.status==='TRADING'&&s.quoteAsset==='USDT'&&s.contractType==='PERPETUAL').map(s=>s.symbol));
  return tickers.filter(t=>ok.has(t.symbol)&&!/(UP|DOWN|BULL|BEAR)USDT$/.test(t.symbol)).sort((a,b)=>Number(b.quoteVolume)-Number(a.quoteVolume)).slice(0,limit);
}

function analyzeSymbol(ticker, candles, higher, config={}){
  const symbol=ticker.symbol, closes=candles.map(c=>c.close), vols=candles.map(c=>c.volume), last=candles[candles.length-1], close=last.close;
  const e20=ema(closes,20), e50=ema(closes,50), a=atr(candles,14)||close*.008, rrsi=rsi(closes,14), prevRsi=rsi(closes.slice(0,-1),14);
  const sw=swing(candles), recent=candles.slice(-5), sweepHigh=Math.max(...recent.map(c=>c.high))>sw.high&&close<sw.high, sweepLow=Math.min(...recent.map(c=>c.low))<sw.low&&close>sw.low;
  const volSpike=last.volume>mean(vols.slice(-22,-1))*1.18, below=close<e20.at(-1)&&e20.at(-1)<e50.at(-1), above=close>e20.at(-1)&&e20.at(-1)>e50.at(-1);
  const shortBreak=close<Math.min(...candles.slice(-9,-2).map(c=>c.low)), longBreak=close>Math.max(...candles.slice(-9,-2).map(c=>c.high));
  const hCloses=higher.map(c=>c.close), h20=ema(hCloses,20), h50=ema(hCloses,50), hClose=hCloses.at(-1), hBear=hClose<h20.at(-1)||h20.at(-1)<h50.at(-1), hBull=hClose>h20.at(-1)||h20.at(-1)>h50.at(-1);
  let ss=30, sr=[]; if(sweepHigh){ss+=24;sr.push('上方掃流動性')} if(shortBreak){ss+=17;sr.push('低級別 CHoCH 轉弱')} if(below){ss+=15;sr.push('EMA 趨勢偏空')} if(rrsi<52||rrsi<prevRsi){ss+=9;sr.push('RSI 轉弱')} if(volSpike){ss+=8;sr.push('成交量放大')} if(hBear){ss+=10;sr.push('高週期偏空')}
  let ls=30, lr=[]; if(sweepLow){ls+=24;lr.push('下方掃流動性')} if(longBreak){ls+=17;lr.push('低級別 BOS 轉強')} if(above){ls+=15;lr.push('EMA 趨勢偏多')} if(rrsi>48||rrsi>prevRsi){ls+=9;lr.push('RSI 轉強')} if(volSpike){ls+=8;lr.push('成交量放大')} if(hBull){ls+=10;lr.push('高週期偏多')}
  const filter=config.side||'auto'; const side = filter==='short'||(filter==='auto'&&ss>=ls) ? 'short' : 'long'; const score=Math.max(0,Math.min(100,Math.round(side==='short'?ss:ls))); const reasons=(side==='short'?sr:lr); if(!reasons.length) reasons.push(side==='short'?'結構偏空但尚未完整確認':'結構偏多但尚未完整確認');
  let entry_low, entry_high, sl, tp1, tp2, tp3; const m=[1,1.8,3];
  if(side==='short'){ entry_low=close+a*.20; entry_high=close+a*.78; const mid=(entry_low+entry_high)/2; sl=entry_high+Math.max(a*.65,close*.0015); const risk=sl-mid; tp1=mid-risk*m[0]; tp2=mid-risk*m[1]; tp3=mid-risk*m[2]; }
  else { entry_high=close-a*.20; entry_low=close-a*.78; const mid=(entry_low+entry_high)/2; sl=entry_low-Math.max(a*.65,close*.0015); const risk=mid-sl; tp1=mid+risk*m[0]; tp2=mid+risk*m[1]; tp3=mid+risk*m[2]; }
  const tf=config.tf||'5m'; const logic=side==='short'?`${reasons.includes('上方掃流動性')?'上方掃流動性':'上方流動性區域受阻'} → ${reasons.includes('低級別 CHoCH 轉弱')?'低級別 CHoCH 轉弱':'短線結構轉弱'} →\n回測 ${tf} 空方 OB / 結構壓力區進場`:`${reasons.includes('下方掃流動性')?'下方掃流動性':'下方流動性區域承接'} → ${reasons.includes('低級別 BOS 轉強')?'低級別 BOS 轉強':'短線結構轉強'} →\n回踩 ${tf} 多方 OB / 結構支撐區進場`;
  const mid=(entry_low+entry_high)/2; return { symbol, side, entry_low, entry_high, tp1, tp2, tp3, sl, score, rr:(Math.abs(tp2-mid)/Math.abs(mid-sl)).toFixed(2), logic, reasons:reasons.join('、') };
}

async function scanSignals({limit=25,minScore=65,side='auto',tf='5m'}={}){
  const symbols=await getSymbols(limit); const out=[];
  for(const t of symbols){ try{ const [k1,k2]=await Promise.all([getKlines(t.symbol,tf), getKlines(t.symbol,higherTf(tf),120)]); const s=analyzeSymbol(t,k1,k2,{side,tf}); if(s.score>=minScore) out.push(s); } catch(e){} }
  return out.sort((a,b)=>b.score-a.score);
}
module.exports = { scanSignals };
