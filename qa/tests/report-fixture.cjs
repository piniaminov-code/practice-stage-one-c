// Deterministic report fixture. Drives the real UI, prints seeded answers,
// expected report counts and what the report screen actually shows.
// Usage: BASE_URL=http://localhost:8772/ HEAD_URL=http://localhost:8765/ NODE_PATH=$(npm root -g) node qa/tests/report-fixture.cjs
// Fixture: 1 child, practice "חשבון" (all levels, 10 questions), Math.random seeded (12345) so both
// builds pick the same questions. Answer 6 questions in a fixed pattern, leave with ✕, then
// "לְהַתְחִיל מֵחָדָשׁ" (start over) on the resume card, then open the parent report.
const {chromium}=require('playwright');
const PATTERN=['R','W-R','R','W-W','R','R']; // R = right first try; W-R = wrong then right; W-W = wrong twice
const runs=[['BASE main',process.env.BASE_URL,process.env.BASE_REV||''],['HEAD',process.env.HEAD_URL,process.env.HEAD_REV||'']];
(async()=>{const b=await chromium.launch();const lines=[];const log=(s)=>{lines.push(s);console.log(s)};
const firstOk=PATTERN.filter(x=>x==='R').length;
log('FIXTURE');
log(`  pattern (${PATTERN.length} answers): ${PATTERN.join(', ')}`);
log(`  expected report: answers=${PATTERN.length}, practice days=1, first-try %=${Math.round(firstOk/PATTERN.length*100)}% (${firstOk}/${PATTERN.length}), tests=0`);
log('  (start over must not drop the answers already given)');
for(const [name,url,rev] of runs){
 const ctx=await b.newContext({viewport:{width:375,height:667},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await ctx.addInitScript(()=>{let a=12345;Math.random=()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(url+'#/train');await p.waitForSelector('.t2-setup-kid');await p.fill('.t2-field input','fixture');await p.locator('.t2-btn.primary.big').click();
 await p.locator('.t2-type.calc').click();await p.getByRole('button',{name:'10',exact:true}).click();await p.locator('.t2-btn.primary.big').click();await p.waitForSelector('.kp');
 const type=async(n)=>{for(const d of String(n))await p.locator(`.kp-k[aria-label="${d}"]`).click();await p.locator('.kp-ok').click()};
 log(`\n== ${name} ${rev} (${url})`);log('  seeded answers:');
 for(let i=0;i<PATTERN.length;i++){
  const q=(await p.locator('.t2-qtext').innerText()).replace(/[⁦-⁩]/g,'').trim();
  const key=await p.evaluate(async(q)=>{const m=await import('./bank.js');const it=m.BANK.find(x=>x.q===q);return it?it.answer:null},q);
  const plan=PATTERN[i];const given=[];
  if(plan==='R'){await type(key);given.push(key)}
  else if(plan==='W-R'){await type(key+1);await type(key);given.push(key+1,key)}
  else {await type(key+1);await type(key+2);given.push(key+1,key+2)}
  const shown=await p.locator('.fb strong').innerText();
  log(`   ${i+1}. ${q.padEnd(16)} key=${String(key).padEnd(3)} plan=${plan.padEnd(4)} typed=${given.join('→').padEnd(8)} feedback="${shown}"`);
  await p.locator('.t2-nav .t2-btn.primary').click();
 }
 await p.locator('.t2-x').click();await p.waitForSelector('.t2-resume');
 await p.locator('.t2-resume .t2-btn.ghost').click(); // start over
 await p.locator('.t2-tab').nth(3).click();await p.waitForSelector('.t2-parent');await p.waitForTimeout(200);
 const k=await p.locator('.t2-kpi').allInnerTexts();const v=k.map(x=>x.split('\n')[0]);
 const actual={answers:v[0],firstTry:v[1],days:v[2],tests:v[3]};
 log(`  actual report: answers=${actual.answers}, practice days=${actual.days}, first-try %=${actual.firstTry}, tests=${actual.tests}`);
 const pass=actual.answers===String(PATTERN.length)&&actual.days==='1'&&actual.firstTry===Math.round(firstOk/PATTERN.length*100)+'%'&&actual.tests==='0';
 log(`  matches expected: ${pass?'YES':'NO'}${errs.length?'  page errors: '+errs.join('; '):''}`);
 await ctx.close();}
await b.close()})();
