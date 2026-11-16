/* ===== v5: realistic solar system (procedural textures), planet per market, help center + helpers, non-overlapping toasts ===== */
(function(){
const X=window.X;const {J,ERR,REC,INC,esc,fmt,VIEWS,NAVN,CR,RENDER,mk,LS,UP,nextAt,fmtLeft}=X;
const $$=s=>[...document.querySelectorAll(s)];

/* ---------------- 1. procedural textures (generated once, cached as data URLs) ---------------- */
const P=new Uint8Array(512);(()=>{let s=1337;const a=[...Array(256).keys()];for(let i=255;i>0;i--){s=(s*16807)%2147483647;const j=s%(i+1);[a[i],a[j]]=[a[j],a[i]]}for(let i=0;i<512;i++)P[i]=a[i&255]})();
const h2=(x,y)=>P[(P[x&255]+(y&255))&511]/255;const sm=t=>t*t*(3-2*t);
function vn(x,y,per){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=sm(xf),v=sm(yf);const w=a=>((a%per)+per)%per;
 const a=h2(w(xi),yi),b=h2(w(xi+1),yi),c=h2(w(xi),yi+1),d=h2(w(xi+1),yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function fbm(x,y,per,o=5){let s=0,a=.5,f=1,n=0;for(let i=0;i<o;i++){s+=a*vn(x*f,y*f,per*f);n+=a;a*=.5;f*=2}return s/n}
const mix=(c1,c2,t)=>[c1[0]+(c2[0]-c1[0])*t,c1[1]+(c2[1]-c1[1])*t,c1[2]+(c2[2]-c1[2])*t];
const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const ramp=(stops,t)=>{t=Math.max(0,Math.min(1,t));for(let i=1;i<stops.length;i++)if(t<=stops[i][0]){const [a,ca]=stops[i-1],[b,cb]=stops[i];return mix(hex(ca),hex(cb),(t-a)/(b-a||1))}return hex(stops[stops.length-1][1])};
const PAINT={
 earth:(u,v,lat)=>{const n=fbm(u*6,v*3,6*1,6),ice=Math.abs(lat)>.8+fbm(u*10,v*5,10,3)*.12;if(ice)return [236,242,248];
  if(n>.53){const g=Math.min(1,(n-.53)*5);const dry=Math.abs(lat)<.35?.6:0;return mix(mix(hex('#3f7a3a'),hex('#b9a36b'),dry),hex('#7a6a4f'),g*.6)}const dpt=(.53-n)*3;return mix(hex('#2f78c4'),hex('#0b2a66'),Math.min(1,dpt))},
 cloud:(u,v,lat)=>{const n=fbm(u*8+40,v*4,8,5);const a=Math.max(0,(n-.52)*3.2);return [255,255,255,Math.min(230,a*255)]},
 mars:(u,v,lat)=>{if(Math.abs(lat)>.86)return [240,226,214];const n=fbm(u*6,v*3,6,6);return ramp([[0,'#5a2412'],[.42,'#8e3b1c'],[.55,'#c2562a'],[.7,'#d98a55'],[1,'#e6a877']],n)},
 jupiter:(u,v,lat)=>{const w=fbm(u*4,v*8,4,4);let t=Math.sin(lat*16+w*3.2)*.5+.5;let c=ramp([[0,'#7d4f33'],[.35,'#b98760'],[.6,'#e3cfa8'],[1,'#f3ead6']],t);
  const dx=((u-.3+1)%1)-0,ex=Math.min(Math.abs(u-.3),1-Math.abs(u-.3))*6,ey=(lat+.32)*9,d=ex*ex+ey*ey;if(d<1)c=mix(c,hex('#b5452b'),(1-d)*.85);return c},
 saturn:(u,v,lat)=>{const w=fbm(u*4,v*6,4,3);const t=Math.sin(lat*11+w*1.5)*.5+.5;return ramp([[0,'#b8945c'],[.5,'#dcc28e'],[1,'#f1e3bf']],t)},
 venus:(u,v,lat)=>{const n=fbm(u*5+v*2,v*3,5,6);return ramp([[0,'#a8743a'],[.5,'#d9b06a'],[1,'#f4dfac']],n)},
 mercury:(u,v,lat)=>{let n=fbm(u*8,v*4,8,6);const c=fbm(u*22,v*11,22,2);if(c>.68)n-=.18;else if(c>.62)n+=.08;return ramp([[0,'#4a4642'],[.5,'#8d8780'],[1,'#c9c3ba']],n)},
 uranus:(u,v,lat)=>{const n=fbm(u*3,v*6,3,3);return mix(hex('#9fe3ea'),hex('#6cc6d6'),Math.sin(lat*6+n)*.5+.5)},
 neptune:(u,v,lat)=>{const n=fbm(u*4,v*7,4,4);let c=ramp([[0,'#1d3a9e'],[.5,'#3c63d6'],[1,'#7fa2ff']],Math.sin(lat*9+n*2.5)*.5+.5);const ex=Math.min(Math.abs(u-.6),1-Math.abs(u-.6))*7,ey=(lat-.25)*10;if(ex*ex+ey*ey<1)c=mix(c,hex('#0e1d5c'),.7);return c},
 sun:(u,v,lat)=>{const n=fbm(u*14,v*7,14,5),g=fbm(u*40,v*20,40,2);return ramp([[0,'#c2410c'],[.4,'#f97316'],[.6,'#fbbf24'],[.85,'#fde68a'],[1,'#fffbeb']],n*.8+g*.35)}};
const TEX={};
function tex(kind){if(TEX[kind])return TEX[kind];const W=kind==='sun'?256:192,H=W/2;const c=document.createElement('canvas');c.width=W*2;c.height=H;const g=c.getContext('2d');const im=g.createImageData(W,H),f=PAINT[kind];
 for(let y=0;y<H;y++){const lat=(y/H)*2-1;for(let x=0;x<W;x++){const r=f(x/W,y/H,lat),i=(y*W+x)*4;im.data[i]=r[0];im.data[i+1]=r[1];im.data[i+2]=r[2];im.data[i+3]=r[3]==null?255:r[3]}}
 g.putImageData(im,0,0);g.putImageData(im,W,0);return TEX[kind]=c.toDataURL()}
function stars(){if(TEX.stars)return TEX.stars;const c=document.createElement('canvas');c.width=680;c.height=400;const g=c.getContext('2d');let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647;
 const neb=g.createRadialGradient(470,120,10,470,120,260);neb.addColorStop(0,'rgba(120,90,200,.18)');neb.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=neb;g.fillRect(0,0,680,400);
 const neb2=g.createRadialGradient(120,300,10,120,300,220);neb2.addColorStop(0,'rgba(40,120,200,.14)');neb2.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=neb2;g.fillRect(0,0,680,400);
 for(let i=0;i<260;i++){const x=r()*680,y=r()*400,m=r();g.fillStyle=`rgba(255,${235+r()*20|0},${220+r()*35|0},${.25+m*.6})`;g.beginPath();g.arc(x,y,m>.97?1.4:m>.85?.9:.55,0,7);g.fill()}return TEX.stars=c.toDataURL()}

/* ---------------- 2. planet component (reused in orrery + market panels) ---------------- */
const MP={'TUMI':['mercury','Mercury',7,30],'JP 5630':['venus','Venus',11,44],'SG 5010':['earth','Earth',12,40],'TW 5060':['mars','Mars',9,34],'TH 5640':['jupiter','Jupiter',24,70],'MY 5050':['saturn','Saturn',19,60],'KR 5040':['uranus','Uranus',14,50],'HK 5090':['neptune','Neptune',14,48]};
X.MP=MP;
function planet(kind,size,{lit='orbit',spin}={}){const s=spin||(kind==='jupiter'||kind==='saturn'?18:kind==='venus'?60:30);
 return `<span class="pz ${kind} lit-${lit}" style="--s:${size}px;--spin:${s}s">${kind==='saturn'?'<span class="pz-ring back"></span>':''}<span class="pz-clip"><img class="pz-tex" alt="" src="${tex(kind)}">${kind==='earth'?`<img class="pz-cloud" alt="" src="${tex('cloud')}">`:''}<span class="pz-shade"></span></span><span class="pz-atmo"></span>${kind==='saturn'?'<span class="pz-ring front"></span>':''}</span>`}
X.planet=planet;

/* ---------------- 3. realistic orrery on home ---------------- */
const ORD=['TUMI','JP 5630','SG 5010','TW 5060','TH 5640','MY 5050','KR 5040','HK 5090'];
const RAD=[44,60,77,93,114,136,152,166];
const stOf=k=>{const b=BUS.find(x=>x.k===k)||{};const js=J.filter(j=>j.bu===k);const bad=b.st==='bad'||js.some(j=>j.st==='bad');const warn=!bad&&(b.i>0||js.some(j=>j.st==='warn'||j.st==='none'));
 return {s:bad?'bad':warn?'warn':'ok',open:REC.filter(r=>r.bu===k&&r.st==='Open').length,js:js.length,fail:js.filter(j=>j.st==='bad').length,name:b.m||k}};
const lab=s=>s==='bad'?'Needs action':s==='warn'?'Watch':'Clean';
function buildSystem(){const old=$('.orr');if(old)old.remove();const hero=$('.hero');const sys=document.createElement('div');sys.className='sys enter';sys.style.setProperty('--stars',`url(${stars()})`);
 const score=82;const cnt=s=>ORD.filter(k=>stOf(k).s===s).length;
 sys.innerHTML=`<div class="sys-sky"></div><div class="sys-stage"><div class="sys-plane">
  ${ORD.map((k,i)=>{const [kind,pn,sz]=MP[k],st=stOf(k),r=RAD[i],T=(14*Math.pow(r/44,1.5)).toFixed(1),ph=(-(i*0.618%1)*T).toFixed(2);
   return `<div class="sys-orbit" style="--r:${r}px;--T:${T}s;--ph:${ph}s"><div class="sys-arm"><button class="sys-p" data-k="${k}" aria-label="${k} (${pn}): ${lab(st.s)}, ${st.open} open records"><span class="sys-face">${planet(kind,Math.round(sz*1.35))}<span class="sys-tag"><i class="${st.s}"></i>${k.split(' ')[0]}</span></span></button></div></div>`}).join('')}
  <div class="sys-sun"><span class="sun-glow"></span><span class="sun-corona"></span><span class="sun-disc"><img alt="" src="${tex('sun')}"><span class="sun-limb"></span></span></div>
 </div></div>
 <div class="sys-cap"><b class="num">${score}</b><span>health</span><span class="sys-sep"></span><span><i class="ok"></i>${cnt('ok')} clean</span><span><i class="warn"></i>${cnt('warn')} watch</span><span><i class="bad"></i>${cnt('bad')} action</span></div>
 <div class="sys-card" aria-hidden="true"></div>`;
 hero.insertBefore(sys,hero.firstChild);setTimeout(()=>sys.classList.remove('enter'),2200);
 const card=sys.querySelector('.sys-card');const hide=()=>{sys.classList.remove('hold');card.classList.remove('on')};
 sys.querySelectorAll('.sys-p').forEach(p=>{const k=p.dataset.k,st=stOf(k),pn=MP[k][1];
  const show=()=>{sys.classList.add('hold');card.innerHTML=`<b>${esc(k)}</b><span>${pn} · ${esc(st.name)}</span><em class="${st.s}">${lab(st.s)}</em><small>${st.open} open records · ${st.js} journeys${st.fail?' · '+st.fail+' failing':''}</small>`;card.classList.add('on')};
  p.addEventListener('pointerenter',show);p.addEventListener('focus',show);p.addEventListener('pointerleave',hide);p.addEventListener('blur',hide);
  p.addEventListener('click',e=>{e.stopPropagation();const b=BUS.find(x=>x.k===k);if(b)openDrawer(b)})});
 sys.querySelector('.sys-sun').addEventListener('click',()=>toast('☀️','Health 82 / 100','14 of 19 business units clean · 5 need action','ok'))}
(window.requestIdleCallback||setTimeout)(buildSystem,{timeout:400});
const ps=document.createElement('style');ps.textContent='.sys *,.sys *::before,.sys *::after,.xlplanet *{animation-play-state:var(--ps,running)}.sys.hold .sys-orbit,.sys.hold .sys-p,.sys.hold .pz-shade{animation-play-state:paused!important}';document.head.appendChild(ps);

/* ---------------- 4. planet inside each market panel ---------------- */
const _od=window.openDrawer;window.openDrawer=function(b){_od(b);if(!b||!MP[b.k])return;const d=$('#drawer'),bar=d.querySelector('.xlbar');if(!bar)return;const [kind,pn]=MP[b.k];const st=stOf(b.k);
 const el=document.createElement('div');el.className='xlplanet';el.innerHTML=`<div class="xlp-sky" style="--stars:url(${stars()})"></div>${planet(kind,kind==='saturn'?84:96,{lit:'fixed',spin:kind==='venus'?80:24})}<div class="xlp-meta"><b>${esc(b.k)}</b><span>Planet ${pn}</span><em class="${st.s}">${lab(st.s)}</em></div>`;
 const body=d.querySelector('.xlbody');body.insertBefore(el,body.firstChild);
 const ttl=bar.querySelector('b');if(ttl)ttl.innerHTML=`${esc(b.k)} · ${esc(b.m)} <span style="color:var(--muted);font-weight:500">· ${pn}</span>`};
X.stOf=stOf;

/* ---------------- 5. notifications: bottom-right stack, never over the header or each other ---------------- */
let DND=LS.get('dnd',false);
const _t=window.toast;window.toast=function(icon,title,msg,kind,onOpen){if(DND&&kind==='bad'){return}_t.apply(this,arguments)};
const nh=$('#npanel .nhead');if(nh){const b=document.createElement('button');b.className='dnd'+(DND?' on':'');b.innerHTML=`<span class="sw ${DND?'on':''}"></span>Do not disturb`;b.title='Mute pop-ups (the bell still collects everything)';
 b.onclick=()=>{DND=!DND;LS.set('dnd',DND);b.classList.toggle('on',DND);b.querySelector('.sw').classList.toggle('on',DND);_t(DND?'🔕':'🔔',DND?'Do not disturb on':'Pop-ups back on',DND?'Alerts still collect in the bell':'You will see new failures as pop-ups','ok')};nh.insertBefore(b,nh.lastElementChild)}

/* ---------------- 6. help center + helpers ---------------- */
const GLOSS=[['Journey','A Marketing Cloud flow that sends members messages or vouchers in steps.'],['Campaign','A one-off or scheduled send to a group of members.'],['Root cause','The underlying reason records failed, for example an expired voucher definition.'],['Repeat issue','The same root cause happening again after it was fixed once.'],['Pre-flight','Checks run before a journey starts, to predict failures.'],['Verdict','GO = safe, CHECK = minor risk, STOP = fix before it runs.'],['Escrow','Points held back until a return window closes.'],['Voucher definition','The template a voucher is issued from. It has an end date.'],['DPE','Data Processing Engine: Salesforce batch jobs that create journals and tiers.'],['Tier batch','The nightly job that upgrades or downgrades members.'],['MTTR','Mean time to resolve: how long a problem stays open on average.'],['SLA','The latest time a run should finish by.'],['Freshness','How old the newest data for a market is.'],['Pareto','The few causes behind most of the failures (the 80/20 rule).'],['SEV-1 / SEV-2','Severity. SEV-1 needs action today.'],['Read-only','The agent only reads Prod. It never changes, sends or deletes anything.']];
const FAQ=[['Which journeys will fail next?','Open Pre-flight. Each upcoming run shows predicted failures and a GO / CHECK / STOP verdict. Open one for the exact checks and records at risk.'],
 ['Why did a journey fail?','Journeys & campaigns → click the journey. The red step is where records were lost. The root-cause card explains why, with a 5-whys chain and the evidence.'],
 ['Has this happened before?','Look for the purple ↻ Repeat badge, or open Repeat issues for the full history by market and the permanent fix.'],
 ['Which records do I need to fix?','Record explorer. Filter by error or market, search a member ID, then click a row for expected vs actual and the record\'s history.'],
 ['How do I share results with my team?','Reports → open a report → Copy CSV. Or Insights → Copy daily digest for Teams or email.'],
 ['How do I stop a bad run from going out?','Pre-flight → open the journey → Exclude at-risk members, then fix the cause listed under "Fix before". The agent never sends anything itself.'],
 ['What do the planets mean?','Each planet is a market and the sun is overall health. Hover a planet for its status, click it to open the market.'],
 ['Too many pop-ups?','Open the bell and turn on Do not disturb. Everything still collects in the bell.'],
 ['How do I track my own work?','Use My Day for tasks, Tracker board to move issues through stages, and Following to keep an eye on records.'],
 ['Is it safe to use on Prod?','Yes. Everything is read-only: SELECT queries and exports only. No records are changed and no flows are triggered.']];
const KEYS=[['⌘K / Ctrl K','Search pages, journeys, causes and member IDs'],['n','Open notifications'],['Shift N','Mark all notifications read'],['g then h','Home'],['g then j','Journeys'],['g then r','Root-cause center'],['g then e','Record explorer'],['g then p','Pre-flight'],['g then i','Insights'],['?','Show this list'],['Esc','Close any panel']];
mk('viewHelp',`<section class="x-head glass"><div><div class="crumbs">Dashboard › <b>Help center</b></div><h2>🧭 Help center</h2><p>Everything you need to use this dashboard: a guided tour, quick answers to common questions, a glossary of terms and the keyboard shortcuts.</p></div>
 <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="x_tour()">▶ Take the tour</button><button class="btn ghost" onclick="x_keys()">⌨ Shortcuts</button></div></section>
 <section class="x-grid2"><div class="panel glass"><h4>❓ How do I…</h4><div id="hpF"></div></div><div style="display:flex;flex-direction:column;gap:12px">
 <div class="panel solid"><h4>🕘 Recently viewed</h4><div id="hpR"></div></div><div class="panel solid"><h4>🛡 Safety</h4><p style="font-size:13px;line-height:1.6;color:var(--text-2)">The dashboard and the agent are <b>read-only</b>. Pre-flight checks, record lookups and reports only run <code class="code">SELECT</code> queries and exports. Nothing is updated, sent, deleted or pushed into a flow. The "Exclude at-risk" button only builds a list for you.</p></div></div></section>
 <section class="panel solid"><h4>📖 Glossary <small>${GLOSS.length} terms</small></h4><div class="gl" id="hpG"></div></section>`);
RENDER.help=function(){$('#hpF').innerHTML=FAQ.map(([q,a],i)=>`<details class="faq"${i===0?' open':''}><summary>${q}</summary><p>${a}</p></details>`).join('');
 $('#hpG').innerHTML=GLOSS.map(([t,d])=>`<div><b>${t}</b><span>${d}</span></div>`).join('');drawRecent()};
VIEWS.help='viewHelp';NAVN.help='Help center';CR.help='Help center';
const sg=document.querySelector('#g4 .nav')||document.querySelector('.nav:last-of-type');if(sg){const li=document.createElement('li');li.dataset.n='Help center';li.tabIndex=0;li.innerHTML=`<span style="width:18px;text-align:center;flex:none">🧭</span><span class="nav-label">Help center</span>`;li.onclick=()=>x_show('help');sg.insertBefore(li,sg.firstChild)}
// recently viewed
let RECENT=LS.get('recent',[]);const pushR=(t,f)=>{RECENT=[{t,f},...RECENT.filter(x=>x.t!==t)].slice(0,8);LS.set('recent',RECENT)};
[['x_openJ',id=>{const j=J.find(x=>x.id===id);return j&&['🧭 '+j.n,`x_openJ('${id}')`]}],['x_openRec',id=>['🗂 '+id,`x_openRec('${id}')`]],['x_openInc',c=>ERR[c]&&['🧠 '+ERR[c].t,`x_openInc('${c}')`]],['x_pf',id=>{const j=J.find(x=>x.id===id);return j&&['🛫 Pre-flight · '+j.n,`x_pf('${id}')`]}]].forEach(([fn,lbl])=>{const o=window[fn];window[fn]=function(a){const r=o.apply(this,arguments);try{const l=lbl(a);if(l)pushR(l[0],l[1])}catch(e){}return r}});
const _od2=window.openDrawer;window.openDrawer=function(b){const r=_od2(b);if(b)pushR('🌐 '+b.k,`openDrawer(BUS.find(x=>x.k==='${b.k}'))`);return r};
function drawRecent(){const el=$('#hpR');if(el)el.innerHTML=RECENT.length?RECENT.map(r=>`<div class="conf2" style="cursor:pointer" onclick="${r.f.replace(/"/g,'&quot;')}"><b style="font-size:12.5px">${esc(r.t)}</b><span style="color:var(--muted)">›</span></div>`).join(''):'<div style="color:var(--muted);font-size:12px">Nothing yet. Open a journey, record or market and it shows up here.</div>'}
// shortcuts sheet
const ks=document.createElement('div');ks.className='ipop glass';ks.id='keySheet';document.body.appendChild(ks);
window.x_keys=()=>{ks.innerHTML=`<h5><span>⌨ Keyboard shortcuts</span><button class="iconbtn" style="width:28px;height:28px" onclick="this.closest('.ipop').classList.remove('on')">✕</button></h5><div class="keys">${KEYS.map(([k,d])=>`<div><kbd>${k}</kbd><span>${d}</span></div>`).join('')}</div>`;ks.style.top='90px';ks.style.left=Math.max(12,(innerWidth-ks.offsetWidth)/2)+'px';ks.classList.add('on')};
addEventListener('keydown',e=>{if(/input|textarea|select/i.test(e.target.tagName))return;if(e.key==='?'){e.preventDefault();x_keys()}if(e.key==='Escape'){ks.classList.remove('on');endTour()}});
// guided tour
const TOUR=[['.sidebar','Navigation','Every page lives here. Overview has the monitoring pages, Tracking has your own work, and Settings has Help.'],['#searchBtn','Search','Jump to any page, journey, root cause or member ID. Shortcut: ⌘K.'],['#bellBtn','Notifications','New failures and pre-flight blockers collect here. Turn on Do not disturb to mute pop-ups.'],['.sys','Health system','The sun is overall health and each planet is a market. Hover for status, click to open the market.'],['#kpis','Today at a glance','Counts with a 7-day trend. Click ⓘ on a tile for what it means.'],['.nav li[data-n="Pre-flight"]','Pre-flight','Predicts failures before each journey starts, so you can fix them first.'],['.nav li[data-n="Journeys & campaigns"]','Journeys','Step-by-step results for every journey, with root cause and the steps to fix it.'],['.nav li[data-n="Repeat issues"]','Repeat issues','Problems that came back, by market, with the permanent fix.'],['.nav li[data-n="Help center"]','Help center','Answers, glossary and shortcuts. You can restart this tour here at any time.']];
let ti=-1;const spot=document.createElement('div');spot.className='tour-spot';const tc=document.createElement('div');tc.className='tour-card glass';document.body.append(spot,tc);
function endTour(){ti=-1;spot.classList.remove('on');tc.classList.remove('on')}
function stepTour(){const [sel,t,d]=TOUR[ti];const el=$(sel);if(!el){ti++;if(ti<TOUR.length)return stepTour();return endTour()}el.scrollIntoView({block:'nearest',behavior:'smooth'});
 setTimeout(()=>{const r=el.getBoundingClientRect(),pad=6;spot.style.cssText=`left:${r.left-pad}px;top:${r.top-pad}px;width:${r.width+pad*2}px;height:${Math.min(r.height,innerHeight-40)+pad*2}px`;spot.classList.add('on');
  tc.innerHTML=`<small>Step ${ti+1} of ${TOUR.length}</small><b>${t}</b><p>${d}</p><div class="tour-btns"><button class="btn ghost sm" onclick="x_tourGo(-1)" ${ti?'':'disabled'}>Back</button><button class="btn ghost sm" onclick="x_tourEnd()">Skip</button><button class="btn sm" onclick="x_tourGo(1)">${ti===TOUR.length-1?'Finish':'Next'}</button></div>`;
  const cw=300,below=r.bottom+14+170<innerHeight;tc.style.left=Math.max(12,Math.min(innerWidth-cw-12,r.left+(r.width>cw?20:0)))+'px';tc.style.top=(below?r.bottom+14:Math.max(12,r.top-184))+'px';
  if(r.width<300&&r.left<300){tc.style.left=(r.right+16)+'px';tc.style.top=Math.max(12,Math.min(innerHeight-200,r.top))+'px'}tc.classList.add('on')},260)}
window.x_tour=()=>{closeAll();x_show('dash');setTimeout(()=>{ti=0;stepTour()},500)};window.x_tourGo=d=>{ti+=d;if(ti>=TOUR.length){endTour();confetti(innerWidth/2,innerHeight/3,80);toast('🎉','Tour complete','Open Help center any time for answers','ok');return}stepTour()};window.x_tourEnd=endTour;
spot.onclick=endTour;
if(!LS.get('toured',false)){LS.set('toured',true);setTimeout(()=>toast('🧭','New here?','Take a 1-minute tour of the dashboard','ok',()=>x_tour()),2600)}
// "updated x ago" + copy link + print in topbar
const tb=$('.topbar');const ups=document.createElement('span');ups.className='pill upd';ups.title='When the data on screen was last refreshed';const t0=Date.now();tb.insertBefore(ups,$('#agentPill'));
const updT=()=>{const s=Math.floor((Date.now()-t0)/1000);ups.innerHTML=`<span class="live"></span>Updated ${s<60?s+'s':Math.floor(s/60)+'m'} ago`};updT();setInterval(()=>{if(!document.hidden)updT()},5000);
const tools=document.createElement('div');tools.className='tbtools';tools.innerHTML=`<button class="iconbtn" title="Copy link to this page" onclick="x_link()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg></button><button class="iconbtn" title="Help (?)" onclick="x_show('help')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/></svg></button>`;tb.insertBefore(tools,$('#bellBtn'));
window.x_link=()=>{X.copy(location.href);toast('🔗','Link copied','Anyone with the link opens this page','ok')};
// density + print in appearance menu
const menu=$('#menu');menu.insertAdjacentHTML('beforeend',`<h5>Density</h5><div class="seg" id="denSeg"><button data-v="comfy" class="on">Comfortable</button><button data-v="compact">Compact</button></div><h5>Export</h5><button class="btn ghost sm" style="width:100%" onclick="window.print()">🖨 Print / save as PDF</button>`);
const setDen=v=>{document.body.dataset.density=v;$$('#denSeg button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));LS.set('density',v)};$$('#denSeg button').forEach(b=>b.onclick=()=>setDen(b.dataset.v));setDen(LS.get('density','comfy'));
PITEMS.push({n:'Help center',s:'faq glossary',f:()=>x_show('help')},{n:'Take the tour',s:'help onboarding',f:()=>x_tour()},{n:'Keyboard shortcuts',s:'help keys',f:()=>x_keys()});
const _rp=window.renderP;window.renderP=function(){_rp();if(!$('#pin').value.trim()&&RECENT.length){const ul=$('#plist');ul.insertAdjacentHTML('afterbegin','<li style="pointer-events:none;color:var(--muted);font-size:11px">RECENTLY VIEWED</li>'+RECENT.slice(0,4).map((r,i)=>`<li data-rv="${i}"><span>${esc(r.t)}</span><small>recent</small></li>`).join(''));ul.querySelectorAll('li[data-rv]').forEach(li=>li.onclick=()=>{closeAll();new Function(RECENT[+li.dataset.rv].f)()})}};
const h=location.hash.slice(1);if(h==='help')setTimeout(()=>x_show('help'),80);
setTimeout(()=>{const v=$('#viewHelp');if(v)X.charts&&0},0);
})();
