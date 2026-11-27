// Backup restore ("טעינת גיבוי") fixture test. FIXTURE DATA ONLY.
// Usage: (server on :8765)  NODE_PATH=$(npm root -g) node qa/tests/backup-restore-fixture.cjs
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');
const BASE=process.env.BASE||'http://localhost:8765/';
const KEY='stage1-family.v1';
const T=Date.UTC(2026,10,20,9,0,0);
// the backup file being restored (one fixture child with one finished practice)
const BACKUP={v:1,current:'fx-b1',profiles:[{id:'fx-b1',name:'FIXTURE-BACKUP-KID',g:'f',avatar:'🦉',created:T}],
  kids:{'fx-b1':{att:{'g-calc-001':{n:1,ok:1,first:true,lastOk:true,last:T}},active:null,
    sessions:[{id:'fx-s1',mode:'practice',timed:false,title:'fixture',started:T,ended:T+60000,limitSec:null,qids:['g-calc-001'],items:[{id:'g-calc-001',given:'67',ok:true,firstOk:true,ms:4000}],score:1,total:1,partial:false}]}}};
// data already on the device in scenario (b): two fixture children with progress, plus the sets-page stars
const EXISTING={v:1,current:'__new',profiles:[
  {id:'fx-e1',name:'FIXTURE-EXISTING-1',g:'m',avatar:'🦊',created:T},{id:'fx-e2',name:'FIXTURE-EXISTING-2',g:'f',avatar:'🐼',created:T}],
  kids:{'fx-e1':{att:{'g-calc-002':{n:2,ok:1,first:false,lastOk:true,last:T}},active:null,
    sessions:[{id:'fx-s2',mode:'test',timed:true,plan:'short',title:'fixture test',started:T,ended:T+600000,limitSec:900,qids:['g-calc-002'],items:[{id:'g-calc-002',given:'88',ok:true,firstOk:true,ms:9000}],score:1,total:12,partial:false}]},
    'fx-e2':{att:{},sessions:[],active:null}}};
const STARS={r1:true,m1:false};
const file=path.join(os.tmpdir(),'fixture-backup.json');fs.writeFileSync(file,JSON.stringify(BACKUP));
const summarize=(raw)=>{if(raw==null)return 'null';const d=JSON.parse(raw);return `profiles=[${(d.profiles||[]).map(p=>p.id+':'+p.name).join(', ')}] kids=[${Object.keys(d.kids||{}).join(', ')}] current=${d.current} sessions=${Object.values(d.kids||{}).reduce((a,k)=>a+(k.sessions||[]).length,0)}`};
const dump=async(p,label)=>{const all=await p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
  console.log(`  ${label} localStorage keys: ${Object.keys(all).join(', ')||'(none)'}`);
  for(const [k,v] of Object.entries(all))console.log(`    ${k} = ${k===KEY?summarize(v):v.length>80?v.slice(0,80)+'…':v}`);return all};
(async()=>{const b=await chromium.launch();
console.log('BACKUP FILE (fixture): '+summarize(JSON.stringify(BACKUP)));
// (a) no profile on the device
{console.log('\n(a) NO-PROFILE STATE: restore the fixture backup');
 const ctx=await b.newContext({viewport:{width:375,height:667},serviceWorkers:'block'});const p=await ctx.newPage();
 await p.goto(BASE+'#/parent');await p.waitForSelector('.t2-parent');
 const before=await dump(p,'before');
 console.log(`  branch rendered: ${await p.locator('.t2-kidhead').count()?'full report':'no-profile (restore card)'}; restore card heading: "${await p.locator('.t2-tools h3').innerText()}"`);
 await p.locator('.t2-tools input[type=file]').setInputFiles(file);await p.waitForSelector('.t2-kidhead');
 console.log(`  status message: "${await p.locator('.t2-tools [role=status]').innerText().catch(()=>'')}"  confirm prompt shown: ${await p.locator('[role=alertdialog],.t2-confirm').count()>0}`);
 const after=await dump(p,'after');
 const d=JSON.parse(after[KEY]);console.log(`  result: restored profile = ${d.profiles.map(x=>x.name).join(', ')}; report shows answers=${(await p.locator('.t2-kpi b').first().innerText())}`);
 await ctx.close();}
// (b) profiles exist, current = "__new"
{console.log('\n(b) PROFILES EXIST, current="__new": restore the fixture backup');
 const ctx=await b.newContext({viewport:{width:375,height:667},serviceWorkers:'block'});
 await ctx.addInitScript(([k,e,s])=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem(k,e);localStorage.setItem('ilai-stars.v1',s);sessionStorage.setItem('seeded','1')}},[KEY,JSON.stringify(EXISTING),JSON.stringify(STARS)]);
 const p=await ctx.newPage();await p.goto(BASE+'#/parent');await p.waitForSelector('.t2-parent');
 const before=await dump(p,'before');
 const full=await p.locator('.t2-kidhead').count()>0;
 console.log(`  branch rendered: ${full?'FULL REPORT (kid = profiles[0], the no-profile branch does NOT show)':'no-profile branch'}; shown child: ${full?await p.locator('.t2-kidhead b').innerText():'-'}`);
 console.log(`  restore button in this branch: ${await p.locator('.t2-tools .t2-btn',{hasText:'טעינת גיבוי'}).count()} (same importData handler)`);
 await p.locator('.t2-tools input[type=file]').setInputFiles(file);await p.waitForTimeout(500);
 console.log(`  status message: "${await p.locator('.t2-tools [role=status]').innerText().catch(()=>'')}"  confirm prompt shown: ${await p.locator('[role=alertdialog],.t2-confirm').count()>0}`);
 const after=await dump(p,'after');
 const bd=JSON.parse(before[KEY]),ad=JSON.parse(after[KEY]);
 const lostP=bd.profiles.filter(x=>!ad.profiles.some(y=>y.id===x.id)).map(x=>x.name);const lostK=Object.keys(bd.kids).filter(k=>!(k in ad.kids));
 console.log(`  profiles lost: ${lostP.join(', ')||'none'}; kids data lost: ${lostK.join(', ')||'none'}; sessions before=${Object.values(bd.kids).reduce((a,k)=>a+k.sessions.length,0)} after=${Object.values(ad.kids).reduce((a,k)=>a+k.sessions.length,0)}`);
 console.log(`  other keys untouched: ilai-stars.v1 ${before['ilai-stars.v1']===after['ilai-stars.v1']?'unchanged':'CHANGED'}`);
 console.log(`  VERDICT: ${lostP.length?'existing profiles/kids were REPLACED without confirmation':'existing data kept'}`);
 await ctx.close();}
await b.close()})();
