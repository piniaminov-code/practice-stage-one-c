// Flow + regression tests with assertions. Exit code 1 on any failure.
// Usage: (server on :8765)  NODE_PATH=$(npm root -g) node qa/tests/flows.cjs
const {chromium,devices}=require('playwright');
const BASE=process.env.BASE||'http://localhost:8765/';
let fails=0;const ok=(cond,msg)=>{console.log((cond?'PASS ':'FAIL ')+msg);if(!cond)fails++};
const SE={viewport:{width:375,height:667},deviceScaleFactor:1,isMobile:true,hasTouch:true};
(async()=>{const b=await chromium.launch();
const errsOf=(p)=>{const e=[];p.on('console',m=>{if(m.type()==='error'&&!/Service Worker registration blocked|ERR_INTERNET_DISCONNECTED/.test(m.text()))e.push(m.text())});p.on('pageerror',x=>e.push(x.message));return e};

// 1. sets page: "next set" and "10 more" land the target below the sticky score bar (fix: scroll-padding + margin = 180px)
{const ctx=await b.newContext({...SE,serviceWorkers:'block'});const p=await ctx.newPage();const errs=errsOf(p);
 await p.goto(BASE);await p.waitForSelector('.hud');
 await p.locator('.setend').scrollIntoViewIfNeeded();await p.locator('.setend .next').click();await p.waitForTimeout(1500);
 const t=await p.evaluate(()=>({tabs:document.querySelector('.tabs').getBoundingClientRect().top,hud:document.querySelector('.hud').getBoundingClientRect().bottom}));
 ok(t.tabs>=t.hud,`next set: set tabs (${Math.round(t.tabs)}px) below score bar (${Math.round(t.hud)}px)`);
 await p.locator('.tabs.topics .tab').first().click();const more=p.locator('.sec .again.big').first();await more.scrollIntoViewIfNeeded();await more.click();await p.waitForTimeout(400);
 const top=await p.evaluate(()=>document.querySelector('.sec').getBoundingClientRect().top);ok(top>=110&&top<=200,`10 more: new questions start at ${Math.round(top)}px`);
 // keyboard focus never lands under the fixed tab bar / sticky score bar
 const hidden=await p.evaluate(async()=>{let n=0;for(const e of document.querySelectorAll('#root button:not([disabled]),#root input:not([disabled])')){if(!e.offsetParent)continue;e.focus();await new Promise(r=>requestAnimationFrame(r));const r=e.getBoundingClientRect();const t=document.elementFromPoint(r.left+r.width/2,Math.min(innerHeight-1,Math.max(0,r.top+r.height/2)));if(t&&t!==e&&!e.contains(t)&&!t.contains(e))n++}return n});
 ok(hidden===0,`sets: focused controls hidden under bars = ${hidden}`);
 const small=await p.evaluate(()=>[...document.querySelectorAll('button.again')].filter(e=>e.offsetParent&&e.getBoundingClientRect().width<44).length);ok(small===0,'sets: every .again button is at least 44px wide');
 ok(errs.length===0,'sets: no console errors '+JSON.stringify(errs));await ctx.close();}

// 2. tier 2: tap targets, test map one row + current dot visible, practice focus not hidden
{const ctx=await b.newContext({...SE,serviceWorkers:'block'});const p=await ctx.newPage();const errs=errsOf(p);
 await p.goto(BASE+'#/train');await p.waitForSelector('.t2-setup-kid');await p.fill('.t2-field input','ק');await p.locator('.t2-btn.primary.big').click();await p.waitForSelector('.t2-types');
 const link=await p.locator('.t2-pbar .t2-link').boundingBox();ok(link.height>=44,`"+ ילד/ה" link height ${link.height}`);
 await p.locator('.t2-tab').nth(2).click();await p.getByRole('button',{name:/מָלֵא/}).click();await p.locator('.t2-btn.primary.big').click();await p.waitForSelector('.t2-map');
 const m=await p.evaluate(()=>{const map=document.querySelector('.t2-map');const d=[...map.children].map(x=>x.getBoundingClientRect());return {rows:new Set(d.map(r=>Math.round(r.top))).size,w:Math.min(...d.map(r=>r.width)),h:Math.min(...d.map(r=>r.height)),pageW:document.documentElement.scrollWidth,vw:innerWidth,x:document.querySelector('.t2-x').getBoundingClientRect().width}});
 ok(m.rows===1,`test map: ${m.rows} row(s) for 24 questions`);ok(m.w>=44&&m.h>=44,`test map dots ${m.w}x${m.h}`);ok(m.pageW<=m.vw,'test map: no page-wide sideways scroll');ok(m.x>=44,`quiz ✕ is ${m.x}px`);
 await p.locator('.t2-dot').nth(19).click();await p.waitForTimeout(400);
 const vis=await p.evaluate(()=>{const c=document.querySelector('.t2-dot.cur').getBoundingClientRect();const mp=document.querySelector('.t2-map').getBoundingClientRect();return c.left>=mp.left-1&&c.right<=mp.right+1});
 ok(vis,'test map: jumping to question 20 keeps its dot in view');
 ok(errs.length===0,'tier2: no console errors '+JSON.stringify(errs));await ctx.close();}

// 3. offline + reload: service worker serves the shell; a practice in progress survives an offline reload; deep links reload
{const ctx=await b.newContext({...devices['Pixel 7']});const p=await ctx.newPage();const errs=errsOf(p);
 await p.goto(BASE);await p.waitForSelector('.hud');await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.reload();await p.waitForSelector('.hud');
 ok(await p.evaluate(()=>!!navigator.serviceWorker.controller),'service worker controls the page');
 await ctx.setOffline(true);
 await p.goto(BASE+'#/train');await p.waitForSelector('.t2-setup-kid');await p.fill('.t2-field input','א');await p.locator('.t2-btn.primary.big').click();
 await p.locator('.t2-type.calc').click();await p.getByRole('button',{name:'5',exact:true}).click();await p.locator('.t2-btn.primary.big').click();await p.waitForSelector('.kp');
 for(let i=0;i<2;i++){await p.locator('.kp-k',{hasText:'1'}).first().click();await p.locator('.kp-ok').click();if(!(await p.locator('.kp-show.done').count())){await p.locator('.kp-k',{hasText:'2'}).first().click();await p.locator('.kp-ok').click()}await p.locator('.t2-nav .t2-btn.primary').click()}
 await p.reload();await p.waitForSelector('.t2-menu',{timeout:8000});
 ok(await p.locator('.t2-resume').count()===1,'offline reload: unfinished practice offered for resume');
 await p.locator('.t2-resume .t2-btn.primary').click();ok(/שְׁאֵלָה 3 /.test(await p.locator('.t2-runtitle').innerText()),'offline resume continues at question 3');
 await p.goto(BASE+'#/parent');await p.reload();await p.waitForSelector('.t2-parent',{timeout:8000});ok(true,'offline deep-link reload of #/parent works');
 const st=await p.locator('.t2-kpi b').first().innerText();ok(st==='2',`parent report counts the 2 offline answers (got ${st})`);
 // "start over" on the unfinished practice must not drop those answers from the report
 await p.goto(BASE+'#/train');await p.waitForSelector('.t2-resume');await p.locator('.t2-resume .t2-btn.ghost').click();
 ok(await p.locator('.t2-resume').count()===0,'start over clears the resume card');
 await p.goto(BASE+'#/parent');await p.waitForSelector('.t2-parent');ok((await p.locator('.t2-kpi b').first().innerText())==='2','after start over the report still counts the 2 answers');
 await ctx.setOffline(false);ok(errs.length===0,'offline: no console errors '+JSON.stringify(errs));await ctx.close();}

console.log(fails?`\n${fails} FAILED`:'\nALL PASSED');await b.close();process.exit(fails?1:0)})();
