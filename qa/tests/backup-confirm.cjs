// Confirm-before-overwrite for "טעינת גיבוי" (parent area). FIXTURE DATA ONLY. Exit 1 on failure.
// Usage: (server on :8765)  NODE_PATH=$(npm root -g) node qa/tests/backup-confirm.cjs
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const assert=require('assert');
const BASE=process.env.BASE||'http://localhost:8765/';const KEY='stage1-family.v1';const T=Date.UTC(2026,10,20,9,0,0);
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const deepEq=(a,b)=>{try{assert.deepStrictEqual(a,b);return true}catch{return false}};
const BACKUP={v:1,current:'fx-b1',profiles:[{id:'fx-b1',name:'יוֹנָתָן FIXTURE-A',g:'m',avatar:'🦁',created:T},{id:'fx-b2',name:'דָּנָה-FIXTURE-C',g:'f',avatar:'🦉',created:T}],
  kids:{'fx-b1':{att:{'g-calc-001':{n:1,ok:1,first:true,lastOk:true,last:T}},active:null,
    sessions:[{id:'fx-s1',mode:'practice',timed:false,title:'fixture',started:T,ended:T+60000,limitSec:null,qids:['g-calc-001'],items:[{id:'g-calc-001',given:'67',ok:true,firstOk:true,ms:4000}],score:1,total:1,partial:false}]}}};
// existing device data, stored as NON-canonical JSON so any re-save would change the bytes
const EXISTING_RAW=JSON.stringify({v:1,current:'__new',profiles:[
  {id:'fx-e1',name:'שִׁירָה',g:'f',avatar:'🦊',created:T},{id:'fx-e2',name:'FIXTURE-B',g:'m',avatar:'🐸',created:T},
  {id:'fx-e3',name:'נוֹעָה',g:'f',avatar:'🐼',created:T},{id:'fx-e4',name:'נוֹעָה',g:'f',avatar:'🐼',created:T}],
  kids:{'fx-e1':{att:{'g-calc-002':{n:2,ok:1,first:false,lastOk:true,last:T}},active:null,sessions:[]},'fx-e2':{att:{},sessions:[],active:null},
    'fx-e3':{att:{},sessions:[],active:null},'fx-e4':{att:{},sessions:[],active:null}}},null,2);
const OTHER={'ilai-stars.v1':'{"r1":true,  "m1":false}','ilai-answers.v1':'{ "r1":"1" }','ilai-sound.v1':'off'};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bk-'));const file=path.join(dir,'fixture-backup.json');fs.writeFileSync(file,JSON.stringify(BACKUP));
const bad=path.join(dir,'not-a-backup.json');fs.writeFileSync(bad,'{"hello":1}');
const raw=(p)=>p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
const sameBytes=(a,b)=>JSON.stringify(Object.entries(a))===JSON.stringify(Object.entries(b));
async function device(seed){const ctx=await b.newContext({viewport:{width:375,height:667},serviceWorkers:'block',acceptDownloads:true});
  if(seed)await ctx.addInitScript(([k,v,o])=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem(k,v);for(const [a,c] of Object.entries(o))localStorage.setItem(a,c);sessionStorage.setItem('seeded','1')}},[KEY,EXISTING_RAW,OTHER]);
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(BASE+'#/parent');await p.waitForSelector('.t2-parent');return {ctx,p,errs}}
let b;
(async()=>{b=await chromium.launch();
// 1. no profile: restore unchanged (no prompt, data loaded as is)
{console.log('\n1. no profile on the device');const {ctx,p,errs}=await device(false);
 const before=await raw(p);console.log('   before keys:',Object.keys(before).join(', ')||'(none)');
 await p.locator('.t2-tools input[type=file]').setInputFiles(file);await p.waitForSelector('.t2-kidhead');
 ok(await p.locator('[role=alertdialog]').count()===0,'no confirmation prompt when nothing would be lost');
 const after=await raw(p);console.log('   after keys:',Object.keys(after).join(', '));
 const stored=JSON.parse(after[KEY]);ok(deepEq(stored,{v:1,profiles:BACKUP.profiles,current:BACKUP.current,kids:BACKUP.kids}),'stored data equals the backup file (format unchanged)');
 ok(after[KEY]===JSON.stringify({v:1,profiles:BACKUP.profiles,current:BACKUP.current,kids:BACKUP.kids}),'stored bytes are the same as before this change ({...empty(), ...backup})');
 ok(errs.length===0,'no page errors');await ctx.close();}
// 2. profiles exist: ask first; cancel leaves ALL localStorage byte-identical; replace loads the backup
{console.log('\n2. device already has profiles (current="__new")');const {ctx,p,errs}=await device(true);
 const before=await raw(p);console.log('   before keys:',Object.keys(before).join(', '));
 ok(before[KEY]===EXISTING_RAW,'seeded fixture is stored as non-canonical JSON (byte check is meaningful)');
 await p.locator('.t2-tools input[type=file]').setInputFiles(file);await p.waitForSelector('[role=alertdialog]');
 const txt=(await p.locator('[role=alertdialog]').innerText()).replace(/\n+/g,' | ');console.log('   prompt:',txt);
 // (1) bidi isolation + separate lines
 const L=await p.evaluate(()=>{const lines=[...document.querySelectorAll('[role=alertdialog] .t2-rep-line')];
   return lines.map(l=>{const r=l.getBoundingClientRect();return {text:l.innerText,top:r.top,bottom:r.bottom,
     names:[...l.querySelectorAll('.t2-nm')].map(n=>{const b=n.querySelector('bdi');return {label:n.innerText,bdi:!!b,dirAttr:b&&b.getAttribute('dir'),name:b&&b.textContent,dir:b&&getComputedStyle(b).direction,unicodeBidi:b&&getComputedStyle(b).unicodeBidi,boxes:new Set([...n.getClientRects()].map(r=>Math.round(r.top+r.height/2))).size}})}})});
 for(const l of L){console.log('   line:',l.text);for(const n of l.names)console.log(`     name "${n.name}" label "${n.label}" <bdi dir=${n.dirAttr}> resolved=${n.dir} unicode-bidi=${n.unicodeBidi} lines=${n.boxes}`)}
 ok(L.length===2&&L[0].text.startsWith('יימחקו:')&&L[1].text.startsWith('ייטענו מהגיבוי:'),'"removed" and "loaded" are two separate lines');
 ok(L.length===2&&L[1].top>=L[0].bottom-1,'the "loaded" line is below the "removed" line');
 const all=L.flatMap(l=>l.names);
 ok(all.length===6&&all.every(n=>n.bdi&&n.dirAttr==='auto'&&n.unicodeBidi==='isolate'),'every name is in <bdi dir="auto"> (unicode-bidi: isolate)');
 ok(all.length>0&&all.every(n=>n.boxes===1),'no name is split across lines');
 const dirOf=(nm)=>(all.find(n=>n.name===nm)||{}).dir;
 ok(dirOf('FIXTURE-B')==='ltr','Latin name "FIXTURE-B" resolves left-to-right inside its isolate');
 ok(dirOf('שִׁירָה')==='rtl'&&dirOf('יוֹנָתָן FIXTURE-A')==='rtl'&&dirOf('דָּנָה-FIXTURE-C')==='rtl','Hebrew and Hebrew+Latin names resolve right-to-left');
 ok(all.filter(n=>n.name==='נוֹעָה').map(n=>n.label).join('|')==='🐼 נוֹעָה (1)|🐼 נוֹעָה (2)','two profiles named "נוֹעָה" are shown as (1) and (2)');
 ok(!!L[0]&&new Set(L[0].names.map(n=>n.label)).size===L[0].names.length,'every entry in the "removed" list is distinguishable');
 ok(all.length>0&&all.filter(n=>n.name!=='נוֹעָה').every(n=>!/\(\d\)$/.test(n.label)),'names that appear once get no number');
 ok(!!L[0]&&!!L[1]&&['שִׁירָה','FIXTURE-B','נוֹעָה'].every(x=>L[0].names.some(n=>n.name===x))&&['יוֹנָתָן FIXTURE-A','דָּנָה-FIXTURE-C'].every(x=>L[1].names.some(n=>n.name===x)),'prompt names who is removed and who is loaded');
 // (3) focus, Tab order
 const act=()=>p.evaluate(()=>{const e=document.activeElement;return (e.innerText||e.getAttribute('aria-label')||e.tagName).trim()});
 ok((await act())==='ביטול','initial focus is on ביטול');
 await p.keyboard.press('Shift+Tab');const back=await act();await p.keyboard.press('Tab');const fwd=await act();await p.keyboard.press('Tab');const out=await act();
 console.log(`   Tab order: start ביטול → Shift+Tab "${back}" → Tab "${fwd}" → Tab "${out}"`);
 ok(back==='להחליף'&&fwd==='ביטול','Tab order inside the box: להחליף ⇄ ביטול');
 ok(out==='איפוס ההתקדמות','Tab from ביטול moves on to the next control (איפוס ההתקדמות)');
 ok(sameBytes(await raw(p),before),'moving focus with Tab writes nothing');
 const btns=await p.locator('[role=alertdialog] button').allInnerTexts();ok(deepEq(btns,['להחליף','ביטול']),'buttons are exactly: להחליף / ביטול ('+btns.join(' / ')+')');
 ok(sameBytes(await raw(p),before),'while the prompt is open, all localStorage is byte-identical');
 await p.locator('[role=alertdialog] button',{hasText:'ביטול'}).click();
 const afterCancel=await raw(p);
 ok(sameBytes(afterCancel,before),'after ביטול, ALL localStorage keys are byte-identical (raw string compare)');
 for(const k of Object.keys(before))if(before[k]!==afterCancel[k])console.log('   DIFF',k);
 ok(await p.locator('[role=alertdialog]').count()===0,'prompt closed after ביטול');
 console.log('   message:',await p.locator('.t2-tools [role=status]').innerText());
 ok((await p.locator('.t2-kidhead b').innerText())==='שִׁירָה','report still shows the existing child');
 ok((await act())==='⬆️ טעינת גיבוי','after ביטול, focus returns to "טעינת גיבוי"');
 // Escape = cancel, from each place focus can be
 for(const where of ['ביטול','להחליף','page']){
   await p.locator('.t2-tools input[type=file]').setInputFiles(file);await p.waitForSelector('[role=alertdialog]');
   if(where==='להחליף')await p.locator('[role=alertdialog] button',{hasText:'להחליף'}).focus();
   if(where==='page')await p.evaluate(()=>document.activeElement.blur());
   await p.keyboard.press('Escape');await p.waitForTimeout(150);
   ok(await p.locator('[role=alertdialog]').count()===0,`Escape (focus on ${where}) closes the box`);
   ok(sameBytes(await raw(p),before),`Escape (focus on ${where}): ALL localStorage byte-identical`);
   ok((await act())==='⬆️ טעינת גיבוי',`Escape (focus on ${where}): focus returns to "טעינת גיבוי"`);
 }
 // same file again → replace
 await p.locator('.t2-tools input[type=file]').setInputFiles(file);await p.waitForSelector('[role=alertdialog]');
 await p.locator('[role=alertdialog] button',{hasText:'להחליף'}).click();await p.waitForTimeout(300);
 const afterReplace=await raw(p);const st=JSON.parse(afterReplace[KEY]);
 ok(deepEq(st,{v:1,profiles:BACKUP.profiles,current:BACKUP.current,kids:BACKUP.kids}),'after להחליף, stored data equals the backup');
 ok(Object.keys(OTHER).every(k=>afterReplace[k]===before[k]),'after להחליף, other keys (sets-page stars/answers/sound) byte-identical');
 console.log('   message:',await p.locator('.t2-tools [role=status]').innerText());
 ok(errs.length===0,'no page errors');await ctx.close();}
// 3. not a backup file: error message, nothing changes, no prompt
{console.log('\n3. invalid file on a device with profiles');const {ctx,p}=await device(true);const before=await raw(p);
 await p.locator('.t2-tools input[type=file]').setInputFiles(bad);await p.waitForTimeout(400);
 ok(await p.locator('[role=alertdialog]').count()===0,'no prompt for an invalid file');ok(sameBytes(await raw(p),before),'storage byte-identical after an invalid file');
 console.log('   message:',await p.locator('.t2-tools [role=status]').innerText());await ctx.close();}
// 4. compatibility: a backup saved by this build restores to the same data on a fresh device
{console.log('\n4. round trip: save backup → restore on a fresh device');const {ctx,p}=await device(true);
 const [dl]=await Promise.all([p.waitForEvent('download'),p.locator('.t2-tools .t2-btn',{hasText:'שמירת גיבוי'}).click()]);const out=path.join(dir,'roundtrip.json');await dl.saveAs(out);
 const saved=JSON.parse(fs.readFileSync(out,'utf8'));await ctx.close();
 const f2=await device(false);await f2.p.locator('.t2-tools input[type=file]').setInputFiles(out);await f2.p.waitForSelector('.t2-kidhead');
 ok(await f2.p.locator('[role=alertdialog]').count()===0,'fresh device: no prompt');
 ok(deepEq(JSON.parse((await raw(f2.p))[KEY]),saved),'restored data deep-equals the saved backup');await f2.ctx.close();}
console.log(fails?`\n${fails} FAILED`:'\nALL PASSED');await b.close();process.exit(fails?1:0)})();
