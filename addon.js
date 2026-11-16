/* ===== Sam & AT Command Center v2 add-on =====
   Journeys monitor · Root-cause center · Record explorer · Data ops · live alerts · record-level drawers · animals
   All data is deterministic demo data (seeded) shaped like the real bot outputs. */
(function(){
const $$=s=>[...document.querySelectorAll(s)];
let seed=20261116;const rnd=()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296};
const pick=a=>a[Math.floor(rnd()*a.length)];
const fmt=n=>Number(n).toLocaleString();
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct=(a,b)=>b?(a/b*100):0;
const copy=t=>{try{navigator.clipboard.writeText(t).catch(()=>{})}catch(e){}};
window.x_copy=(t,label)=>{copy(decodeURIComponent(t));toast('⧉','Copied',label||'to clipboard','ok')};

/* ---------------- error catalogue + root-cause knowledge base ---------------- */
const ERR={
 E_NO_CONTACT:{t:'Missing email / contact point',cat:'Data quality',c:'#FF9F0A',owner:'CRM data team',
  rc:'Member records were created by the POS sync without a ContactPointEmail. The journey entry filter allows them in, but the Email activity has no address to send to, so Marketing Cloud drops the send.',
  why:['Send dropped at the Email activity','Subscriber has no email address in the sendable DE','Loyalty member → Contact has no ContactPointEmail','POS member-create API sends email as optional and store staff skip it','Entry filter does not exclude contacts without a channel (design gap)'],
  ev:['ContactPointEmail is null on 100% of failed members','92% of the failed members were created by POS in the last 30 days','No change in failure rate after the MC deploy → not a release issue'],
  fix:['Export the failed member IDs (button below) and confirm they have no <code>ContactPointEmail</code>','Run the SOQL check below in Prod (read-only) to size the full population','Ask the CRM data team to load the missing emails, or switch these members to SMS','Change the journey entry filter: add <code>HasEmail = true</code> so they stop entering','Re-run the journey for the corrected members after the data load'],
  q:"SELECT Id, MembershipNumber, Contact.Email, Program.Name, CreatedDate\nFROM LoyaltyProgramMember\nWHERE Contact.Email = null AND MemberStatus = 'Active'\nAND CreatedDate = LAST_N_DAYS:30"},
 E_VDEF_EXPIRED:{t:'Voucher definition expired',cat:'Configuration',c:'#FF453A',owner:'Loyalty admin',
  rc:'The Voucher Definition used by the journey reached its EffectiveEndDate on 14 Nov. Every Issue Voucher action after that date fails with INVALID_VOUCHER_DEFINITION. Nobody extended it because the yearly renewal is not in the release calendar.',
  why:['Issue Voucher action returned INVALID_VOUCHER_DEFINITION','VoucherDefinition.EffectiveEndDate = 2026-11-14 (in the past)','The definition was created for 1 year and never extended','No alert exists for definitions expiring in the next 30 days','Ownership of yearly renewals is not assigned'],
  ev:['First failure 14 Nov 00:01 local, exactly on EffectiveEndDate','0 successful issues after that time across 3 journeys using the same definition','Same journeys succeed in the sandbox where the definition is still active'],
  fix:['Open the Voucher Definition and check <code>EffectiveEndDate</code> and <code>IsActive</code>','Extend the end date (or clone a new definition) — needs a change ticket, Prod is read-only for this agent','Update the journey to point at the new definition if cloned','Re-issue vouchers for members who failed since 14 Nov (list below)','Add a watch-list rule: definitions expiring in less than 30 days'],
  q:"SELECT Id, Name, EffectiveDate, ExpirationDate, IsActive\nFROM VoucherDefinition\nWHERE ExpirationDate <= NEXT_N_DAYS:30\nORDER BY ExpirationDate"},
 E_MEMBER_INACTIVE:{t:'Member inactive / merged',cat:'Data quality',c:'#BF5AF2',owner:'CRM data team',
  rc:'Members were merged by the duplicate clean-up job after they entered the journey. The surviving record has a new Id, so the journey step that updates the old member fails with ENTITY_IS_DELETED.',
  why:['Update Member step failed with ENTITY_IS_DELETED','The member Id was merged into another record','Duplicate clean-up ran at 05:00 while the journey wait step was active','Journey is not re-evaluating membership after wait steps','No exit criterion for merged / inactive members'],
  ev:['All failed Ids appear in the duplicate-merge log of 16 Nov 05:00','Failure time is always after 05:00'],
  fix:['Match failed member Ids against the merge log (Duplicate members check)','Add exit criteria: <code>MemberStatus != Active</code>','Move the dup clean-up job after the journey send window','Re-inject survivors into the journey if still eligible'],
  q:"SELECT Id, MembershipNumber, MemberStatus, LastModifiedDate\nFROM LoyaltyProgramMember\nWHERE MemberStatus IN ('Inactive','Merged')\nAND LastModifiedDate = TODAY"},
 E_DPE_NO_JOURNAL:{t:'Journal not created (DPE)',cat:'Platform / batch',c:'#0A84FF',owner:'Loyalty admin',
  rc:'The Data Processing Engine job that creates accrual journals finished with status Failed because the upstream transaction batch arrived 2h late. The journey reads journals that do not exist yet, so the points step finds nothing to process.',
  why:['Points step found 0 journals for the members','DPE job "Create Accrual Journals" ended Failed','The source transaction batch landed at 02:41 UTC instead of 00:40','Upstream POS file delivery was late (SFTP)','The journey has no dependency check on the DPE job'],
  ev:['BatchJob "Create Accrual Journals" status Failed at 01:10 UTC','Transaction file landed 02:41 UTC (2h late)','Re-run of DPE at 03:00 succeeded'],
  fix:['Check the DPE run in Setup → Data Processing Engine → job history','Confirm the transaction file arrival time in the SFTP log','Re-run the DPE job (change ticket) and then re-run this journey','Add a gate: journey waits for the DPE job to be Completed (same as the bot gates)'],
  q:"SELECT Id, BatchJobDefinitionName, Status, StartTime, EndTime\nFROM BatchJob\nWHERE CreatedDate = TODAY\nORDER BY StartTime DESC"},
 E_TIER_CHANGED:{t:'Tier changed during journey',cat:'Logic',c:'#64D2FF',owner:'Journey owner',
  rc:'The tier-upgrade batch ran while members were waiting inside the journey. The Black-tier decision split checks the tier at entry time, not the current tier, so upgraded members get the wrong path.',
  why:['Decision split sent members down the wrong path','Tier at entry ≠ tier at decision','Tier upgrade batch moved members while they waited 2 days','Split uses the entry-source attribute (snapshot)','Journey designed before the batch moved to 20:56 UTC'],
  ev:['All affected members had a tier change in the last 48h'],
  fix:['Change the split to use a contact attribute (live) instead of the entry snapshot','Exclude members whose tier changed after entry','Re-send correct communication to affected members'],
  q:"SELECT Id, MembershipNumber, CurrentTier.Name, LastModifiedDate\nFROM LoyaltyMemberTier\nWHERE LastModifiedDate = LAST_N_DAYS:2"},
 E_TIMEOUT:{t:'API timeout to Marketing Cloud',cat:'Integration',c:'#FFD60A',owner:'Integration team',
  rc:'Calls from the Salesforce flow to the MC Transactional API timed out (> 120s) between 06:30 and 06:52. MC status page shows degraded performance on stack S11 in the same window. Retries were not configured, so the records stayed failed.',
  why:['Callout returned Read timed out','MC Transactional API latency above 120 s','MC stack S11 degraded 06:30–06:52','Flow has no retry policy for timeouts','Failures were not re-queued automatically'],
  ev:['100% of timeouts inside 06:30–06:52','Same payloads succeeded on manual retry at 07:10'],
  fix:['Check trust.salesforce.com for stack S11 at the failure time','Retry the failed records (safe – idempotent keys)','Add retry with back-off (3 tries, 30/60/120 s) to the flow','Alert when the timeout rate goes above 2% in 15 min'],
  q:"SELECT Id, Status__c, ErrorMessage__c, CreatedDate\nFROM Integration_Log__c\nWHERE ErrorMessage__c LIKE '%timed out%' AND CreatedDate = TODAY"},
 E_CONSENT:{t:'No marketing consent',cat:'Compliance',c:'#30D158',owner:'Privacy team',
  rc:'Members withdrew marketing consent in the PDPA preference centre. These are correct suppressions, not errors — but they are counted as failures because the journey does not filter them out first.',
  why:['Send suppressed','HasOptedOutOfEmail = true','Preference centre change synced at 04:00'],
  ev:['All suppressed members have an opt-out record dated before the send'],
  fix:['No data fix needed – this is correct behaviour','Add the consent filter to the entry criteria so they are not counted as failures','Report them as "suppressed" instead of "failed"'],
  q:"SELECT Id, Email, HasOptedOutOfEmail FROM Contact\nWHERE HasOptedOutOfEmail = true AND LastModifiedDate = TODAY"},
};
const ERRK=Object.keys(ERR);

/* ---------------- journeys ---------------- */
const STEPS={birthday:['Entry','Eligibility','Issue voucher','Email','Delivered','Opened'],welcome:['Entry','Create member','Welcome pts','Email','SMS','Delivered'],
 tier:['Entry','Tier check','Decision split','Benefit','Email','Delivered'],expiry:['Entry','Points calc','Reminder email','Push','Delivered'],reactivate:['Entry','Wait 2d','Offer voucher','Email','Delivered','Redeemed']};
const J=[
 {id:'J1',n:'TH Black Birthday voucher',bu:'TH 5640',p:'SAM',k:'birthday',st:'bad',in:1240,fs:3,err:{E_NO_CONTACT:41,E_CONSENT:6},streak:3,own:'TH CRM'},
 {id:'J2',n:'SG Welcome series',bu:'SG 5010',p:'SAM',k:'welcome',st:'bad',in:860,fs:2,err:{E_VDEF_EXPIRED:212},streak:2,own:'SG CRM'},
 {id:'J3',n:'MY Points expiry reminder',bu:'MY 5050',p:'AT',k:'expiry',st:'warn',in:3120,fs:2,err:{E_TIMEOUT:58,E_NO_CONTACT:9},streak:1,own:'MY CRM'},
 {id:'J4',n:'KR Tier upgrade congrats',bu:'KR 5040',p:'AT',k:'tier',st:'bad',in:540,fs:2,err:{E_TIER_CHANGED:37,E_DPE_NO_JOURNAL:22},streak:4,own:'KR CRM'},
 {id:'J5',n:'HK Silver anniversary',bu:'HK 5090',p:'SAM',k:'birthday',st:'ok',in:410,fs:-1,err:{},streak:0,own:'HK CRM'},
 {id:'J6',n:'TW Reactivation 90d',bu:'TW 5060',p:'SAM',k:'reactivate',st:'warn',in:2210,fs:2,err:{E_MEMBER_INACTIVE:31},streak:1,own:'TW CRM'},
 {id:'J7',n:'JP Welcome series',bu:'JP 5630',p:'SAM',k:'welcome',st:'ok',in:320,fs:-1,err:{},streak:0,own:'JP CRM'},
 {id:'J8',n:'SG Birthday double points',bu:'SG 5010',p:'SAM',k:'birthday',st:'bad',in:980,fs:2,err:{E_VDEF_EXPIRED:96},streak:2,own:'SG CRM'},
 {id:'J9',n:'TUMI Gold qualify',bu:'TUMI',p:'TUMI',k:'tier',st:'ok',in:190,fs:-1,err:{},streak:0,own:'TUMI CRM'},
 {id:'J10',n:'MY Black renewal reminder',bu:'MY 5050',p:'SAM',k:'expiry',st:'none',in:0,fs:-1,err:{},streak:0,own:'MY CRM',notrun:'Entry DE was empty – upstream export did not run'},
 {id:'J11',n:'TH AT Welcome',bu:'TH 5640',p:'AT',k:'welcome',st:'ok',in:1500,fs:3,err:{E_CONSENT:4},streak:0,own:'TH CRM',rec:true},
 {id:'J12',n:'KR Points expiry reminder',bu:'KR 5040',p:'SAM',k:'expiry',st:'warn',in:1760,fs:1,err:{E_DPE_NO_JOURNAL:44},streak:1,own:'KR CRM'},
 {id:'J13',n:'TW Birthday voucher',bu:'TW 5060',p:'AT',k:'birthday',st:'ok',in:690,fs:-1,err:{},streak:0,own:'TW CRM'},
 {id:'J14',n:'HK Lapsed win-back',bu:'HK 5090',p:'SAM',k:'reactivate',st:'warn',in:1310,fs:3,err:{E_TIMEOUT:27},streak:1,own:'HK CRM'},
];
J.forEach(j=>{const steps=STEPS[j.k];const fails=Object.values(j.err).reduce((a,b)=>a+b,0);j.fail=fails;let cur=j.in;
 j.sc=steps.map((s,i)=>{if(i>0){const drop=i===j.fs?fails:Math.round(cur*(s==='Opened'?.55:s==='Redeemed'?.8:s==='Delivered'?.01:.02*rnd()));cur=Math.max(0,cur-drop)}return {s,c:cur}});
 j.sr=j.in?(1-fails/j.in)*100:0;j.tr=Array.from({length:14},(_,i)=>Math.max(0,Math.round((i>=14-Math.max(j.streak,1)&&j.fail?j.fail*(.7+rnd()*.5):j.fail*.05*rnd())+rnd()*3)));
 j.last=j.st==='none'?'—':`16 Nov ${String(5+Math.floor(rnd()*4)).padStart(2,'0')}:${String(Math.floor(rnd()*60)).padStart(2,'0')}`;
 j.mttr=j.fail?Math.round(30+rnd()*240):0;});

/* ---------------- failed records (record level) ---------------- */
const TIERS=['Navy','Silver','Black','Regular','Insider','Gold'];
const FN=['Ananya','Wei','Somchai','Mei','Haruto','Ji-woo','Siti','Arjun','Lim','Nattaya','Kenji','Hui','Farah','Min-jun','Ploy'];
const LN=['Tan','Chen','Wong','Lee','Kim','Sato','Lim','Rahman','Park','Suzuki','Ng','Chua','Ong'];
const BUP={'TH 5640':'TH','SG 5010':'SG','MY 5050':'MY','KR 5040':'KR','HK 5090':'HK','TW 5060':'TW','JP 5630':'JP','TUMI':'TU'};
const REC=[];let rid=0;
J.forEach(j=>Object.entries(j.err).forEach(([code,n])=>{for(let i=0;i<n;i++){rid++;const pre=(j.p==='AT'?'AT':j.p==='TUMI'?'TU':'SS')+BUP[j.bu];
 const h=5+Math.floor(rnd()*5),m=Math.floor(rnd()*60);const first=FN[Math.floor(rnd()*FN.length)],last=LN[Math.floor(rnd()*LN.length)];
 REC.push({id:pre+'2025'+String(1000000+Math.floor(rnd()*8999999)),name:first+' '+last,email:code==='E_NO_CONTACT'?'—':(first[0]+'***'+'@'+pick(['gmail.com','yahoo.com','hotmail.com'])).toLowerCase(),
 j:j.id,jn:j.n,bu:j.bu,step:j.sc[Math.max(1,j.fs)].s,code,tier:pick(TIERS),ts:`16 Nov ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`,tsn:h*60+m,
 retry:code==='E_TIMEOUT'?Math.floor(rnd()*3):0,st:code==='E_CONSENT'?'Suppressed':rnd()<.12?'Retried OK':'Open',src:'Journey',sev:code==='E_CONSENT'?'info':['E_VDEF_EXPIRED','E_NO_CONTACT','E_DPE_NO_JOURNAL'].includes(code)?'bad':'warn'})}}));
/* check-level findings (BU daily checks) become records too */
const CHK=[['No-contact','E_NO_CONTACT',34,'All BUs'],['Stuck escrow','ESCROW_STUCK',1,'MY 5050'],['KR 5040','TIER_PENDING',1,'KR 5040'],['SG 5010','TIER_DOWNGRADE',1,'SG 5010'],['Return amount','RETURN_GT_SALE',2,'MY 5050'],['Escrow expiry','ESCROW_AT_EXPIRY',1,'TH 5640']];
const CHKERR={ESCROW_STUCK:{t:'Escrow past release date',c:'#BF5AF2',rc:'Escrow points were not released because the release batch skips members with a pending return. The return was cancelled, but the escrow row kept the old hold flag.',fix:['Load the Escrow_Stuck release file','Verify renewal after the next tier batch']},
 TIER_PENDING:{t:'Tier recalculation pending',c:'#0A84FF',rc:'AT Korea tier batch runs at 02:30 UTC; the member qualifies but is still on the old tier until then.',fix:['Wait for the 02:30 UTC batch','Verify lifecycle "Downgrade Insider"']},
 TIER_DOWNGRADE:{t:'Tier downgrade candidate',c:'#0A84FF',rc:'Qualifying spend fell under the Silver threshold after a return.',fix:['Confirm the return in the transaction journal','Verify after tonight\'s batch']},
 RETURN_GT_SALE:{t:'Return amount greater than sale',c:'#64D2FF',rc:'Offline return was keyed with the gross amount including tax twice.',fix:['Ask the store to correct the return','Reverse the extra points (change ticket)']},
 ESCROW_AT_EXPIRY:{t:'Escrow at tier expiry',c:'#BF5AF2',rc:'Tier ends while points are still in escrow; the member would drop a tier.',fix:['Release escrow before the tier end date']}};
CHK.forEach(([chk,code,n,bu])=>{for(let i=0;i<n;i++){rid++;const b=bu==='All BUs'?pick(['TH 5640','SG 5010','MY 5050','HK 5090','KR 5040']):bu;const h=6+Math.floor(rnd()*3),m=Math.floor(rnd()*60);
 REC.push({id:'SS'+BUP[b]+'2025'+String(1000000+Math.floor(rnd()*8999999)),name:pick(FN)+' '+pick(LN),email:code==='E_NO_CONTACT'?'—':'h***@gmail.com',j:'CHK',jn:'Daily check · '+chk,bu:b,step:'Daily check',code,tier:pick(TIERS),
 ts:`16 Nov ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`,tsn:h*60+m,retry:0,st:'Open',src:'Daily check',sev:'bad'})}});
const errInfo=c=>ERR[c]||CHKERR[c]||{t:c,c:'#8E8E93',rc:'',fix:[]};

/* ---------------- incidents (clustered root causes) ---------------- */
const INC=ERRK.map(code=>{const recs=REC.filter(r=>r.code===code);const js=[...new Set(recs.map(r=>r.j))].filter(x=>x!=='CHK');const bus=[...new Set(recs.map(r=>r.bu))];
 return {code,recs:recs.length,js,bus,first:recs.length?recs.reduce((a,r)=>r.tsn<a.tsn?r:a).ts:'—',sev:code==='E_CONSENT'?'info':recs.length>100?'bad':recs.length>40?'bad':'warn',conf:{E_NO_CONTACT:94,E_VDEF_EXPIRED:98,E_MEMBER_INACTIVE:87,E_DPE_NO_JOURNAL:91,E_TIER_CHANGED:76,E_TIMEOUT:89,E_CONSENT:99}[code]}}).filter(i=>i.recs).sort((a,b)=>b.recs-a.recs);

/* ---------------- DOM: views ---------------- */
const main=document.querySelector('main');const foot=document.querySelector('.footer-note');
const mk=(id,html)=>{const v=document.createElement('div');v.className='view';v.id=id;v.hidden=true;v.innerHTML=html;main.insertBefore(v,foot);return v};
const kpiH=(l,v,s,cls)=>`<div class="x-kpi glass ${cls||''}"><div class="lbl">${l}</div><div class="v num" data-v="${typeof v==='number'?v:''}">${typeof v==='number'?0:v}</div><div class="s">${s||''}</div></div>`;

const totIn=J.reduce((a,j)=>a+j.in,0),totF=J.reduce((a,j)=>a+j.fail,0),failing=J.filter(j=>j.st==='bad').length,degr=J.filter(j=>j.st==='warn').length;
mk('viewJourneys',`
 <section class="x-head glass"><div><div class="crumbs">Dashboard › <b>Journeys & campaigns</b></div><h2>🧭 Journey & Campaign Monitor</h2>
 <p>Every Marketing Cloud journey and loyalty campaign that ran today, step by step. Failing steps are highlighted, and each failure has a root cause, the records affected and the steps to fix it.</p></div>
 <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="x_show('rca')">🔍 Root-cause center</button><button class="btn ghost" onclick="x_exportJ()">⬇ Export report</button></div></section>
 <div class="ticker glass" id="ticker"><span class="lv">LIVE</span><div style="overflow:hidden;flex:1"><div class="tk" id="tk"></div></div></div>
 <section class="x-kpis">${kpiH('Journeys run today',J.filter(j=>j.in).length,'of '+J.length+' scheduled')}${kpiH('Failing',failing,'need action now','bad')}${kpiH('Degraded',degr,'partial failures','warn')}
 ${kpiH('Records entered',totIn,'across all journeys')}${kpiH('Records failed',totF,(totF/totIn*100).toFixed(2)+'% failure rate','bad')}${kpiH('Success rate',(100-totF/totIn*100).toFixed(1)+'%','target ≥ 99%','warn')}
 ${kpiH('Not run',J.filter(j=>j.st==='none').length,'entry DE empty','warn')}${kpiH('Median MTTR','2h 05m','time to resolve')}</section>
 <section class="panel glass"><h4><span>All journeys <small id="jcount"></small></span><div class="chips" id="jf"><span class="chip on" data-f="all">All</span><span class="chip" data-f="bad">Failing</span><span class="chip" data-f="warn">Degraded</span><span class="chip" data-f="none">Not run</span><span class="chip" data-f="ok">Healthy</span></div></h4>
 <div class="toolbar"><input class="inp" id="jq" placeholder="Search journey, BU, error…" style="flex:1;max-width:320px"><select class="inp" id="jbu"><option value="">All BUs</option>${[...new Set(J.map(j=>j.bu))].map(b=>`<option>${b}</option>`).join('')}</select>
 <select class="inp" id="jsort"><option value="fail">Sort: most failures</option><option value="sr">Sort: lowest success</option><option value="name">Sort: name</option></select></div>
 <div id="jlist"></div></section>
 <section class="x-grid2"><div class="panel solid"><h4>📉 Failures by hour · today <small>stacked by error</small></h4><div id="jhour"></div></div>
 <div class="panel solid"><h4>🧩 Failure reasons <small>click to see records</small></h4><div id="jreason"></div></div></section>
 <section class="panel solid"><h4>🗓 Journey health · last 14 days <small>failed records per day</small></h4><div id="jheat" style="overflow-x:auto"></div></section>`);

mk('viewRca',`
 <section class="x-head glass"><div><div class="crumbs">Dashboard › <b>Root-cause center</b></div><h2>🔍 Root-Cause Center</h2>
 <p>Failures are grouped by their underlying cause, not by journey. Fix one cause and it clears every journey and record it affects. Each incident has evidence, a 5-whys chain, a confidence score and a fix playbook.</p></div>
 <div style="display:flex;gap:8px"><button class="btn" onclick="x_copyRca()">⧉ Copy incident summary</button></div></section>
 <section class="x-kpis">${kpiH('Open incidents',INC.filter(i=>i.sev!=='info').length,'distinct root causes','bad')}${kpiH('Records impacted',INC.reduce((a,i)=>a+i.recs,0),'across journeys + checks')}
 ${kpiH('Journeys affected',new Set(INC.flatMap(i=>i.js)).size,'of '+J.length)}${kpiH('Top cause share',Math.round(INC[0].recs/INC.reduce((a,i)=>a+i.recs,0)*100)+'%',errInfo(INC[0].code).t,'warn')}${kpiH('Avg confidence',Math.round(INC.reduce((a,i)=>a+i.conf,0)/INC.length)+'%','evidence-based')}</section>
 <section class="x-grid3" id="incs"></section>
 <section class="panel solid"><h4>⏱ Event timeline · 16 Nov (UTC) <small>failures lined up against batches, deploys and upstream events</small></h4><div class="tl" id="tl"></div></section>
 <section class="x-grid2"><div class="panel solid"><h4>🌐 Blast radius <small>cause → journeys → BUs</small></h4><div id="blast"></div></div>
 <div class="panel solid"><h4>🔔 Alert rules <small>what notifies you</small></h4><div id="rules"></div></div></section>`);

mk('viewRecords',`
 <section class="x-head glass"><div><div class="crumbs">Dashboard › <b>Record explorer</b></div><h2>🗂 Record Explorer</h2>
 <p>Every failed or flagged record from journeys and daily checks in one place. Filter, sort, search a member ID, and open a record to see its full history, expected vs actual, and why it failed.</p></div>
 <div style="display:flex;gap:8px"><button class="btn" onclick="x_csv()">⬇ Export CSV</button><button class="btn ghost" onclick="x_copyIds()">⧉ Copy IDs</button></div></section>
 <section style="display:grid;grid-template-columns:230px 1fr;gap:12px" id="recGrid">
 <div class="panel solid" style="align-self:start"><h4>Filters <small><a style="color:var(--info);cursor:pointer" onclick="x_clearF()">Clear</a></small></h4>
  <div style="font-size:11px;color:var(--muted);margin:4px 0">Status</div><div class="facets" id="fSt"></div>
  <div style="font-size:11px;color:var(--muted);margin:12px 0 4px">Error</div><div class="facets" id="fCode"></div>
  <div style="font-size:11px;color:var(--muted);margin:12px 0 4px">Business unit</div><div class="facets" id="fBu"></div>
  <div style="font-size:11px;color:var(--muted);margin:12px 0 4px">Source</div><div class="facets" id="fSrc"></div></div>
 <div class="panel glass"><div class="toolbar"><input class="inp" id="rq" placeholder="Search member ID, name, journey…" style="flex:1"><select class="inp" id="rps"><option>25</option><option>50</option><option>100</option></select></div>
  <div class="rwrap"><table class="rtbl"><thead><tr>${[['id','Member ID'],['name','Name'],['bu','BU'],['jn','Journey / check'],['step','Step'],['code','Error'],['tier','Tier'],['ts','Time'],['st','Status']].map(([k,l])=>`<th data-k="${k}">${l}</th>`).join('')}</tr></thead><tbody id="rbody"></tbody></table></div>
  <div class="pager"><span id="rinfo"></span><span><button class="btn ghost sm" id="rprev">‹ Prev</button><button class="btn ghost sm" id="rnext">Next ›</button></span></div></div>
 </section>`);

mk('viewOps',`
 <section class="x-head glass"><div><div class="crumbs">Dashboard › <b>Data ops</b></div><h2>⚙️ Data Pipeline & Quality</h2>
 <p>How the data gets here: Prod exports → checks → reports. Run times against SLA, data freshness per BU, volume anomalies and data-quality scores per object — the view a data engineer uses to trust the numbers.</p></div></section>
 <section class="x-kpis">${kpiH('Pipeline runs today',27,'2 scheduled sets + 25 units')}${kpiH('Succeeded',25,'92.6%','ok')}${kpiH('Failed / retried',2,'TW export retried','warn')}${kpiH('SLA breaches',1,'VJ journals > 3h','bad')}${kpiH('Rows exported',1840233,'bulk API, read-only')}${kpiH('DQ score',96.4+'%','weighted, 7 objects','ok')}</section>
 <section class="panel solid"><h4>🔀 Pipeline lineage <small>live status · click a node</small></h4><svg class="dag" id="dag" viewBox="0 0 1000 250" preserveAspectRatio="xMidYMid meet"></svg></section>
 <section class="x-grid2"><div class="panel solid"><h4>⏳ Run timeline · 16 Nov (UTC) <small>dashed = SLA</small></h4><div id="gantt"></div></div>
 <div class="panel solid"><h4>🧊 Data freshness <small>newest export per BU</small></h4><div class="fresh" id="fresh"></div></div></section>
 <section class="x-grid2"><div class="panel solid"><h4>📈 Volume anomaly · vouchers expired <small>30 days · band = mean ± 2σ</small></h4><div id="anom"></div></div>
 <div class="panel solid"><h4>✅ Data quality by object <small>completeness · validity · uniqueness · timeliness · consistency</small></h4><div id="dq"></div></div></section>`);

/* ---------------- navigation ---------------- */
const NEWNAV=[['Journeys & campaigns','🧭','journeys',String(failing)],['Root-cause center','🔍','rca',String(INC.filter(i=>i.sev!=='info').length)],['Record explorer','🗂','records',String(REC.length)],['Data ops','⚙️','ops','']];
const ul=document.querySelector('#g0 .nav');let after=ul.children[1];
NEWNAV.forEach(([n,e,v,b])=>{const li=document.createElement('li');li.dataset.n=n;li.dataset.xv=v;li.tabIndex=0;
 li.innerHTML=`<span style="width:18px;text-align:center;flex:none">${e}</span><span class="nav-label">${n}</span>${b?`<span class="badge ${v==='journeys'||v==='rca'?'':'soft'}">${b}</span>`:''}`;
 li.onclick=()=>x_show(v);ul.insertBefore(li,after.nextSibling);after=li;});
const VIEWS={dash:'viewDash',camp:'viewCamp',journeys:'viewJourneys',rca:'viewRca',records:'viewRecords',ops:'viewOps'};
const NAVN={dash:'Dashboard',camp:'Campaign failures',journeys:'Journeys & campaigns',rca:'Root-cause center',records:'Record explorer',ops:'Data ops'};
const CR={dash:'Command Center',camp:'Campaigns',journeys:'Journeys & campaigns',rca:'Root-cause center',records:'Record explorer',ops:'Data ops'};
const rendered={};const RENDER={};
window.x_show=window.showView=function(v){if(!VIEWS[v])v='dash';closeAll();const sw=()=>{Object.entries(VIEWS).forEach(([k,id])=>{const el=document.getElementById(id);if(el)el.hidden=k!==v});
 $$('.nav li').forEach(x=>x.classList.toggle('active',x.dataset.n===NAVN[v]));$('.topbar .crumbs').innerHTML='Dashboard › <b>'+CR[v]+'</b>';scrollTo({top:0,behavior:'smooth'});
 if(!rendered[v]){try{(RENDER[v]||(()=>{}))();rendered[v]=1}catch(e){console.error('render '+v,e)}}
 const h=v==='dash'?'':v==='camp'?'#campaigns':'#'+v;try{if(location.hash!==h)history.replaceState(null,'',h||location.pathname)}catch(e){}
 requestAnimationFrame(()=>{countAll(document.getElementById(VIEWS[v]));addBirds()})};
 if(document.startViewTransition&&motionOn)document.startViewTransition(sw);else sw()};
function countAll(root){if(!root)return;root.querySelectorAll('.x-kpi .v[data-v]').forEach(el=>{if(el.dataset.v!==''&&!el.dataset.done){el.dataset.done=1;countUp(el,+el.dataset.v)}})}
window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);x_show(v==='campaigns'?'camp':v||'dash')});

/* ---------------- Journeys view ---------------- */
setTimeout(()=>Object.assign(RENDER,{journeys:renderJ,rca:renderRca,records:renderRec,ops:renderOps}));
const SC={bad:'Failing',warn:'Degraded',ok:'Healthy',none:'Not run'};const SE={bad:'⛔',warn:'⚠️',ok:'✅',none:'⏸'};
let jf='all';
function renderJ(){
 $$('#jf .chip').forEach(c=>c.onclick=()=>{$$('#jf .chip').forEach(x=>x.classList.remove('on'));c.classList.add('on');jf=c.dataset.f;jList()});
 ['#jq','#jbu','#jsort'].forEach(s=>$(s).oninput=jList);jList();
 // hourly stacked
 const hours=[...Array(12)].map((_,i)=>i+3);const by={};REC.filter(r=>r.src==='Journey').forEach(r=>{const h=Math.floor(r.tsn/60);by[h]=by[h]||{};by[h][r.code]=(by[h][r.code]||0)+1});
 const mx=Math.max(...hours.map(h=>Object.values(by[h]||{}).reduce((a,b)=>a+b,0)),1);
 $('#jhour').innerHTML=`<div class="bars" style="height:170px;gap:6px">${hours.map((h,i)=>{const o=by[h]||{};const t=Object.values(o).reduce((a,b)=>a+b,0);
  return `<div style="height:${t/mx*100}%;animation-delay:${i*30}ms;border-radius:6px 6px 2px 2px" title="${String(h).padStart(2,'0')}:00 · ${t} failed">${Object.entries(o).map(([c,v])=>`<span style="flex:${v};background:${errInfo(c).c}"></span>`).join('')}</div>`}).join('')}</div>
  <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:4px">${hours.map(h=>`<span>${String(h).padStart(2,'0')}</span>`).join('')}</div>
  <div class="legend" style="flex-direction:row;flex-wrap:wrap;gap:4px 12px">${ERRK.map(c=>`<div><i style="background:${ERR[c].c}"></i>${ERR[c].t}</div>`).join('')}</div>`;
 const rs={};REC.filter(r=>r.src==='Journey').forEach(r=>rs[r.code]=(rs[r.code]||0)+1);const rmx=Math.max(...Object.values(rs));
 $('#jreason').innerHTML=Object.entries(rs).sort((a,b)=>b[1]-a[1]).map(([c,v],i)=>`<div class="rbar" style="cursor:pointer;grid-template-columns:190px 1fr 46px" onclick="x_recFilter('code','${c}')"><span>${ERR[c].t}</span><span class="t"><i style="width:${v/rmx*100}%;background:${ERR[c].c};animation-delay:${i*60}ms"></i></span><b class="num">${v}</b></div>`).join('')
  +`<div class="fix">💡 <b>${ERR[INC[0].code].t}</b> alone explains ${Math.round(INC[0].recs/REC.length*100)}% of all failed records. Fix it first — <a style="color:var(--info);cursor:pointer;font-weight:600" onclick="x_openInc('${INC[0].code}')">open playbook →</a></div>`;
 // heat
 const days=[...Array(14)].map((_,i)=>{const d=new Date(2026,10,3+i);return d.getDate()+'/'+(d.getMonth()+1)});
 const hcol=v=>v===0?'rgba(48,209,88,.25)':v<10?'rgba(255,214,10,.35)':v<50?'rgba(255,159,10,.55)':'rgba(255,69,58,.75)';
 $('#jheat').innerHTML=`<div class="hm" style="grid-template-columns:200px repeat(14,minmax(28px,1fr));min-width:640px"><span></span>${days.map(d=>`<span style="font-size:9.5px;color:var(--muted);text-align:center">${d}</span>`).join('')}
  ${J.map(j=>`<span class="l">${j.n}</span>${j.tr.map((v,i)=>`<span class="c" style="background:${hcol(v)}" title="${j.n} · ${days[i]} · ${v} failed" onclick="x_openJ('${j.id}')"></span>`).join('')}`).join('')}</div>`;
 // ticker
 const items=REC.filter(r=>r.st==='Open').slice(0,30).map(r=>`<span>⛔ <b>${r.id}</b> · ${esc(r.jn)} · ${errInfo(r.code).t} · ${r.ts}</span>`).join('');$('#tk').innerHTML=items+items;
}
function jList(){const q=$('#jq').value.toLowerCase(),bu=$('#jbu').value,so=$('#jsort').value;
 let L=J.filter(j=>(jf==='all'||j.st===jf)&&(!bu||j.bu===bu)&&(!q||(j.n+j.bu+Object.keys(j.err).map(c=>ERR[c].t).join(' ')).toLowerCase().includes(q)));
 L.sort(so==='name'?(a,b)=>a.n.localeCompare(b.n):so==='sr'?(a,b)=>(a.in?a.sr:101)-(b.in?b.sr:101):(a,b)=>b.fail-a.fail);
 $('#jcount').textContent=L.length+' shown';
 $('#jlist').innerHTML=L.map((j,i)=>{const mx=j.in||1;const top=Object.entries(j.err).sort((a,b)=>b[1]-a[1]);
  return `<div class="jrow" style="animation-delay:${i*30}ms" onclick="x_openJ('${j.id}')"><div class="jico ${j.st}">${SE[j.st]}</div>
  <div class="nm"><b>${esc(j.n)}</b><small>${j.bu} · ${j.p} · last run ${j.last}${j.streak>1?` · <span class="streak">🔁 failing ${j.streak} runs</span>`:''}</small></div>
  <div class="steps-w"><div class="steps">${j.sc.map((s,k)=>`<span class="stp ${k===j.fs&&j.fail?'f':''}" title="${s.s}: ${fmt(s.c)}" style="height:${Math.max(6,s.c/mx*100)}%;background:linear-gradient(180deg,#64D2FF,#0A84FF);animation-delay:${i*30+k*50}ms"></span>`).join('')}</div>
  <div class="smeta"><span>${j.sc[0].s} ${fmt(j.in)}</span>${j.fail?`<span style="color:#ff8b84">✕ ${fmt(j.fail)} at ${j.sc[j.fs].s}</span>`:''}<span>${j.sc[j.sc.length-1].s} ${fmt(j.sc[j.sc.length-1].c)}</span></div></div>
  <div>${j.notrun?`<span class="rchip w">${esc(j.notrun)}</span>`:top.length?top.slice(0,2).map(([c,v])=>`<span class="rchip" style="color:${ERR[c].c};background:${ERR[c].c}22">${ERR[c].t} · ${v}</span>`).join(''):'<span class="rchip" style="color:var(--ok);background:rgba(48,209,88,.14)">No failures</span>'}</div>
  <div class="sr num">${j.in?j.sr.toFixed(1)+'%':'—'}<small>success</small></div>
  <div><span class="stbadge ${j.st}">${j.rec&&j.st==='ok'?'Recovered':SC[j.st]}</span></div></div>`}).join('')||'<div class="empty"><div class="ic">🦉</div>No journeys match</div>';}
window.x_openJ=function(id){const j=J.find(x=>x.id===id);const d=$('#drawer');d.classList.add('wide');const recs=REC.filter(r=>r.j===id);
 const top=Object.entries(j.err).sort((a,b)=>b[1]-a[1]);const main=top.find(([c])=>c!=='E_CONSENT')||top[0];const E=main?ERR[main[0]]:null;
 d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div><div style="color:var(--muted);font-size:12px">Journeys › ${j.bu}</div><h3>${esc(j.n)}</h3>
 <div style="color:var(--muted);font-size:12.5px">${j.p} · owner ${j.own} · last run ${j.last}</div><span class="st ${j.st==='none'?'warn':j.st}">${SE[j.st]} ${SC[j.st]}${j.streak>1?' · '+j.streak+' runs in a row':''}</span></div><button class="iconbtn" onclick="closeAll()">✕</button></div>
 <div class="kgrid num"><div><b>${fmt(j.in)}</b><span>Entered</span></div><div><b style="color:${j.fail?'var(--bad)':'var(--ok)'}">${fmt(j.fail)}</b><span>Failed records</span></div><div><b>${j.in?j.sr.toFixed(2)+'%':'—'}</b><span>Success rate</span></div><div><b>${j.mttr?Math.floor(j.mttr/60)+'h '+j.mttr%60+'m':'—'}</b><span>Open for</span></div></div>
 <h4 style="font-size:14px">Journey flow</h4><div class="flow">${j.sc.map((s,k)=>`${k?`<div class="farrow ${k===j.fs&&j.fail?'f':''}"><i></i>${k===j.fs&&j.fail?`<em>−${fmt(j.fail)}</em>`:''}</div>`:''}<div class="fnode ${k===j.fs&&j.fail?'f':''}" style="animation-delay:${k*70}ms"><b>${s.s}</b><div class="c num">${fmt(s.c)}</div><small>${k?pct(s.c,j.sc[k-1].c||1).toFixed(1)+'% pass':'records'}</small></div>`).join('')}</div>
 ${j.notrun?`<div class="msg"><b>⏸ Not run</b><p>${esc(j.notrun)}.</p><div class="ts"><h6>Troubleshooting</h6>${['Check the upstream export log for the entry DE (Logs → bot_2026-11-16.log)','Confirm the automation that fills the entry DE ran (MC Automation Studio → activity history)','Re-run the export, then start the journey manually'].map((s,i)=>`<div class="tstep" onclick="this.classList.toggle('done')"><span class="n">${i+1}</span><span>${s}</span></div>`).join('')}</div></div>`:''}
 ${E?rcaBlock(main[0],main[1],j):(!j.notrun?`<div class="msg" style="border-color:rgba(48,209,88,.35);background:rgba(48,209,88,.10)"><b>✓ Healthy</b><p>No failures in the last run.</p></div>`:'')}
 ${top.length>1?`<h4 style="font-size:14px;margin-top:16px">Other errors in this journey</h4>${top.filter(t=>t!==main).map(([c,v])=>`<div class="rbar" style="grid-template-columns:200px 1fr 40px"><span>${ERR[c].t}</span><span class="t"><i style="width:${v/j.fail*100}%;background:${ERR[c].c}"></i></span><b>${v}</b></div>`).join('')}`:''}
 ${recs.length?`<div class="drec"><h4>Failed records <small style="color:var(--muted);font-weight:500">${recs.length} · showing 12</small><span><button class="btn ghost sm" onclick="x_recFilter('j','${j.id}')">Open all in explorer →</button></span></h4>${recTable(recs.slice(0,12))}</div>`:''}`;
 d.classList.add('on');$('#scrim').classList.add('on');bindRecRows(d)};
function rcaBlock(code,n,j){const E=ERR[code];const inc=INC.find(i=>i.code===code);
 return `<div class="rca"><h5><span>🧠 Root cause · ${E.t}</span><span class="conf">confidence <span class="t"><i style="width:${inc?inc.conf:80}%"></i></span><b>${inc?inc.conf:80}%</b></span></h5>
 <div style="font-size:11px;color:var(--muted);margin-top:4px">${E.cat} · owner: ${E.owner} · ${n} records in this ${j?'journey':'incident'}${inc&&inc.js.length>1?' · also hits '+(inc.js.length-1)+' other journeys':''}</div>
 <p>${E.rc}</p>
 <div class="why">${E.why.map(w=>`<div>${w}</div>`).join('')}</div>
 <div class="ev">${E.ev.map(e=>`<div><b>EVIDENCE</b><span>${e}</span></div>`).join('')}</div></div>
 <div class="ts"><h6>Troubleshooting steps · tick as you go</h6>${E.fix.map((s,i)=>`<div class="tstep" onclick="x_tick(this)"><span class="n">${i+1}</span><span>${s}</span></div>`).join('')}
 <h6 style="margin-top:12px">Verify in Prod (read-only SOQL)</h6><pre class="q"><span class="cp" onclick="x_copy('${encodeURIComponent(E.q)}','SOQL query')">⧉ copy</span>${esc(E.q)}</pre></div>`}
window.x_tick=el=>{el.classList.toggle('done');if(el.classList.contains('done')){const r=el.getBoundingClientRect();sparkle(r.left+14,r.top+10,'✓');const all=el.parentElement.querySelectorAll('.tstep'),dn=el.parentElement.querySelectorAll('.tstep.done');if(all.length===dn.length){confetti(r.left+40,r.top,90);toast('🎉','Playbook complete','All troubleshooting steps done — re-run the journey to verify','ok')}}};

/* ---------------- record table helpers ---------------- */
const STB={Open:'bad',Suppressed:'info','Retried OK':'ok'};
function recTable(rs){return `<div class="rwrap" style="max-height:340px"><table class="rtbl"><thead><tr><th>Member ID</th><th>Name</th><th>Error</th><th>Time</th><th>Status</th></tr></thead><tbody>${rs.map((r,i)=>`<tr data-r="${r.id}" style="animation-delay:${i*15}ms"><td><span class="idc">${r.id}</span></td><td>${esc(r.name)}</td><td><span class="rchip" style="color:${errInfo(r.code).c};background:${errInfo(r.code).c}22">${errInfo(r.code).t}</span></td><td class="num">${r.ts}</td><td><span class="stbadge ${STB[r.st]}">${r.st}</span></td></tr>`).join('')}</tbody></table></div>`}
function bindRecRows(root){root.querySelectorAll('tr[data-r]').forEach(tr=>tr.onclick=()=>x_openRec(tr.dataset.r))}
window.x_openRec=function(id){const r=REC.find(x=>x.id===id);if(!r)return;const E=errInfo(r.code);const d=$('#drawer');d.classList.add('wide');
 const exp={E_NO_CONTACT:['Email present','Email = null'],E_VDEF_EXPIRED:['Voucher issued (Active definition)','Definition expired 14 Nov'],E_MEMBER_INACTIVE:['MemberStatus = Active','Merged into another member'],E_DPE_NO_JOURNAL:['Accrual journal exists','0 journals for member'],E_TIER_CHANGED:['Path for current tier','Path for tier at entry'],E_TIMEOUT:['API 200 in < 5 s','Read timed out after 120 s'],E_CONSENT:['Consent = true','HasOptedOutOfEmail = true'],
  ESCROW_STUCK:['Escrow released on release date','Escrow still held'],TIER_PENDING:['Tier Insider','Tier Regular (batch pending)'],TIER_DOWNGRADE:['Silver kept','Below Silver threshold'],RETURN_GT_SALE:['Return ≤ original sale','Return > sale'],ESCROW_AT_EXPIRY:['Escrow released before tier end','Escrow held at tier end']}[r.code]||['—','—'];
 const t0=r.tsn-120;const tt=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
 d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="color:var(--muted);font-size:12px">Records › ${r.bu}</div><h3 class="idc" style="font-size:20px">${r.id} <span class="copy" onclick="x_copy('${r.id}','${r.id}')">⧉</span></h3>
 <div style="color:var(--muted)">${esc(r.name)} · ${r.tier} · ${r.email}</div><span class="st ${STB[r.st]==='ok'?'ok':STB[r.st]==='info'?'warn':'bad'}">${r.st}</span></div><button class="iconbtn" onclick="closeAll()">✕</button></div>
 <div class="kv"><span>Journey / check</span><b>${esc(r.jn)}</b><span>Failed at step</span><b>${r.step}</b><span>Error code</span><b class="code">${r.code}</b><span>Error</span><b>${E.t}</b><span>Time</span><b>${r.ts} local</b><span>Retries</span><b>${r.retry}</b><span>Source</span><b>${r.src}</b></div>
 <div class="diff"><div class="e"><small>Expected</small>${exp[0]}</div><div class="a"><small>Actual</small>${exp[1]}</div></div>
 <h4 style="font-size:14px;margin-top:16px">Record history</h4><div class="rec-tl">
  <div class="ok">Member qualified for journey<small>${tt(t0)} · entry filter passed</small></div>
  <div>Entered ${esc(r.jn)}<small>${tt(t0+30)} · ${r.src==='Journey'?'entry source DE':'daily export'}</small></div>
  ${r.retry?`<div class="bad">Attempt failed · ${E.t}<small>${tt(r.tsn-20)}</small></div>`:''}
  <div class="bad">Failed at ${r.step} · ${r.code}<small>${r.ts}</small></div>
  ${r.st==='Retried OK'?`<div class="ok">Retried successfully<small>${tt(r.tsn+40)}</small></div>`:`<div>Flagged by Sam &amp; AT agent · notification sent<small>${tt(r.tsn+5)}</small></div>`}</div>
 <div class="rca"><h5>🧠 Why this record failed</h5><p>${E.rc}</p></div>
 <div class="ts"><h6>What to do with this record</h6>${(E.fix||[]).map((s,i)=>`<div class="tstep" onclick="x_tick(this)"><span class="n">${i+1}</span><span>${s}</span></div>`).join('')}</div>
 ${ERR[r.code]?`<pre class="q"><span class="cp" onclick="x_copy('${encodeURIComponent(`SELECT Id, MembershipNumber, MemberStatus, Contact.Email, CurrentTier.Name\nFROM LoyaltyProgramMember\nWHERE MembershipNumber = '${r.id}'`)}','SOQL')">⧉ copy</span>SELECT Id, MembershipNumber, MemberStatus, Contact.Email, CurrentTier.Name
FROM LoyaltyProgramMember
WHERE MembershipNumber = '${r.id}'</pre>`:''}
 <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn sm" onclick="x_follow('${r.id}')">☆ Add to watch list</button>${r.j!=='CHK'?`<button class="btn ghost sm" onclick="x_openJ('${r.j}')">Open journey</button>`:''}<button class="btn ghost sm" onclick="x_openInc('${r.code}')">Open incident</button></div>`;
 d.classList.add('on');$('#scrim').classList.add('on')};
window.x_follow=id=>{toast('☆','Added to watch list',id+' will repeat in every report until closed','ok')};

/* ---------------- Record explorer ---------------- */
const F={st:new Set(),code:new Set(),bu:new Set(),src:new Set()};let rq='',rsort={k:'ts',asc:false},rpage=0,rps=25,rview=[];
function facet(el,key,vals,lab){const cnt={};REC.forEach(r=>cnt[r[key]]=(cnt[r[key]]||0)+1);const mx=Math.max(...Object.values(cnt));
 $(el).innerHTML=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([v,n])=>`<div class="facet ${F[key].has(v)?'on':''}" data-k="${key}" data-v="${esc(v)}"><span style="flex:1;min-width:0"><span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lab?lab(v):esc(v)}</span><i style="width:${n/mx*100}%"></i></span><b class="num" style="margin-left:8px">${n}</b></div>`).join('');
 $(el).querySelectorAll('.facet').forEach(f=>f.onclick=()=>{const s=F[f.dataset.k];s.has(f.dataset.v)?s.delete(f.dataset.v):s.add(f.dataset.v);rpage=0;renderFacets();recDraw()})}
function renderFacets(){facet('#fSt','st');facet('#fCode','code',null,c=>errInfo(c).t);facet('#fBu','bu');facet('#fSrc','src')}
function renderRec(){renderFacets();$('#rq').oninput=e=>{rq=e.target.value.toLowerCase();rpage=0;recDraw()};$('#rps').onchange=e=>{rps=+e.target.value;rpage=0;recDraw()};
 $$('.rtbl th[data-k]').forEach(th=>th.onclick=()=>{rsort={k:th.dataset.k,asc:rsort.k===th.dataset.k?!rsort.asc:true};recDraw()});
 $('#rprev').onclick=()=>{rpage=Math.max(0,rpage-1);recDraw()};$('#rnext').onclick=()=>{rpage=Math.min(Math.ceil(rview.length/rps)-1,rpage+1);recDraw()};recDraw()}
function recDraw(){rview=REC.filter(r=>Object.entries(F).every(([k,s])=>!s.size||s.has(r[k]))&&(!rq||(r.id+r.name+r.jn+r.bu+errInfo(r.code).t).toLowerCase().includes(rq)));
 const k=rsort.k==='ts'?'tsn':rsort.k;rview.sort((a,b)=>(a[k]>b[k]?1:a[k]<b[k]?-1:0)*(rsort.asc?1:-1));
 $$('.rtbl th[data-k]').forEach(th=>{th.classList.toggle('sorted',th.dataset.k===rsort.k);th.classList.toggle('asc',th.dataset.k===rsort.k&&rsort.asc)});
 const pg=rview.slice(rpage*rps,rpage*rps+rps);
 $('#rbody').innerHTML=pg.map((r,i)=>`<tr data-r="${r.id}" style="animation-delay:${i*10}ms"><td><span class="idc">${r.id}</span></td><td>${esc(r.name)}</td><td>${r.bu}</td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">${esc(r.jn)}</td><td>${r.step}</td>
  <td><span class="rchip" style="color:${errInfo(r.code).c};background:${errInfo(r.code).c}22">${errInfo(r.code).t}</span></td><td>${r.tier}</td><td class="num">${r.ts}</td><td><span class="stbadge ${STB[r.st]}">${r.st}</span></td></tr>`).join('')||`<tr><td colspan="9"><div class="empty"><div class="ic">🦤</div>No records match these filters</div></td></tr>`;
 $('#rinfo').textContent=rview.length?`${rpage*rps+1}–${Math.min(rview.length,rpage*rps+rps)} of ${fmt(rview.length)} records`:'0 records';bindRecRows($('#rbody'))}
window.x_recFilter=(k,v)=>{Object.values(F).forEach(s=>s.clear());rq='';if(k==='j'){x_show('records');setTimeout(()=>{rq=J.find(j=>j.id===v).n.toLowerCase();$('#rq').value=J.find(j=>j.id===v).n;recDraw()},60);return}F[k].add(v);x_show('records');if(rendered.records){renderFacets();recDraw()}};
window.x_clearF=()=>{Object.values(F).forEach(s=>s.clear());rq='';$('#rq').value='';renderFacets();recDraw()};
const csvOf=rs=>['member_id,name,bu,journey,step,error_code,error,tier,time,status'].concat(rs.map(r=>[r.id,r.name,r.bu,r.jn,r.step,r.code,errInfo(r.code).t,r.tier,r.ts,r.st].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))).join('\n');
function dl(name,text){copy(text);try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch(e){}}
window.x_csv=()=>{dl('failed_records_2026-11-16.csv',csvOf(rview.length?rview:REC));toast('⬇','CSV exported + copied',fmt((rview.length?rview:REC).length)+' records · paste into Excel if the download is blocked','ok')};
window.x_copyIds=()=>{copy((rview.length?rview:REC).map(r=>r.id).join('\n'));toast('⧉','Copied member IDs',fmt((rview.length?rview:REC).length)+' IDs','ok')};
window.x_exportJ=()=>{dl('journey_report_2026-11-16.csv',['journey,bu,status,entered,failed,success_rate,top_error'].concat(J.map(j=>[j.n,j.bu,SC[j.st],j.in,j.fail,j.in?j.sr.toFixed(2):'',Object.keys(j.err)[0]?ERR[Object.keys(j.err)[0]].t:''].join(','))).join('\n'));toast('⬇','Journey report exported',J.length+' journeys','ok')};

/* ---------------- RCA view ---------------- */
function renderRca(){
 $('#incs').innerHTML=INC.map((i,k)=>{const E=ERR[i.code];return `<div class="inc glass" style="animation-delay:${k*50}ms" onclick="x_openInc('${i.code}')"><span class="sevb" style="background:${i.sev==='bad'?'var(--bad)':i.sev==='warn'?'var(--warn)':'var(--info)'}"></span>
  <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="stbadge ${i.sev}">${i.sev==='bad'?'SEV-1':i.sev==='warn'?'SEV-2':'INFO'} · ${E.cat}</span><span class="conf"><span class="t"><i style="width:${i.conf}%"></i></span>${i.conf}%</span></div>
  <h5>${E.t}</h5><p>${E.rc.split('. ')[0]}.</p>
  <div class="blast"><div><b class="num">${fmt(i.recs)}</b>records</div><div><b>${i.js.length}</b>journeys</div><div><b>${i.bus.length}</b>BUs</div><div><b>${i.first.slice(7)}</b>first seen</div></div>
  <div style="font-size:11px;color:var(--muted);margin-top:10px">Owner: <b style="color:var(--text)">${E.owner}</b> · <span style="color:var(--info);font-weight:600">Open playbook →</span></div></div>`}).join('');
 // timeline
 const W=1000,H=190,x=m=>40+(m-180)/(15*60-180)*(W-60);const ev=[{m:40+120,l:'DPE Create Accrual Journals · FAILED',c:'#0A84FF',lane:0},{m:161,l:'POS txn file landed 2h late',c:'#FF9F0A',lane:0},{m:300,l:'Duplicate merge job',c:'#BF5AF2',lane:0},{m:390,l:'MC stack S11 degraded',c:'#FFD60A',lane:0},{m:410,l:'Bot run: SAM set 06:30',c:'#30D158',lane:0},{m:240,l:'Consent sync 04:00',c:'#30D158',lane:0}];
 const tsl=REC.filter(r=>r.src==='Journey');const bins={};tsl.forEach(r=>{const b=Math.floor(r.tsn/10)*10;bins[b]=bins[b]||{};bins[b][r.code]=(bins[b][r.code]||0)+1});
 let svg=`<svg viewBox="0 0 ${W} ${H}"><line x1="40" x2="${W-20}" y1="60" y2="60" stroke="rgba(255,255,255,.15)"/><line x1="40" x2="${W-20}" y1="160" y2="160" stroke="rgba(255,255,255,.15)"/>
  <text class="lane" x="0" y="44">Events</text><text class="lane" x="0" y="150">Failures</text>`;
 for(let h=3;h<=15;h++)svg+=`<text class="lane" x="${x(h*60)}" y="${H-4}" text-anchor="middle">${String(h).padStart(2,'0')}:00</text><line x1="${x(h*60)}" x2="${x(h*60)}" y1="20" y2="162" stroke="rgba(255,255,255,.05)"/>`;
 ev.forEach((e,i)=>{const X=x(e.m);svg+=`<g><line x1="${X}" x2="${X}" y1="60" y2="160" stroke="${e.c}" stroke-dasharray="3 4" opacity=".55"/><circle cx="${X}" cy="60" r="7" fill="${e.c}"><title>${e.l}</title></circle><text x="${X+10}" y="${i%2?30:46}" font-size="10" fill="var(--text)">${e.l}</text></g>`});
 const bmx=Math.max(...Object.values(bins).map(o=>Object.values(o).reduce((a,b)=>a+b,0)));
 Object.entries(bins).forEach(([b,o])=>{let y=160;Object.entries(o).forEach(([c,v])=>{const h=v/bmx*80;y-=h;svg+=`<rect class="ev" x="${x(+b)}" y="${y}" width="${Math.max(3,x(+b+10)-x(+b)-1)}" height="${h}" fill="${ERR[c].c}" rx="1.5"><title>${String(Math.floor(b/60)).padStart(2,'0')}:${String(b%60).padStart(2,'0')} · ${ERR[c].t}: ${v}</title></rect>`})});
 $('#tl').innerHTML=svg+'</svg>';
 // blast radius
 $('#blast').innerHTML=INC.filter(i=>i.js.length).map(i=>`<div style="display:grid;grid-template-columns:170px 1fr;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,.07);align-items:center"><b style="font-size:12.5px;color:${ERR[i.code].c}">${ERR[i.code].t}</b>
  <div>${i.js.map(id=>{const j=J.find(x=>x.id===id);return `<span class="rchip" style="cursor:pointer;background:rgba(255,255,255,.08);color:var(--text)" onclick="x_openJ('${id}')">${SE[j.st]} ${esc(j.n)}</span>`}).join('')}<div style="font-size:11px;color:var(--muted);margin-top:3px">${i.bus.join(' · ')}</div></div></div>`).join('');
 renderRules();
}
const RULES=[{n:'Journey failure rate > 2%',d:'per journey, per run · notify bell + toast',on:true},{n:'Same journey failing 2 runs in a row',d:'escalates to SEV-1',on:true},{n:'Journey not run by SLA time',d:'entry DE empty or automation skipped',on:true},{n:'Voucher definition expires in < 30 days',d:'prevents E_VDEF_EXPIRED',on:true},{n:'API timeout rate > 2% in 15 min',d:'Marketing Cloud / integration',on:false},{n:'New error code never seen before',d:'unknown failure → manual RCA',on:true},{n:'Daily email digest at 09:00 IST',d:'needs MAIL_TO in config.env',on:false}];
function renderRules(){$('#rules').innerHTML=RULES.map((r,i)=>`<div class="rule"><div><b>${r.n}</b><small>${r.d}</small></div><span class="sw ${r.on?'on':''}" onclick="x_rule(${i},this)"></span></div>`).join('')}
window.x_rule=(i,el)=>{RULES[i].on=!RULES[i].on;el.classList.toggle('on');toast(RULES[i].on?'🔔':'🔕',RULES[i].on?'Alert rule on':'Alert rule off',RULES[i].n)};
window.x_openInc=function(code){const i=INC.find(x=>x.code===code);const E=errInfo(code);const d=$('#drawer');d.classList.add('wide');
 if(!ERR[code]){d.innerHTML=`<div style="display:flex;justify-content:space-between"><h3>${E.t}</h3><button class="iconbtn" onclick="closeAll()">✕</button></div><div class="rca"><p>${E.rc}</p></div><div class="ts">${E.fix.map((s,k)=>`<div class="tstep" onclick="x_tick(this)"><span class="n">${k+1}</span><span>${s}</span></div>`).join('')}</div>`;d.classList.add('on');$('#scrim').classList.add('on');return}
 const recs=REC.filter(r=>r.code===code);
 d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="color:var(--muted);font-size:12px">Root-cause center › ${E.cat}</div><h3>${E.t}</h3><div class="idc" style="color:var(--muted)">${code}</div>
 <span class="st ${i.sev==='info'?'warn':i.sev}">${i.sev==='bad'?'SEV-1':i.sev==='warn'?'SEV-2':'INFO'} · first seen ${i.first}</span></div><button class="iconbtn" onclick="closeAll()">✕</button></div>
 <div class="kgrid num"><div><b>${fmt(i.recs)}</b><span>Records</span></div><div><b>${i.js.length}</b><span>Journeys</span></div><div><b>${i.bus.length}</b><span>Business units</span></div><div><b>${i.conf}%</b><span>RCA confidence</span></div></div>
 ${rcaBlock(code,i.recs)}
 <h4 style="font-size:14px;margin-top:16px">Affected journeys</h4>${i.js.map(id=>{const j=J.find(x=>x.id===id);return `<div class="jrow" style="grid-template-columns:auto 1fr auto;padding:9px 10px" onclick="x_openJ('${id}')"><div class="jico ${j.st}" style="width:30px;height:30px">${SE[j.st]}</div><div class="nm"><b>${esc(j.n)}</b><small>${j.bu} · ${j.err[code]} records</small></div><span class="stbadge ${j.st}">${SC[j.st]}</span></div>`}).join('')}
 <div class="drec"><h4>Sample records <span><button class="btn ghost sm" onclick="x_recFilter('code','${code}')">All ${recs.length} in explorer →</button></span></h4>${recTable(recs.slice(0,10))}</div>`;
 d.classList.add('on');$('#scrim').classList.add('on');bindRecRows(d)};
window.x_copyRca=()=>{copy('Incident summary – 16 Nov 2026\n'+INC.map(i=>`• [${i.sev==='bad'?'SEV-1':i.sev==='warn'?'SEV-2':'INFO'}] ${ERR[i.code].t} – ${i.recs} records, ${i.js.length} journeys (${i.bus.join(', ')})\n  Root cause: ${ERR[i.code].rc}\n  Owner: ${ERR[i.code].owner}`).join('\n'));toast('⧉','Incident summary copied',INC.length+' incidents','ok')};

/* ---------------- Data ops ---------------- */
function renderOps(){
 const N=[{id:'prod',x:20,y:100,l:'SFLM Prod',s:'read-only',c:'#30D158'},{id:'bulk',x:200,y:40,l:'Bulk exports',s:'1.84M rows',c:'#30D158'},{id:'soql',x:200,y:160,l:'SOQL checks',s:'48 queries',c:'#30D158'},
  {id:'bu',x:400,y:20,l:'BU checks (8)',s:'SG HK TH TW MY JP KR TUMI',c:'#FFD60A'},{id:'shared',x:400,y:100,l:'Shared checks (10)',s:'escrow · dup · neg bal',c:'#30D158'},{id:'mc',x:400,y:180,l:'Journey monitor',s:'14 journeys',c:'#FF453A'},
  {id:'rca',x:600,y:180,l:'RCA engine',s:'7 causes',c:'#64D2FF'},{id:'rep',x:600,y:60,l:'Reports',s:'2 sets',c:'#30D158'},{id:'dash',x:800,y:60,l:'Dashboard',s:'this page',c:'#0A84FF'},{id:'alert',x:800,y:180,l:'Alerts',s:'bell · toast · email',c:'#BF5AF2'}];
 const E2=[['prod','bulk'],['prod','soql'],['bulk','bu'],['bulk','shared'],['soql','shared'],['soql','mc'],['mc','rca'],['bu','rep'],['shared','rep'],['rep','dash'],['rca','alert'],['rca','dash'],['mc','alert']];
 const P=id=>N.find(n=>n.id===id);let s='';E2.forEach(([a,b])=>{const A=P(a),B=P(b);const x1=A.x+160,y1=A.y+25,x2=B.x,y2=B.y+25;s+=`<path class="e" d="M${x1} ${y1} C ${x1+40} ${y1}, ${x2-40} ${y2}, ${x2} ${y2}" stroke="${B.c}" opacity=".6"/>`});
 N.forEach(n=>s+=`<g class="nd" style="cursor:pointer" onclick="toast('${n.c==='#FF453A'?'⛔':n.c==='#FFD60A'?'⚠️':'✅'}','${n.l}','${n.s}')"><rect x="${n.x}" y="${n.y}" width="160" height="50" rx="12" fill="rgba(255,255,255,.07)" stroke="${n.c}" stroke-width="1.5"/><circle cx="${n.x+16}" cy="${n.y+25}" r="5" fill="${n.c}"><animate attributeName="opacity" values="1;.3;1" dur="${n.c==='#FF453A'?'1s':'3s'}" repeatCount="indefinite"/></circle><text x="${n.x+30}" y="${n.y+22}">${n.l}</text><text class="s" x="${n.x+30}" y="${n.y+37}">${n.s}</text></g>`);
 $('#dag').innerHTML=s;
 const G=[['KR 5040',3.6,4.0,6],['TUMI SG/MY/AU',8.05,8.5,10.5],['TUMI JP',9.5,9.9,11],['SAM SG 5010',1.0,1.4,3],['SAM HK 5090',0.25,0.6,3],['SAM TH 5640',1.0,1.6,3],['SAM TW 5060',1.0,1.5,3],['SAM MY 5050',1.0,2.2,3],['VJ journals',1.2,5.7,4],['Journey monitor',1.1,1.3,2],['Analytics',2.4,2.7,4]];
 const gx=h=>h/12*100;
 $('#gantt').innerHTML=`<div class="gantt">${G.map(([n,a,b,sla],i)=>`<span>${n}</span><div class="gt"><i style="left:${gx(a)}%;width:${gx(b-a)}%;background:${b>sla?'linear-gradient(90deg,#FF9F0A,#FF453A)':'linear-gradient(90deg,#0A84FF,#64D2FF)'};animation-delay:${i*50}ms" title="${n}: ${a.toFixed(2)}–${b.toFixed(2)} UTC${b>sla?' · SLA BREACH':''}"></i><i class="sla" style="left:${gx(sla)}%"></i></div>`).join('')}<span></span><div class="gaxis">${[0,2,4,6,8,10,12].map(h=>`<span>${String(h).padStart(2,'0')}:00</span>`).join('')}</div></div>`;
 const FR=[['SG 5010',35,'ok'],['HK 5090',52,'ok'],['TH 5640',61,'ok'],['TW 5060',380,'warn'],['MY 5050',48,'ok'],['JP 5630',40,'ok'],['KR 5040',22,'ok'],['TUMI',95,'ok'],['VJ',1510,'bad'],['Journeys',18,'ok']];
 $('#fresh').innerHTML=FR.map(([b,m,s],i)=>`<div class="fr"><b>${b}</b><small>${m<60?m+' min':Math.floor(m/60)+'h '+m%60+'m'} ago</small><div class="bar2"><i style="width:${Math.min(100,m/1500*100)}%;background:${s==='ok'?'var(--ok)':s==='warn'?'var(--warn)':'var(--bad)'};animation-delay:${i*40}ms"></i></div></div>`).join('');
 // anomaly chart
 const A=Array.from({length:30},(_,i)=>i===29?4964:Math.round(1610+Math.sin(i/3)*120+(rnd()-.5)*260));const base=A.slice(0,29),mu=base.reduce((a,b)=>a+b,0)/29,sd=Math.sqrt(base.reduce((a,b)=>a+(b-mu)**2,0)/29);
 const W=600,H=200,mx=Math.max(...A)*1.08,X=i=>30+i*(W-40)/29,Y=v=>H-20-v/mx*(H-30);
 const line=A.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');
 $('#anom').innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:220px"><rect x="30" y="${Y(mu+2*sd)}" width="${W-40}" height="${Y(mu-2*sd)-Y(mu+2*sd)}" fill="rgba(100,210,255,.12)" rx="4"/>
  <line x1="30" x2="${W-10}" y1="${Y(mu)}" y2="${Y(mu)}" stroke="rgba(100,210,255,.5)" stroke-dasharray="4 4"/><text x="34" y="${Y(mu)-5}" font-size="10" fill="var(--muted)">mean ${fmt(Math.round(mu))}</text>
  <path d="${line}" fill="none" stroke="#64D2FF" stroke-width="2.2" style="stroke-dasharray:2000;stroke-dashoffset:2000;animation:draw 1.6s forwards"/>
  ${A.map((v,i)=>Math.abs(v-mu)>2*sd?`<circle cx="${X(i)}" cy="${Y(v)}" r="7" fill="#FF453A"><animate attributeName="r" values="6;10;6" dur="1.4s" repeatCount="indefinite"/><title>${fmt(v)} · z=${((v-mu)/sd).toFixed(1)}</title></circle><text x="${X(i)-8}" y="${Y(v)-12}" font-size="11" font-weight="700" fill="#ff7a72" text-anchor="end">${fmt(v)} · z=${((v-mu)/sd).toFixed(1)}</text>`:'').join('')}
  <text x="30" y="${H-4}" font-size="10" fill="var(--muted)">17 Oct</text><text x="${W-10}" y="${H-4}" font-size="10" fill="var(--muted)" text-anchor="end">16 Nov</text></svg>
  <div class="fix">🧠 <b>Likely cause:</b> TW 5060 voucher expiry batch processed 2 days of expiries in one run (14 + 15 Nov) after the 14 Nov batch was skipped. Expected to normalise tomorrow. <b>Check:</b> BatchJob history for "Voucher Expiry" on 14 Nov.</div>`;
 const OBJ=[['LoyaltyProgramMember',[99.1,99.8,99.97,100,99.4]],['Contact',[97.2,99.1,99.9,100,98.8]],['TransactionJournal',[99.9,99.6,100,96.2,99.7]],['Voucher',[100,99.9,100,99.8,97.1]],['LoyaltyMemberTier',[100,99.4,100,99.1,98.9]],['MemberEscrow',[98.6,99.2,100,99.9,95.4]],['ContactPointEmail',[88.3,97.5,99.2,100,99]]];
 const dqc=v=>v>=99?'rgba(48,209,88,.28)':v>=97?'rgba(255,214,10,.3)':'rgba(255,69,58,.35)';
 $('#dq').innerHTML=`<div class="dq"><span></span>${['Complete','Valid','Unique','Timely','Consist.'].map(h=>`<span class="h">${h}</span>`).join('')}${OBJ.map(([o,v])=>`<span style="font-family:ui-monospace,Menlo,monospace;font-size:11px">${o}</span>${v.map(x=>`<span class="c" style="background:${dqc(x)}" title="${o}: ${x}%">${x}</span>`).join('')}`).join('')}</div>
  <div class="fix">⚠ <b>ContactPointEmail completeness 88.3%</b> is the same root cause as the <a style="color:var(--info);cursor:pointer" onclick="x_openInc('E_NO_CONTACT')">Missing email incident</a> — 1 in 9 members cannot receive email journeys.</div>`;
}

/* ---------------- record-level detail in the existing BU drawer ---------------- */
const _od=window.openDrawer;
window.openDrawer=function(b){if(!b)return;$('#drawer').classList.remove('wide');_od(b);const d=$('#drawer');
 const recs=REC.filter(r=>r.bu===b.k||(b.k==='No-contact'&&r.code==='E_NO_CONTACT')||(b.k==='Stuck escrow'&&r.code==='ESCROW_STUCK')||(b.k==='Campaigns'&&r.src==='Journey')||(b.k==='Return amount'&&r.code==='RETURN_GT_SALE')||(b.k==='Escrow expiry'&&r.code==='ESCROW_AT_EXPIRY'));
 const js=J.filter(j=>j.bu===b.k);const box=document.createElement('div');box.className='drec';
 box.innerHTML=(js.length?`<h4>Journeys in ${b.k}</h4>${js.map(j=>`<div class="jrow" style="grid-template-columns:auto 1fr auto;padding:9px 10px" onclick="x_openJ('${j.id}')"><div class="jico ${j.st}" style="width:30px;height:30px">${SE[j.st]}</div><div class="nm"><b>${esc(j.n)}</b><small>${fmt(j.in)} entered · ${fmt(j.fail)} failed</small></div><span class="stbadge ${j.st}">${SC[j.st]}</span></div>`).join('')}`:'')
  +(recs.length?`<h4 style="margin-top:14px">Records needing action <small style="color:var(--muted);font-weight:500">${recs.length} · click a row for details</small></h4>${recTable(recs.slice(0,15))}<div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost sm" onclick="x_recFilter('bu','${b.k}')">Open all in record explorer →</button><button class="btn ghost sm" onclick="x_copy('${encodeURIComponent(recs.map(r=>r.id).join('\n'))}','${recs.length} IDs')">⧉ Copy IDs</button></div>`
  :`<div class="msg" style="border-color:rgba(48,209,88,.35);background:rgba(48,209,88,.10)"><b>✓ No records need action</b><p>Nothing flagged for ${b.k} in today's runs.</p></div>`);
 d.appendChild(box);bindRecRows(box)};

/* ---------------- live notifications: new failures arrive ---------------- */
NOTIFS.unshift({id:101,s:'bad',cat:'campaigns',t:'Root cause found: Voucher definition expired – 308 records in 2 SG journeys',p:'98% confidence · owner Loyalty admin · open playbook',g:'Today',ago:'5 min ago',u:true,x:()=>x_openInc('E_VDEF_EXPIRED')},
 {id:102,s:'bad',cat:'campaigns',t:'KR Tier upgrade congrats failing 4 runs in a row',p:'Tier changed during journey + DPE journal missing',g:'Today',ago:'20 min ago',u:true,x:()=>x_openJ('J4')},
 {id:103,s:'warn',cat:'runs',t:'Journey not run: MY Black renewal reminder',p:'Entry DE was empty – upstream export did not run',g:'Today',ago:'40 min ago',u:true,x:()=>x_openJ('J10')});
const _ofn=window.openFromN;window.openFromN=function(id){const n=NOTIFS.find(x=>x.id===id);if(n&&n.x){readN(id);togglePanel(false);n.x();return}_ofn(id)};
updateBell(true);
const LIVE=[['J3','E_TIMEOUT','MY Points expiry reminder: 12 new API timeouts'],['J1','E_NO_CONTACT','TH Black Birthday: 5 more members without email'],['J14','E_TIMEOUT','HK Lapsed win-back: timeout rate 2.4% (> 2% rule)'],['J6','E_MEMBER_INACTIVE','TW Reactivation: 3 merged members failed update']];
let li=0;function liveTick(){if(document.hidden)return;const [jid,code,msg]=LIVE[li++%LIVE.length];const nid=200+li;
 NOTIFS.unshift({id:nid,s:'bad',cat:'campaigns',t:'New failure: '+msg,p:ERR[code].t+' · likely cause: '+ERR[code].rc.split('. ')[0],g:'Today',ago:'just now',u:true,x:()=>x_openJ(jid)});
 updateBell(true);const b=$('#bellBtn');b.classList.remove('ring-anim');void b.offsetWidth;b.classList.add('ring-anim');
 toast('⛔','New journey failure',msg,'bad',()=>x_openJ(jid))}
setTimeout(()=>{liveTick();setInterval(liveTick,45000)},9000);

/* ---------------- palette entries ---------------- */
PITEMS.push({n:'Journeys & campaigns',s:'journey monitor',f:()=>x_show('journeys')},{n:'Root-cause center',s:'rca incidents',f:()=>x_show('rca')},{n:'Record explorer',s:'failed records',f:()=>x_show('records')},{n:'Data ops',s:'pipeline freshness quality',f:()=>x_show('ops')},
 ...J.map(j=>({n:j.n,s:'journey '+j.bu,f:()=>{x_show('journeys');setTimeout(()=>x_openJ(j.id),300)}})),...INC.map(i=>({n:ERR[i.code].t,s:'incident '+i.code,f:()=>x_openInc(i.code)})));
const _rp=window.renderP;window.renderP=function(){_rp();const q=$('#pin').value.trim().toUpperCase();if(q.length>=4){const hits=REC.filter(r=>r.id.includes(q)).slice(0,5);
 if(hits.length){const ul=$('#plist');hits.forEach(r=>{const li=document.createElement('li');li.innerHTML=`<span class="idc">${r.id}</span><small>${errInfo(r.code).t} · ${r.bu}</small>`;li.onclick=()=>{closeAll();x_openRec(r.id)};ul.appendChild(li)})}}};

/* ---------------- animals on cards ---------------- */
const BIRDS=[['owl','🦉'],['eagle','🦅'],['dodo','🦤'],['goose','🪿'],['flamingo','🦩'],['penguin','🐧'],['parrot','🦜']];
function addBirds(){let i=0;$$('.kpi, .x-kpi, .folder .f-front, .inc').forEach(c=>{if(c.querySelector(':scope>.bird'))return;i++;if(c.classList.contains('x-kpi')&&i%2)return;
 const b=BIRDS[(i*3)%BIRDS.length],e=document.createElement('span');e.className='bird '+b[0];e.setAttribute('aria-hidden','true');e.innerHTML='<span class=bf><span class=bi>'+b[1]+'</span></span>';e.style.animationDelay='-'+((i*2.7)%9).toFixed(1)+'s';c.appendChild(e)})}
addBirds();new MutationObserver(()=>{clearTimeout(window._bt);window._bt=setTimeout(addBirds,200)}).observe(document.getElementById('shelves'),{childList:true});
// birds toggle in appearance menu
const m=$('#menu');m.insertAdjacentHTML('beforeend','<h5>Animals</h5><div class="seg" id="birdSeg"><button class="on" data-v="on">On</button><button data-v="off">Off</button></div>');
$$('#birdSeg button').forEach(b=>b.onclick=()=>{$$('#birdSeg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');document.body.dataset.birds=b.dataset.v});

/* journeys widget on home */
const w=document.createElement('section');w.className='panel glass';const bad=J.filter(j=>j.st==='bad'||j.st==='warn'||j.st==='none').sort((a,b)=>b.fail-a.fail).slice(0,5);
w.innerHTML=`<h4>🧭 Journey health <small><a style="color:var(--info);cursor:pointer;font-weight:600" onclick="x_show('journeys')">Open journey monitor →</a></small></h4>
 <div class="x-kpis" style="margin-bottom:10px">${kpiH('Failing',failing,'journeys','bad')}${kpiH('Failed records',totF,'today','bad')}${kpiH('Root causes',INC.length,'grouped')}${kpiH('Success',(100-totF/totIn*100).toFixed(1)+'%','all journeys','warn')}</div>
 ${bad.map((j,i)=>`<div class="jrow" style="grid-template-columns:auto 1.4fr 1fr auto;padding:10px 12px;animation-delay:${i*35}ms" onclick="x_openJ('${j.id}')"><div class="jico ${j.st}" style="width:32px;height:32px">${SE[j.st]}</div><div class="nm"><b>${esc(j.n)}</b><small>${j.bu} · ${j.fail?fmt(j.fail)+' failed':'not run'}</small></div><div>${Object.keys(j.err).slice(0,1).map(c=>`<span class="rchip" style="color:${ERR[c].c};background:${ERR[c].c}22">${ERR[c].t}</span>`).join('')||`<span class="rchip w">Not run</span>`}</div><span class="stbadge ${j.st}">${SC[j.st]}</span></div>`).join('')}`;
const cw=$('#campWidget');cw.parentNode.insertBefore(w,cw);countAll(w);

/* bottom nav + keyboard */
const bn=document.querySelector('.bottomnav');bn.children[1].setAttribute('onclick',"x_show('journeys')");bn.children[1].lastChild.textContent='Journeys';
addEventListener('keydown',e=>{if(/input|textarea|select/i.test(e.target.tagName))return;if(window._g){if(e.key==='j')x_show('journeys');if(e.key==='r')x_show('rca');if(e.key==='e')x_show('records');if(e.key==='o')x_show('ops')}});
document.querySelector('.footer-note').innerHTML='Demo data shaped like the real bot outputs · Read-only on Prod · <span class="kbd">⌘K</span> search (try a member ID) · <span class="kbd">n</span> notifications · <span class="kbd">g</span> then <span class="kbd">j</span>/<span class="kbd">r</span>/<span class="kbd">e</span>/<span class="kbd">o</span> jump · <span class="kbd">Esc</span> close';
window.X={J,ERR,REC,INC,errInfo,VIEWS,NAVN,CR,RENDER,rendered,kpiH,esc,fmt,recTable,bindRecRows,SE,SC,mk,countAll,addBirds,dl,copy};
setTimeout(()=>{const h=location.hash.slice(1);if(VIEWS[h])x_show(h)},0);
})();
