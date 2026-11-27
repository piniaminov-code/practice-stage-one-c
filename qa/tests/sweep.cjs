// Defect sweep at 375x667 (iPhone SE size). Usage: node qa/tests/sweep.cjs <outdir> [tag]
// Needs a local server on :8765 and the preinstalled Playwright (NODE_PATH=$(npm root -g)).
const {chromium}=require('playwright');const path=require('path');
const out=process.argv[2]||'.';const tag=process.argv[3]||'run';
const AXE=process.env.AXE_PATH;
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:+(process.env.VW||375),height:+(process.env.VH||667)},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36',serviceWorkers:'block'});
const p=await ctx.newPage();const errs=[];p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.text())});p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
let issues=0;
async function check(name,shot=true){
  await p.waitForTimeout(250);
  const r=await p.evaluate(()=>{
    const W=document.documentElement.clientWidth,H=innerHeight,res={overflow:[],clipped:[],small:[],covered:[]};
    const vis=e=>{const s=getComputedStyle(e);const r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
    const name=e=>(e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).join('.'):'')+' "'+(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,30).replace(/\n/g,' ')+'"');
    if(document.documentElement.scrollWidth>W)res.overflow.push('page scrollWidth '+document.documentElement.scrollWidth);
    document.querySelectorAll('body *').forEach(e=>{if(!vis(e))return;const r=e.getBoundingClientRect();const s=getComputedStyle(e);
      const inScroller=(()=>{for(let x=e.parentElement;x;x=x.parentElement){const o=getComputedStyle(x).overflowX;if(o==='auto'||o==='scroll')return true}return false})();
      if(s.position!=='fixed'&&!inScroller&&(r.right>W+1||r.left<-1)&&!e.closest('[hidden]'))res.overflow.push(name(e)+' '+Math.round(r.left)+'..'+Math.round(r.right));
      if((s.overflow+s.overflowX+s.overflowY).match(/hidden|clip/)&&e.innerText&&e.innerText.trim()&&(e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2)&&!e.matches('.bar,.t2-bar,.t2-pbt,.sr'))res.clipped.push(name(e)+` ${e.scrollWidth}x${e.scrollHeight}>${e.clientWidth}x${e.clientHeight}`);
    });
    document.querySelectorAll('button,a[href],input,select,[role=button]').forEach(e=>{if(!vis(e)||e.closest('[hidden]'))return;const r=e.getBoundingClientRect();
      const inline=e.tagName==='A'&&getComputedStyle(e).display==='inline';if(!inline&&(r.width<44||r.height<44)&&!e.matches('input[type=file]'))res.small.push(name(e)+` ${Math.round(r.width)}x${Math.round(r.height)}`)});
    // controls that are on screen but hidden under something else (fixed/sticky bars)
    const modal=document.querySelector('[aria-modal=true]');
    document.querySelectorAll('button,input,select').forEach(e=>{if(!vis(e)||e.closest('[hidden]')||(modal&&!modal.contains(e)))return;const r=e.getBoundingClientRect();
      const cx=r.left+r.width/2,cy=r.top+r.height/2;if(cy<0||cy>H||cx<0||cx>W)return;const top=document.elementFromPoint(cx,cy);
      if(top&&top!==e&&!e.contains(top)&&!top.contains(e))res.covered.push(name(e)+' under '+name(top))});
    // keyboard focus must not end up hidden: focus each control and check it is visible
    return res});
  const n=r.overflow.length+r.clipped.length+r.small.length; // covered = info only (scroll position snapshot)issues+=n;
  console.log(`## ${name}: overflow=${r.overflow.length} clipped=${r.clipped.length} small=${r.small.length} covered=${r.covered.length}`);
  for(const k of ['overflow','clipped','small','covered'])for(const x of [...new Set(r[k])].slice(0,8))console.log(`   ${k}: ${x}`);
  if(AXE){await p.addScriptTag({path:AXE});const v=await p.evaluate(async()=>(await axe.run({resultTypes:['violations']})).violations.map(v=>v.id+'('+v.nodes.length+')'));if(v.length){issues+=v.length;console.log('   axe:',v.join(' '))}}
  if(shot)await p.screenshot({path:path.join(out,`${tag}-${name}.png`)});
}
await p.goto('http://localhost:8765/');await p.waitForSelector('.hud');await check('sets-top');
await p.evaluate(()=>scrollTo(0,900));await check('sets-scrolled');
const tabs=p.locator('.tabs:not(.topics) .tab');await tabs.nth(3).click();await check('sets-tab4',false);
await p.locator('.setend').scrollIntoViewIfNeeded();await check('sets-setend');
await p.locator('.sec.sum').scrollIntoViewIfNeeded();await check('sets-summary');
await p.locator('.tabs.topics .tab').nth(1).click();await check('sets-topic');
await p.locator('.pwa-install').click();await check('install-sheet');await p.keyboard.press('Escape');
await p.locator('.t2-tab').nth(1).click();await p.waitForSelector('.t2-setup-kid');await check('kid-setup');
await p.fill('.t2-field input','בדיקה');await p.locator('.t2-btn.primary.big').click();await p.waitForSelector('.t2-types');await check('train-menu');
await p.locator('.t2-type.read').click();await p.locator('.t2-btn.primary.big').click();await p.waitForSelector('.t2-run');await check('run-reading');
{const it=p.locator('.t2-q .opt');const key=await p.evaluate(()=>0);await it.nth(3).click();await check('run-hint');
 const left=p.locator('.t2-q .opt:not(:disabled)');if(await left.count())await left.first().click();await check('run-feedback');}
await p.locator('.t2-x').click();await p.locator('.t2-type.calc').click();await p.locator('.t2-btn.primary.big').click();await p.waitForSelector('.kp');await check('run-keypad');
await p.locator('.kp-k',{hasText:'4'}).first().click();await p.locator('.kp-ok').click();await check('run-num-fb');
await p.locator('.t2-x').click();await p.locator('.t2-tab').nth(2).click();await p.waitForSelector('.t2-menu');await check('test-menu');
await p.locator('.t2-btn.primary.big').click();await p.waitForSelector('.t2-run');await check('test-run');
await p.locator('.t2-nav .t2-btn').last().click();await check('test-confirm');
await p.locator('.t2-confirm .t2-btn.primary').click();await p.waitForSelector('.t2-results');await check('test-results');
await p.locator('.t2-tab').nth(3).click();await p.waitForSelector('.t2-parent');await check('parent');
await p.evaluate(()=>scrollTo(0,document.body.scrollHeight));await check('parent-bottom');
async function focusCheck(name){const bad=await p.evaluate(async()=>{const out=[];const els=[...document.querySelectorAll('button:not([disabled]),input:not([disabled]),select')].filter(e=>e.offsetParent!==null&&!e.closest('[hidden]'));
  for(const e of els){e.focus();await new Promise(r=>requestAnimationFrame(r));const r=e.getBoundingClientRect();const top=document.elementFromPoint(r.left+r.width/2,Math.min(innerHeight-1,Math.max(0,r.top+r.height/2)));
   if(r.bottom>innerHeight||r.top<0||(top&&top!==e&&!e.contains(top)&&!top.contains(e)))out.push((e.innerText||e.getAttribute('aria-label')||e.tagName).trim().slice(0,25).replace(/\n/g,' ')+' under '+(top?top.className:'offscreen'))}
  return out});issues+=bad.length;console.log(`## focus ${name}: obscured=${bad.length}`);for(const x of [...new Set(bad)].slice(0,6))console.log('   focus-obscured:',x)}
await p.locator('.t2-tab').nth(0).click();await p.waitForTimeout(300);await focusCheck('sets');
await p.locator('.t2-tab').nth(1).click();await p.waitForTimeout(300);await focusCheck('train-menu');
console.log('CONSOLE ERRORS',JSON.stringify(errs));console.log('TOTAL ISSUES',issues);
await b.close()})();
