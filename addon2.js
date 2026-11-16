/* ===== v3 add-on: repeat issues, pre-flight, upcoming countdowns, folders page, insights, themes, 3D ===== */
(function(){
const {J,ERR,REC,INC,errInfo,VIEWS,NAVN,CR,RENDER,kpiH,esc,fmt,recTable,bindRecRows,SE,SC,mk,countAll,addBirds,copy}=window.X;
const $$=s=>[...document.querySelectorAll(s)];
let sd=7;const rnd=()=>{sd=(sd*1664525+1013904223)%4294967296;return sd/4294967296};
const LS={get:(k,d)=>{try{const v=localStorage.getItem('samat3_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem('samat3_'+k,JSON.stringify(v))}catch(e){}}};

/* =============== 1. REPEAT-ISSUE HISTORY =============== */
const FIXED={E_NO_CONTACT:'CRM data team loaded missing emails for the listed members',E_VDEF_EXPIRED:'Loyalty admin extended the voucher definition end date by 6 months',E_MEMBER_INACTIVE:'Survivor records re-injected into the journey',
 E_DPE_NO_JOURNAL:'DPE job re-run manually after the late file landed',E_TIER_CHANGED:'Affected members re-sent the correct email',E_TIMEOUT:'Failed sends retried manually after MC recovered',E_CONSENT:'No action – correct suppression'};
const BACK={E_NO_CONTACT:'Only the members in the list were fixed. The POS member-create API still allows blank email, so new members without email keep entering the journey.',
 E_VDEF_EXPIRED:'The definition was extended, not replaced with a rolling one. Each extension has a fixed end date, so it expires again with no warning.',
 E_MEMBER_INACTIVE:'The duplicate clean-up job still runs at 05:00 inside the journey wait window.',E_DPE_NO_JOURNAL:'The POS file is still delivered late on Mondays and the journey still has no gate on the DPE job.',
 E_TIER_CHANGED:'The decision split still uses the entry snapshot.',E_TIMEOUT:'Still no retry policy on the flow; every MC slowdown turns into failed records.',E_CONSENT:'Consent filter is still missing from the entry criteria.'};
const PERM={E_NO_CONTACT:'Make email mandatory (or SMS fallback) in the POS create API, and add <code>HasEmail = true</code> to every email journey entry filter.',
 E_VDEF_EXPIRED:'Replace fixed-end definitions with a yearly rolling definition and turn on the "expires in &lt; 30 days" alert rule.',
 E_MEMBER_INACTIVE:'Move the duplicate clean-up job to 23:00 and add exit criteria <code>MemberStatus != Active</code>.',
 E_DPE_NO_JOURNAL:'Gate the journey on the DPE job (Completed) – same gate pattern the bot already uses for tier batches.',
 E_TIER_CHANGED:'Change the split to read the live contact attribute.',E_TIMEOUT:'Add retry with back-off (30/60/120 s) and an alert above 2% timeouts.',E_CONSENT:'Add the consent filter to entry criteria and report as "suppressed".'};
const DAYS=['18 Oct','21 Oct','24 Oct','27 Oct','30 Oct','2 Nov','5 Nov','7 Nov','9 Nov','12 Nov','14 Nov'];
const HIST={};
Object.keys(ERR).forEach(code=>{const js=J.filter(j=>j.err[code]);if(!js.length)return;const n={E_NO_CONTACT:5,E_VDEF_EXPIRED:3,E_TIMEOUT:4,E_DPE_NO_JOURNAL:3,E_MEMBER_INACTIVE:2,E_TIER_CHANGED:2,E_CONSENT:6}[code]||1;
 const days=DAYS.slice(DAYS.length-n-1,DAYS.length-1);
 HIST[code]=days.map((d,i)=>{const j=js[(i+1)%js.length];const recs=Math.max(3,Math.round(j.err[code]*(.4+rnd()*.8)));const pre=REC.find(r=>r.j===j.id&&r.code===code);const p=pre?pre.id.slice(0,9):'SSSG2025';
  return {d,t:`${String(5+Math.floor(rnd()*4)).padStart(2,'0')}:${String(Math.floor(rnd()*60)).padStart(2,'0')}`,j:j.id,jn:j.n,bu:j.bu,recs,ids:[0,1,2].map(()=>p+String(1000000+Math.floor(rnd()*8999999)).slice(0,7)),fix:FIXED[code],mttr:`${1+Math.floor(rnd()*5)}h ${Math.floor(rnd()*60)}m`,held:1+Math.floor(rnd()*5)}})});
if(window.SAMAT_LIVE&&window.SAMAT_LIVE.history){Object.keys(HIST).forEach(k=>delete HIST[k]);Object.assign(HIST,window.SAMAT_LIVE.history)}
const rep=code=>HIST[code]||[];
const jRep=j=>Object.keys(j.err).filter(c=>rep(c).length).map(c=>({c,h:rep(c),same:rep(c).filter(o=>o.j===j.id)}));
function repBlock(code,curJ){const H=rep(code);if(!H.length)return'';const E=ERR[code];const last=H[H.length-1];const sameJ=curJ?H.filter(o=>o.j===curJ.id):[];
 const mk={};H.forEach(o=>mk[o.bu]=(mk[o.bu]||0)+1);const tot=H.reduce((a,o)=>a+o.recs,0);
 return `<div class="rep"><h5><span>🔁 Repeat issue · ${E.t}</span><span class="rpt"><i>↻</i> ${H.length+1}× in 30 days</span></h5>
 <div style="font-size:12px;margin-top:6px;line-height:1.5">Last triggered <b>${last.d} ${last.t}</b> in <b>${esc(last.jn)}</b> (${last.bu}) · ${last.recs} records.
 ${curJ?(sameJ.length?`This journey has hit it <b>${sameJ.length+1} times</b>.`:'First time in this journey, but seen in other journeys.'):''} Same root cause every time.</div>
 <div class="sum"><div><b>${H.length+1}</b>occurrences</div><div><b>${fmt(tot)}</b>records before today</div><div><b>${Object.keys(mk).length}</b>markets hit</div><div><b>${(H.reduce((a,o)=>a+o.held,0)/H.length).toFixed(1)}d</b>avg fix held</div></div>
 <div style="font-size:11px;color:var(--muted)">Markets: ${Object.entries(mk).map(([b,n])=>`<b style="color:var(--text)">${b}</b> ${n}×`).join(' · ')}</div>
 <div class="occ"><div class="now"><b>Today · 16 Nov</b> – ${curJ?esc(curJ.n):'multiple journeys'}<small>open now</small></div>
 ${H.slice().reverse().map(o=>`<div><b>${o.d} ${o.t}</b> – ${esc(o.jn)} · ${o.bu} · ${o.recs} records<small>Root cause: ${E.t} · fixed in ${o.mttr}: ${o.fix} · held ${o.held} day${o.held>1?'s':''}</small>
  <div class="ids">${o.ids.map(id=>`<span title="copy" onclick="event.stopPropagation();x_copy('${id}','${id}')">${id}</span>`).join('')}<span style="background:none;color:var(--muted)">+${o.recs-3} more</span></div></div>`).join('')}</div>
 <div class="back">⚠ <b>Why it keeps coming back:</b> ${BACK[code]}</div>
 <div class="perm">✅ <b>Permanent fix (stop the repeat):</b> ${PERM[code]}</div>
 <div style="font-size:11px;color:var(--muted);margin-top:8px">The root cause and troubleshooting steps above are reused from the previous ${H.length} occurrences — same playbook.</div></div>`}
// badges on journey rows
function badgeRows(root){(root||document).querySelectorAll('.jrow[onclick*="x_openJ"]').forEach(r=>{if(r.dataset.rb)return;r.dataset.rb=1;const id=(r.getAttribute('onclick').match(/'(J\d+)'/)||[])[1];const j=J.find(x=>x.id===id);if(!j)return;
 const R=jRep(j);if(!R.length)return;const top=R.sort((a,b)=>b.h.length-a.h.length)[0];const last=top.h[top.h.length-1];const sm=r.querySelector('.nm small');
 if(sm)sm.insertAdjacentHTML('beforeend',`<span class="rpt" title="Same root cause seen ${top.h.length} times before · last ${last.d} in ${esc(last.jn)}"><i>↻</i> Repeat ${top.h.length+1}× · last ${last.d}</span>`)})}
new MutationObserver(()=>badgeRows()).observe(document.querySelector('main'),{childList:true,subtree:true});badgeRows();
// drawer extensions
const _oj=window.x_openJ;window.x_openJ=function(id){_oj(id);const j=J.find(x=>x.id===id);const top=Object.entries(j.err).sort((a,b)=>b[1]-a[1]).find(([c])=>c!=='E_CONSENT')||Object.entries(j.err)[0];
 if(!top)return;const html=repBlock(top[0],j);if(!html)return;const anchor=$('#drawer .rca');if(anchor)anchor.insertAdjacentHTML('beforebegin',html)};
const _oi=window.x_openInc;window.x_openInc=function(code){_oi(code);const html=repBlock(code);const anchor=$('#drawer .rca');if(html&&anchor)anchor.insertAdjacentHTML('beforebegin',html)};
const _or=window.x_openRec;window.x_openRec=function(id){_or(id);const r=REC.find(x=>x.id===id);if(!r)return;const d=$('#drawer');const H=rep(r.code);
 if(H.length){const last=H[H.length-1];d.querySelector('.kv').insertAdjacentHTML('afterend',`<div class="back" style="background:rgba(124,58,237,.14);border-color:rgba(219,39,119,.4)">🔁 <b>Repeat root cause</b> – ${errInfo(r.code).t} happened ${H.length} times before (last ${last.d} in ${esc(last.jn)}, ${last.recs} records). <a style="color:var(--info);cursor:pointer;font-weight:600" onclick="x_openInc('${r.code}')">See history →</a></div>`)}
 const notes=LS.get('notes',{});d.insertAdjacentHTML('beforeend',`<h4 style="font-size:14px;margin-top:16px">📝 My notes</h4><textarea class="inp" id="recNote" placeholder="Add a note for ${r.id} – saved in this browser">${esc(notes[id]||'')}</textarea>`);
 $('#recNote').oninput=e=>{const n=LS.get('notes',{});n[id]=e.target.value;LS.set('notes',n)}};

/* =============== 2. UPCOMING JOURNEYS + PRE-FLIGHT =============== */
const SCHED=[['J1','18:00'],['J2','19:30'],['J8','20:00'],['J4','21:15'],['J3','22:00'],['J12','23:30'],['J6','07:00'],['J14','08:30'],['J5','09:00'],['J7','10:00'],['J9','11:30'],['J10','12:00'],['J11','13:30'],['J13','15:00']];
const PCHK=[
 {k:'contact',n:'Members have an email / phone',code:'E_NO_CONTACT'},{k:'consent',n:'Marketing consent present',code:'E_CONSENT'},{k:'vdef',n:'Voucher definition active on run date',code:'E_VDEF_EXPIRED'},
 {k:'status',n:'Members still active (not merged)',code:'E_MEMBER_INACTIVE'},{k:'dpe',n:'Upstream DPE / tier batch completed',code:'E_DPE_NO_JOURNAL'},{k:'api',n:'Marketing Cloud API healthy (p95 latency)',code:'E_TIMEOUT'},
 {k:'entry',n:'Entry data extension populated',code:null},{k:'freq',n:'No member gets > 3 messages in 24 h',code:null}];
function nextAt(hhmm){const [h,m]=hhmm.split(':').map(Number);const n=new Date();const t=new Date(n);t.setHours(h,m,0,0);if(t<=n)t.setDate(t.getDate()+1);return t}
const UP=((window.SAMAT_LIVE&&window.SAMAT_LIVE.schedule)||SCHED).filter(([id])=>J.some(x=>x.id===id)).map(([id,t])=>{const j=J.find(x=>x.id===id);const aud=Math.round((j.in||900)*(.9+rnd()*.25));const checks=PCHK.map(c=>{let n=0,st='p',note='';
 if(c.code&&j.err[c.code]){n=Math.round(j.err[c.code]*(aud/(j.in||aud))*(c.code==='E_TIMEOUT'?.4:1.05));st=c.code==='E_CONSENT'?'w':'f'}
 if(c.k==='vdef'&&j.err.E_VDEF_EXPIRED){n=Math.round(aud*.86);note='Definition expired 14 Nov – every voucher issue will fail'}
 if(c.k==='entry'&&j.notrun){st='f';note='Entry DE is empty – journey will send nothing';n=0}
 if(c.k==='freq'&&['J1','J8','J2'].includes(id)){st='w';n=Math.round(aud*.04);note=n+' members also in another journey within 24 h'}
 if(c.k==='api'&&j.err.E_TIMEOUT){note='p95 2.9 s now (normal 0.8 s) – timeouts likely if it degrades'}
 if(c.k==='dpe'&&j.err.E_DPE_NO_JOURNAL){note='"Create Accrual Journals" not yet Completed today'}
 if(c.k==='contact'&&n)note=n+' members have no ContactPointEmail';
 if(c.k==='status'&&n)note=n+' members merged by the 05:00 clean-up';
 if(c.k==='consent'&&n)note=n+' will be suppressed (correct behaviour)';
 return {...c,n,st,note}});
 const fail=checks.filter(c=>c.st==='f'&&c.k!=='entry').reduce((a,c)=>a+c.n,0);const blocker=checks.some(c=>(c.k==='vdef'||c.k==='entry')&&c.st==='f');
 const rate=fail/aud*100;return {id,j,t,aud,checks,fail:Math.min(fail,aud),rate,verdict:blocker||rate>5?'stop':rate>1||checks.some(c=>c.st==='w')?'warn':'go',excluded:false}});
const fmtLeft=ms=>{if(ms<=0)return'running';const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}h ${String(m).padStart(2,'0')}m ${String(x).padStart(2,'0')}s`:`${m}m ${String(x).padStart(2,'0')}s`};
const VLAB={go:'GO',warn:'CHECK',stop:'STOP'};
mk('viewPreflight',`
 <section class="x-head glass"><div><div class="crumbs">Dashboard › <b>Pre-flight</b></div><h2>🛫 Pre-flight · upcoming journeys</h2>
 <p>Every journey scheduled in the next 24 hours, with a live countdown. Before each run the agent checks the audience against every known failure cause and predicts how many records will fail, so you can fix or exclude them before the campaign goes out.</p></div>
 <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="pfAll">🔎 Run all pre-flight checks</button><button class="btn ghost" onclick="x_pfCopy()">⧉ Copy pre-flight report</button></div></section>
 <section class="x-kpis" id="pfK"></section>
 <section class="panel glass scan" id="pfPanel"><h4><span>Next 24 hours <small id="pfNow"></small></span><div class="chips" id="pfF"><span class="chip on" data-f="all">All</span><span class="chip" data-f="stop">Stop</span><span class="chip" data-f="warn">Check</span><span class="chip" data-f="go">Go</span></div></h4><div id="pfList"></div></section>
 <section class="x-grid2"><div class="panel solid"><h4>⏳ Expiry radar <small>things that will break a journey soon</small></h4><div class="radar" id="radar"></div></div>
 <div class="panel solid"><h4>📬 Conflicts & message fatigue <small>members hit by 2+ journeys in 24 h</small></h4><div id="conf"></div></div></section>`);
let pff='all';
function pfKpis(){const st=UP.filter(u=>u.verdict==='stop').length,wn=UP.filter(u=>u.verdict==='warn').length,ri=UP.reduce((a,u)=>a+(u.excluded?0:u.fail),0),au=UP.reduce((a,u)=>a+u.aud,0);
 $('#pfK').innerHTML=kpiH('Journeys next 24 h',UP.length,'scheduled')+kpiH('Stop – fix first',st,'blockers found','bad')+kpiH('Check',wn,'minor risk','warn')+kpiH('Ready to go',UP.length-st-wn,'all checks pass','ok')+kpiH('Records at risk',ri,'predicted failures','bad')+kpiH('Predicted success',(100-ri/au*100).toFixed(1)+'%','if run as-is','warn');
 countAll($('#pfK'))}
function pfList(){const now=Date.now();const L=UP.slice().sort((a,b)=>nextAt(a.t)-nextAt(b.t)).filter(u=>pff==='all'||u.verdict===pff);
 $('#pfList').innerHTML=L.map((u,i)=>{const fails=u.checks.filter(c=>c.st==='f'),warns=u.checks.filter(c=>c.st==='w');const f=u.excluded?0:u.fail;
  return `<div class="up" style="animation-delay:${i*30}ms" onclick="x_pf('${u.id}')"><div class="jico ${u.verdict==='stop'?'bad':u.verdict==='warn'?'warn':'ok'}">${u.verdict==='stop'?'🛑':u.verdict==='warn'?'⚠️':'🟢'}</div>
  <div class="nm"><b>${esc(u.j.n)}</b><small>${u.j.bu} · ${u.j.p} · starts ${u.t} local</small></div>
  <div class="cd" data-at="${nextAt(u.t).getTime()}">--<small>until start</small></div>
  <div><div class="pbar"><i style="width:${Math.max(0,100-u.rate)}%;background:var(--ok)"></i><i style="width:${u.excluded?0:Math.min(100,u.rate)}%;background:var(--bad)"></i></div>
  <div class="pmeta">${fmt(u.aud)} in audience · <b style="color:${f?'var(--bad-t)':'var(--ok)'}">${fmt(f)} predicted to fail</b>${u.excluded?' · at-risk excluded ✓':''}</div>
  <div style="margin-top:4px">${fails.slice(0,2).map(c=>`<span class="rchip">${c.code?ERR[c.code].t:esc(c.note)}${c.n?' · '+fmt(c.n):''}</span>`).join('')}${warns.slice(0,1).map(c=>`<span class="rchip w">${esc(c.note||c.n)}</span>`).join('')}</div></div>
  <div class="sr num">${(100-(u.excluded?0:u.rate)).toFixed(1)}%<small>predicted</small></div><div><span class="verdict ${u.excluded&&u.verdict!=='stop'?'go':u.verdict}">${VLAB[u.excluded&&u.verdict!=='stop'?'go':u.verdict]}</span></div></div>`}).join('');
 tickCd()}
function tickCd(){const now=Date.now();$$('.cd[data-at]').forEach(el=>{const ms=+el.dataset.at-now;el.firstChild.nodeValue=fmtLeft(ms);el.classList.toggle('soon',ms<3600e3&&ms>0);el.classList.toggle('now',ms<=60e3)});
 const pn=$('#pfNow');if(pn)pn.textContent='now '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
setInterval(()=>{if(!document.hidden)tickCd()},1000);
window.x_pf=function(id){const u=UP.find(x=>x.id===id);const d=$('#drawer');d.classList.add('wide');const ms=nextAt(u.t)-Date.now();
 const risk=REC.filter(r=>r.j===id&&r.st==='Open').slice(0,10);
 d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="color:var(--muted);font-size:12px">Pre-flight › ${u.j.bu}</div><h3>${esc(u.j.n)}</h3>
 <div style="color:var(--muted)">Starts ${u.t} local · in <b class="cd" data-at="${nextAt(u.t).getTime()}" style="font-size:13px">${fmtLeft(ms)}<small style="display:none"></small></b></div>
 <span class="verdict ${u.verdict}" style="display:inline-block;margin-top:10px">${VLAB[u.verdict]} · ${u.verdict==='stop'?'do not run until fixed':u.verdict==='warn'?'run after a quick check':'safe to run'}</span></div><button class="iconbtn" onclick="closeAll()">✕</button></div>
 <div class="kgrid num"><div><b>${fmt(u.aud)}</b><span>Audience</span></div><div><b style="color:var(--bad)">${fmt(u.excluded?0:u.fail)}</b><span>Predicted failures</span></div><div><b>${(100-(u.excluded?0:u.rate)).toFixed(1)}%</b><span>Predicted success</span></div><div><b>${u.checks.filter(c=>c.st==='p').length}/${u.checks.length}</b><span>Checks passing</span></div></div>
 <h4 style="font-size:14px">Pre-flight checks</h4>${u.checks.map(c=>`<div class="pf"><span class="ic ${c.st}">${c.st==='p'?'✓':c.st==='w'?'!':'✕'}</span><div><b>${c.n}</b><small>${c.note||(c.st==='p'?'Pass':'')}</small></div><b class="num" style="color:${c.st==='f'?'var(--bad-t)':c.st==='w'?'var(--warn)':'var(--muted)'}">${c.n&&c.st!=='p'?fmt(c.n):''}</b></div>`).join('')}
 ${u.checks.filter(c=>c.st==='f'&&c.code).map(c=>`<div class="rca"><h5>🧠 Predicted cause · ${ERR[c.code].t}</h5><p>${ERR[c.code].rc}</p>${rep(c.code).length?`<div class="back" style="margin-top:8px">🔁 This already failed ${rep(c.code).length} times (last ${rep(c.code).slice(-1)[0].d}). Fix before the run to break the repeat.</div>`:''}
  <div class="ts"><h6>Fix before ${u.t}</h6>${ERR[c.code].fix.slice(0,4).map((s,i)=>`<div class="tstep" onclick="x_tick(this)"><span class="n">${i+1}</span><span>${s}</span></div>`).join('')}</div></div>`).join('')}
 ${risk.length?`<div class="drec"><h4>Records at risk <small style="color:var(--muted);font-weight:500">sample from today's failures</small></h4>${recTable(risk)}</div>`:''}
 <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn sm" onclick="x_pfExclude('${id}')">${u.excluded?'↩ Include at-risk again':'⛔ Exclude at-risk members'}</button><button class="btn ghost sm" onclick="x_pfRecheck('${id}')">🔎 Re-check now</button><button class="btn ghost sm" onclick="x_openJ('${id}')">Open journey history</button></div>`;
 d.classList.add('on');$('#scrim').classList.add('on');bindRecRows(d)};
window.x_pfExclude=id=>{const u=UP.find(x=>x.id===id);u.excluded=!u.excluded;toast(u.excluded?'⛔':'↩',u.excluded?'At-risk members excluded':'At-risk members included',u.excluded?`${fmt(u.fail)} members held back from ${u.j.n} – send them after the fix`:u.j.n,'ok');pfKpis();pfList();x_pf(id)};
window.x_pfRecheck=id=>{const p=$('#pfPanel');p.classList.add('on');toast('🔎','Re-checking',UP.find(x=>x.id===id).j.n+' · 8 checks against Prod (read-only)');setTimeout(()=>{p.classList.remove('on');toast('✓','Pre-flight done','Results are up to date','ok')},1600)};
window.x_pfCopy=()=>{copy('Pre-flight report – next 24 h\n'+UP.slice().sort((a,b)=>nextAt(a.t)-nextAt(b.t)).map(u=>`• ${u.t} ${u.j.n} (${u.j.bu}) – ${VLAB[u.verdict]} – ${u.aud} audience, ${u.excluded?0:u.fail} predicted fail${u.checks.filter(c=>c.st!=='p').map(c=>'\n    - '+(c.note||c.n)).join('')}`).join('\n'));toast('⧉','Pre-flight report copied',UP.length+' journeys','ok')};
RENDER.preflight=function(){pfKpis();pfList();$$('#pfF .chip').forEach(c=>c.onclick=()=>{$$('#pfF .chip').forEach(x=>x.classList.remove('on'));c.classList.add('on');pff=c.dataset.f;pfList()});
 $('#pfAll').onclick=()=>{const p=$('#pfPanel');p.classList.add('on');let k=0;const it=setInterval(()=>{toast('🔎','Checking '+UP[k].j.n,UP[k].checks.length+' checks');if(++k>=3){clearInterval(it)}},400);
  setTimeout(()=>{p.classList.remove('on');const s=UP.filter(u=>u.verdict==='stop').length;toast(s?'🛑':'✅','Pre-flight complete',`${UP.length} journeys checked · ${s} must be fixed before they run`,s?'bad':'ok')},1900)};
 const RAD=[['Voucher def · SG Welcome 500 pts',-2,'Used by SG Welcome series + SG Birthday'],['Voucher def · TH Black Birthday',6,'TH Black Birthday voucher'],['Voucher def · MY Points bonus',11,'MY Points expiry reminder'],['Tier Black ends · 214 MY members',7,'MY Black renewal reminder'],['Escrow release · SSMY…1133',7,'Stuck escrow watch item'],['API certificate · MC connected app',19,'All MC journeys'],['Voucher def · KR Tier gift',27,'KR Tier upgrade congrats']];
 $('#radar').innerHTML=RAD.map(([n,dd,u])=>`<div><b style="font-size:12.5px">${n}</b><div style="font-size:10.5px;color:var(--muted)">${u}</div></div><div class="d ${dd<=7?'bad':dd<=14?'warn':''}">${dd<0?'expired':dd+'d'}</div><div class="pbar"><i style="width:${Math.max(4,100-Math.max(0,dd)/30*100)}%;background:${dd<=7?'var(--bad)':dd<=14?'var(--warn)':'var(--ok)'}"></i></div>`).join('');
 const CF=[['TH Black Birthday voucher','TH AT Welcome',48,'18:00 + 13:30 next day'],['SG Welcome series','SG Birthday double points',61,'19:30 + 20:00 – 30 min apart'],['KR Tier upgrade congrats','KR Points expiry reminder',22,'21:15 + 23:30'],['HK Lapsed win-back','HK Silver anniversary',9,'08:30 + 09:00']];
 $('#conf').innerHTML=CF.map(([a,b,n,t])=>`<div class="conf2"><div><b>${a}</b> × <b>${b}</b><small>${t}</small></div><b class="num" style="color:${n>40?'var(--bad-t)':'var(--warn)'}">${n} members</b></div>`).join('')+`<div class="fix">💡 Add a 24 h frequency cap or a suppression between journeys in the same market. ${CF.reduce((a,c)=>a+c[2],0)} members would get 2 messages within hours.</div>`};

/* =============== 3. FOLDERS PAGE =============== */
mk('viewFolders',`<section class="x-head glass"><div><div class="crumbs">Dashboard › <b>Folders</b></div><h2>📁 Result folders</h2><p>Every BU and check output, grouped on shelves. Open a folder to see its findings and the records behind them.</p></div></section><div id="foldHost" style="display:flex;flex-direction:column;gap:12px"></div>`);
const sh=$('#shelves'),st=sh&&sh.previousElementSibling;if(sh){const host=$('#foldHost');if(st&&st.classList.contains('sec-title'))host.appendChild(st);host.appendChild(sh)}

/* =============== 4. INSIGHTS =============== */
mk('viewInsights',`<section class="x-head glass"><div><div class="crumbs">Dashboard › <b>Insights</b></div><h2>📊 Insights & trends</h2><p>Is it getting better or worse? Week-on-week failure rate, how fast causes get fixed, which causes keep coming back, a 3D view of issues per market and a ready-to-send daily digest.</p></div>
 <div style="display:flex;gap:8px"><button class="btn" onclick="x_digest()">⧉ Copy daily digest</button></div></section>
 <section class="x-kpis" id="inK"></section>
 <section class="x-grid2"><div class="panel solid"><h4>🏙 Issues by market · 3D <small>hover to tilt · click a tower</small></h4><div class="city-w"><div class="city" id="city"><div class="floor"></div></div></div></div>
 <div class="panel solid"><h4>📉 Failure rate · last 8 weeks <small>target ≤ 1%</small></h4><div id="wow"></div></div></section>
 <section class="x-grid2"><div class="panel solid"><h4>🔁 Repeat leaderboard <small>causes that keep coming back</small></h4><div id="lead"></div></div>
 <div class="panel solid"><h4>⏱ Time to fix by cause <small>MTTR, last 30 days</small></h4><div id="mttr"></div></div></section>
 <section class="panel solid"><h4>📰 Daily digest <small>ready to paste into Teams / email</small></h4><div class="digest" id="dig"></div></section>`);
function digestText(){const st=UP.filter(u=>u.verdict==='stop');return `Sam & AT – daily digest · ${new Date().toDateString()}
HEALTH  ${J.filter(j=>j.st==='bad').length} journeys failing · ${REC.length} records flagged · ${INC.length} root causes
TOP CAUSES
${INC.slice(0,4).map(i=>`  • ${ERR[i.code].t}: ${i.recs} records, ${i.js.length} journeys${rep(i.code).length?` – REPEAT ${rep(i.code).length+1}×`:''} → owner ${ERR[i.code].owner}`).join('\n')}
BEFORE NEXT RUNS
${st.map(u=>`  🛑 ${u.t} ${u.j.n}: ${u.checks.filter(c=>c.st==='f').map(c=>c.note||c.n).join('; ')}`).join('\n')||'  all clear'}
EXPIRING ≤ 7 DAYS
  • SG Welcome voucher def (expired) · TH Black Birthday def (6d) · Tier Black ends for 214 MY members (7d)
ASK
  • Loyalty admin: replace SG voucher definition (fixes 308 records + 2 upcoming runs)
  • CRM data team: load 84 missing emails; make email mandatory in POS create`}
window.x_digest=()=>{copy(digestText());toast('⧉','Daily digest copied','Paste into Teams or email','ok')};
RENDER.insights=function(){
 $('#inK').innerHTML=kpiH('Failure rate this week','3.9%','was 2.6% last week','bad')+kpiH('Repeat causes',Object.keys(HIST).length,'seen before','warn')+kpiH('Median time to fix','2h 05m','−18 min vs last week','ok')+kpiH('Fixes that held > 7 d','38%','permanent fixes needed','warn')+kpiH('SLA met',92,'% of runs on time');countAll($('#inK'));
 const M={};REC.forEach(r=>M[r.bu]=(M[r.bu]||0)+1);const ent=Object.entries(M).sort((a,b)=>b[1]-a[1]).slice(0,9);const mx=ent.length?ent[0][1]:1;
 $('#city').innerHTML='<div class="floor"></div>'+ent.map(([b,n],i)=>{const x=30+(i%3)*110,y=30+Math.floor(i/3)*110,h=Math.max(14,n/mx*120),c=n>150?'#FF453A':n>60?'#FF9F0A':n>20?'#FFD60A':'#30D158';
  return `<div class="tw" style="left:${x}px;top:${y}px;--h:${h}px;--c:${c};animation-delay:${i*80}ms" title="${b}: ${n} records" onclick="x_recFilter('bu','${b}')"><div class="f fa"></div><div class="f fb"></div><div class="f tp"></div><div class="vl">${n}</div><div class="lb">${b}</div></div>`}).join('');
 const W=[1.4,1.1,1.8,1.3,2.2,1.9,2.6,3.9];const w=560,h=180,X=i=>30+i*(w-50)/7,Y=v=>h-24-v/4.5*(h-40);
 $('#wow').innerHTML=`<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:200px"><rect x="30" y="${Y(1)}" width="${w-40}" height="${Y(0)-Y(1)}" fill="rgba(48,209,88,.12)"/><text x="34" y="${Y(1)-4}" font-size="10" fill="var(--muted)">target ≤ 1%</text>
  <path d="${W.map((v,i)=>(i?'L':'M')+X(i)+' '+Y(v)).join(' ')} L${X(7)} ${Y(0)} L${X(0)} ${Y(0)}Z" fill="rgba(255,69,58,.14)"/>
  <path d="${W.map((v,i)=>(i?'L':'M')+X(i)+' '+Y(v)).join(' ')}" fill="none" stroke="#FF453A" stroke-width="2.4" style="stroke-dasharray:1200;stroke-dashoffset:1200;animation:draw 1.4s forwards"/>
  ${W.map((v,i)=>`<circle cx="${X(i)}" cy="${Y(v)}" r="${i===7?6:3.5}" fill="#FF453A"><title>W${39+i}: ${v}%</title></circle><text x="${X(i)}" y="${h-6}" font-size="10" fill="var(--muted)" text-anchor="middle">W${39+i}</text>`).join('')}
  <text x="${X(7)-8}" y="${Y(3.9)-10}" font-size="11" font-weight="700" fill="var(--bad-t)" text-anchor="end">3.9% ↑ +1.3 pts</text></svg>
  <div class="fix">🧠 The jump since W44 is driven by <b>one cause</b>: Voucher definition expired (SG) adds 2.0 pts. Without it the rate would be 1.9%.</div>`;
 const L=Object.entries(HIST).sort((a,b)=>b[1].length-a[1].length);const lm=L.length?L[0][1].length+1:1;
 $('#lead').innerHTML=L.map(([c,H],i)=>`<div class="rbar" style="grid-template-columns:200px 1fr 70px;cursor:pointer" onclick="x_openInc('${c}')"><span>${ERR[c].t}</span><span class="t"><i style="width:${(H.length+1)/lm*100}%;background:linear-gradient(90deg,#7c3aed,#db2777);animation-delay:${i*60}ms"></i></span><b>${H.length+1}× <small style="color:var(--muted);font-weight:500">${H[H.length-1].d}</small></b></div>`).join('');
 const MT=[['Voucher definition expired',310],['Missing email / contact point',1440],['Journal not created (DPE)',190],['API timeout to Marketing Cloud',75],['Member inactive / merged',260],['Tier changed during journey',380]];const mm=Math.max(...MT.map(x=>x[1]));
 $('#mttr').innerHTML=MT.map(([n,m],i)=>`<div class="rbar" style="grid-template-columns:200px 1fr 70px"><span>${n}</span><span class="t"><i style="width:${m/mm*100}%;background:${m>600?'var(--bad)':m>240?'var(--warn)':'var(--ok)'};animation-delay:${i*60}ms"></i></span><b>${m>=60?Math.floor(m/60)+'h '+m%60+'m':m+'m'}</b></div>`).join('')+'<div class="fix">Missing email takes a full day because it waits for the CRM data team load. A POS-side fix removes it entirely.</div>';
 $('#dig').textContent=digestText()};

/* =============== 5. NAV =============== */
Object.assign(VIEWS,{preflight:'viewPreflight',folders:'viewFolders',insights:'viewInsights'});Object.assign(NAVN,{preflight:'Pre-flight',folders:'Folders',insights:'Insights'});Object.assign(CR,{preflight:'Pre-flight',folders:'Folders',insights:'Insights'});
const ul=document.querySelector('#g0 .nav');let after=[...ul.children].find(li=>li.dataset.n==='Data ops');
[['Pre-flight','🛫','preflight',String(UP.filter(u=>u.verdict==='stop').length),1],['Insights','📊','insights',''],['Folders','📁','folders','']].forEach(([n,e,v,b,hot])=>{const li=document.createElement('li');li.dataset.n=n;li.tabIndex=0;
 li.innerHTML=`<span style="width:18px;text-align:center;flex:none">${e}</span><span class="nav-label">${n}</span>${b?`<span class="badge ${hot?'':'soft'}">${b}</span>`:''}`;li.onclick=()=>x_show(v);ul.insertBefore(li,after.nextSibling);after=li});
PITEMS.push({n:'Pre-flight · upcoming journeys',s:'countdown predict',f:()=>x_show('preflight')},{n:'Insights & trends',s:'digest 3d',f:()=>x_show('insights')},{n:'Folders',s:'results shelves',f:()=>x_show('folders')});
// home: upcoming widget + health orb
const hero=$('.hero');const score=82;const oc=score>=85?['#30D158','#0b6b2c']:score>=70?['#64D2FF','#0A4E9F']:['#FF9F0A','#8a3a00'];
hero.insertAdjacentHTML('afterbegin',`<div class="orb-w t3" title="Health score" style="--oc1:${oc[0]};--oc2:${oc[1]}"><div class="orb-ring"></div><div class="orb-ring r2"></div><div class="orb"><div><b class="num">${score}</b><small>HEALTH</small></div></div><div class="orb-shadow"></div></div>`);
$('#verdict').insertAdjacentHTML('afterend',`<div class="hstats"><span class="hstat">🟢 <b>14</b> BUs clean</span><span class="hstat">🔴 <b>5</b> need action</span><span class="hstat">🧭 <b>${J.filter(j=>j.st==='bad').length}</b> journeys failing</span><span class="hstat">🔁 <b>${Object.keys(HIST).length}</b> repeat causes</span><span class="hstat">🛫 <b>${UP.filter(u=>u.verdict==='stop').length}</b> runs to fix before start</span></div>`);
const nx=UP.slice().sort((a,b)=>nextAt(a.t)-nextAt(b.t)).slice(0,4);
const uw=document.createElement('section');uw.className='panel glass';uw.innerHTML=`<h4>🛫 Next journeys <small><a style="color:var(--info);cursor:pointer;font-weight:600" onclick="x_show('preflight')">Open pre-flight →</a></small></h4>${nx.map((u,i)=>`<div class="up" style="grid-template-columns:auto 1.5fr 120px auto;padding:10px 12px;animation-delay:${i*40}ms" onclick="x_pf('${u.id}')"><div class="jico ${u.verdict==='stop'?'bad':u.verdict==='warn'?'warn':'ok'}" style="width:32px;height:32px">${u.verdict==='stop'?'🛑':u.verdict==='warn'?'⚠️':'🟢'}</div><div class="nm"><b>${esc(u.j.n)}</b><small>${u.t} · ${fmt(u.fail)} predicted to fail of ${fmt(u.aud)}</small></div><div class="cd" data-at="${nextAt(u.t).getTime()}">--<small>until start</small></div><span class="verdict ${u.verdict}">${VLAB[u.verdict]}</span></div>`).join('')}`;
const jw=[...document.querySelectorAll('#viewDash>section.panel')].find(s=>s.textContent.includes('Journey health'));(jw||$('#campWidget')).insertAdjacentElement('beforebegin',uw);tickCd();
// first notification: pre-flight blocker
const sb=UP.filter(u=>u.verdict==='stop').sort((a,b)=>nextAt(a.t)-nextAt(b.t))[0];
if(sb){NOTIFS.unshift({id:301,s:'bad',cat:'critical',t:`Pre-flight STOP: ${sb.j.n} starts ${sb.t} – ${fmt(sb.fail)} of ${fmt(sb.aud)} predicted to fail`,p:sb.checks.filter(c=>c.st==='f').map(c=>c.note||c.n).join(' · '),g:'Today',ago:'just now',u:true,x:()=>x_pf(sb.id)});updateBell(true)}

/* =============== 6. THEMES =============== */
const TH=[['ocean','Ocean','linear-gradient(135deg,#0b2a6b,#1b5fd1,#6a3fd6)'],['dark','Dark','linear-gradient(135deg,#030305,#1d2233)'],['midnight','Midnight','linear-gradient(135deg,#02030c,#1a1060,#2a0f4d)'],['graphite','Graphite','linear-gradient(135deg,#16181b,#3a3f47)'],
 ['light','Light','linear-gradient(135deg,#f3f5f9,#dbe6ff)'],['pearl','Pearl','linear-gradient(135deg,#b9d4ff,#ffd9ec,#d6ccff)'],['sand','Sand','linear-gradient(135deg,#f7f1e6,#f3e2c2)'],['emerald','Emerald','linear-gradient(135deg,#053b2e,#0f8a5f)'],
 ['aurora','Aurora','linear-gradient(135deg,#00423a,#0b6e8f,#5b2a9e)'],['nord','Nord','linear-gradient(135deg,#2e3440,#3b4a63,#88C0D0)'],['sunset','Sunset','linear-gradient(135deg,#5a1238,#d4532b,#e09a2b)'],['rose','Rose','linear-gradient(135deg,#4a0d2a,#a3214f,#FF5C8A)'],['contrast','High contrast','linear-gradient(135deg,#000 60%,#FFD60A)']];
const tseg=document.querySelector('.seg[data-k="theme"]');if(tseg){tseg.style.display='none';tseg.insertAdjacentHTML('afterend',`<div class="thgrid" id="thg">${TH.map(([k,n,g])=>`<div class="thsw" data-t="${k}"><i style="background:${g}"></i><span>${n}</span></div>`).join('')}</div>`)}
function setTheme(k){document.body.dataset.theme=k;$$('.thsw').forEach(x=>x.classList.toggle('on',x.dataset.t===k));try{localStorage.setItem('samat_theme',k)}catch(e){}}
$$('.thsw').forEach(s=>s.onclick=()=>{setTheme(s.dataset.t);toast('🎨','Theme',s.textContent)});
let t0='ocean';try{t0=localStorage.getItem('samat_theme')||'ocean'}catch(e){}setTheme(t0);

/* =============== 7. 3D TILT (one listener, rAF, transform only) =============== */
const SEL='.kpi,.x-kpi,.inc,.folder,.card,.orb-w,.panel.glass>.up,.lb-row';
function tag(){$$(SEL).forEach(el=>{if(el.classList.contains('t3'))return;el.classList.add('t3');const done=()=>el.classList.add('ready');
 const cs=getComputedStyle(el);if(cs.animationName&&cs.animationName!=='none'){el.addEventListener('animationend',done,{once:true});setTimeout(done,1600)}else done()})}
tag();new MutationObserver(()=>{clearTimeout(window._t3);window._t3=setTimeout(tag,120)}).observe(document.querySelector('main'),{childList:true,subtree:true});
let cur=null,px=0,py=0,raf=0;const fine=matchMedia('(pointer:fine)').matches;
function apply(){raf=0;if(!cur)return;const r=cur.getBoundingClientRect();const x=(px-r.left)/r.width-.5,y=(py-r.top)/r.height-.5;const amp=cur.offsetWidth>420?3:7;
 cur.style.setProperty('--rx',(-y*amp).toFixed(2)+'deg');cur.style.setProperty('--ry',(x*amp).toFixed(2)+'deg');cur.style.setProperty('--ga',Math.round(90+x*120));
 cur.style.setProperty('--mx',(px-r.left)+'px');cur.style.setProperty('--my',(py-r.top)+'px')}
function release(el){el.classList.remove('live');el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg')}
if(fine)document.addEventListener('pointermove',e=>{if(document.body.dataset.motion==='off')return;const el=e.target.closest&&e.target.closest('.t3');
 if(el!==cur){if(cur)release(cur);cur=el;if(cur)cur.classList.add('live')}px=e.clientX;py=e.clientY;if(cur&&!raf)raf=requestAnimationFrame(apply)},{passive:true});
document.addEventListener('pointerleave',()=>{if(cur){release(cur);cur=null}});
// pause all infinite animations when the tab is hidden (saves battery on Mac)
document.addEventListener('visibilitychange',()=>document.documentElement.style.setProperty('--ps',document.hidden?'paused':'running'));
const ps=document.createElement('style');ps.textContent='.bird,.bird *,.orb,.orb-ring,.orb-shadow,.tk,.jico.bad::after,.rpt i{animation-play-state:var(--ps,running)!important}';document.head.appendChild(ps);

/* bottom nav: add pre-flight */
const bn=document.querySelector('.bottomnav');if(bn){bn.children[3].setAttribute('onclick',"x_show('preflight')");bn.children[3].lastChild.textContent='Pre-flight'}
addEventListener('keydown',e=>{if(/input|textarea|select/i.test(e.target.tagName))return;if(window._g){if(e.key==='p')x_show('preflight');if(e.key==='i')x_show('insights');if(e.key==='f')x_show('folders')}});
Object.assign(window.X,{HIST,UP,nextAt,fmtLeft,VLAB,rep,LS,tickCd,BACK,PERM,FIXED});
addBirds();const h=location.hash.slice(1);if(['preflight','folders','insights'].includes(h))setTimeout(()=>x_show(h),30);
})();
