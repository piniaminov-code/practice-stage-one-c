// "מסך מלא" and "הוספה למסך הבית" controls, plus service-worker registration.
// Plain DOM, no framework. Honest about platform support:
//  - Fullscreen button only where the Fullscreen API works for pages
//    (not on iPhone Safari, where it is hidden).
//  - Install: Chrome/Edge/Android use the browser's own install prompt;
//    iPhone/iPad get short share-sheet instructions; other browsers get a
//    plain explanation. Nothing is shown when already running as an app.

const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const isFirefox = /Firefox|FxiOS/.test(ua);
const isMacSafari = !isIOS && /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
// iPhone Safari has no fullscreen for pages (only for video), whatever the API reports
const isIPhone = /iPhone|iPod/.test(ua);
const fsEnabled = !isIPhone && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

function installedMode() {
  const m = (q) => window.matchMedia && matchMedia(q).matches;
  // display-mode: fullscreen also matches while *we* put the page in fullscreen,
  // so only count it when the page itself didn't request it
  return navigator.standalone === true || m('(display-mode: standalone)') || m('(display-mode: minimal-ui)') ||
    (m('(display-mode: fullscreen)') && !fsElement());
}

let deferredPrompt = null;
let installed = installedMode();
const bar = document.createElement('aside');
bar.className = 'pwa-bar no-print';
bar.setAttribute('aria-label', 'תצוגה והתקנה');

const fsBtn = document.createElement('button');
fsBtn.type = 'button';
fsBtn.className = 'pwa-btn pwa-fs';
const installBtn = document.createElement('button');
installBtn.type = 'button';
installBtn.className = 'pwa-btn pwa-install';
installBtn.innerHTML = '<span aria-hidden="true">📲</span><span class="pwa-t">הוספה למסך הבית</span>';
installBtn.setAttribute('aria-label', 'הוספה למסך הבית');
installBtn.title = 'הוספה למסך הבית';

function renderFs() {
  const on = !!fsElement();
  fsBtn.innerHTML = `<span aria-hidden="true">${on ? '🡼' : '⛶'}</span><span class="pwa-t">${on ? 'יציאה ממסך מלא' : 'מסך מלא'}</span>`;
  fsBtn.setAttribute('aria-label', on ? 'יציאה ממסך מלא' : 'מסך מלא');
  fsBtn.title = on ? 'יציאה ממסך מלא' : 'מסך מלא';
  fsBtn.setAttribute('aria-pressed', String(on));
}
fsBtn.addEventListener('click', async () => {
  try {
    if (fsElement()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const el = document.documentElement;
      await (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
    }
  } catch { /* the browser refused: nothing to do */ }
  renderFs();
});
document.addEventListener('fullscreenchange', () => { renderFs(); update(); });
document.addEventListener('webkitfullscreenchange', () => { renderFs(); update(); });

// ---------- instruction sheet ----------
let lastFocus = null;
function sheet(title, html) {
  closeSheet();
  lastFocus = document.activeElement;
  const wrap = document.createElement('div');
  wrap.className = 'pwa-sheet-wrap no-print';
  wrap.innerHTML = `<div class="pwa-sheet" role="dialog" aria-modal="true" aria-labelledby="pwa-sheet-t" tabindex="-1">
    <h2 id="pwa-sheet-t">${title}</h2>${html}
    <button type="button" class="pwa-close">הבנתי</button></div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('.pwa-close')) closeSheet(); });
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  document.body.appendChild(wrap);
  wrap.querySelector('.pwa-sheet').focus();
}
function closeSheet() {
  const w = document.querySelector('.pwa-sheet-wrap');
  if (w) { w.remove(); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
}
const SHARE_ICON = '<svg class="pwa-share" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

function showInstructions() {
  if (isIOS) {
    sheet('הוספה למסך הבית באייפון או באייפד', `<ol>
      <li>לוחצים על כפתור השיתוף ${SHARE_ICON} בסרגל של ספארי (ריבוע עם חץ למעלה).</li>
      <li>גוללים בתפריט ובוחרים <b>"הוספה למסך הבית"</b>.</li>
      <li>לוחצים <b>"הוספה"</b>. האייקון יופיע במסך הבית, והתרגול ייפתח בלי סרגל הדפדפן.</li></ol>
      <p class="pwa-note">בדפדפנים אחרים באייפון (כרום, פיירפוקס) האפשרות נמצאת באותו תפריט שיתוף, אם הגרסה תומכת בה. באייפון אין לאתרים כפתור "מסך מלא", לכן הוא לא מוצג כאן.</p>`);
  } else if (isAndroid) {
    sheet('הוספה למסך הבית', `<p>פותחים את תפריט הדפדפן (<b>⋮</b>) ובוחרים <b>"הוספה למסך הבית"</b> או <b>"התקנת אפליקציה"</b>.</p>
      <p class="pwa-note">אם האפשרות לא מופיעה, ייתכן שהאתר כבר מותקן או שהדפדפן לא תומך בהתקנה.</p>`);
  } else if (isMacSafari) {
    sheet('הוספה ל-Dock במק', `<p>בספארי: תפריט <b>"קובץ"</b> ← <b>"הוספה ל-Dock"</b>. זה עובד ב-macOS Sonoma ומעלה.</p>
      <p class="pwa-note">בגרסאות ישנות יותר אין התקנה של אתרים. אפשר להוסיף סימנייה.</p>`);
  } else if (isFirefox) {
    sheet('הוספה למסך הבית', `<p>פיירפוקס במחשב לא מתקין אתרים כאפליקציה. אפשר להוסיף סימנייה (Ctrl+D), או לפתוח את האתר בכרום או באדג' ולהתקין משם.</p>`);
  } else {
    sheet('התקנת התרגול', `<p>אם בתפריט הדפדפן (<b>⋮</b> או <b>…</b>) יש <b>"התקנת אפליקציה"</b> או <b>"הוספה למסך הבית"</b>, אפשר להשתמש בה.</p>
      <p class="pwa-note">אם האפשרות לא מופיעה, ייתכן שהאתר כבר מותקן, שזו גלישה פרטית, או שהדפדפן לא תומך בהתקנה. אפשר תמיד להוסיף סימנייה.</p>`);
  }
}
installBtn.addEventListener('click', async () => {
  if (deferredPrompt) {
    const p = deferredPrompt;
    deferredPrompt = null;
    try {
      await p.prompt();
      const choice = await p.userChoice;
      if (choice && choice.outcome === 'accepted') { installed = true; update(); }
    } catch { showInstructions(); }
    return;
  }
  showInstructions();
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // show our own button instead of the mini-infobar
  deferredPrompt = e;
  update();
});
window.addEventListener('appinstalled', () => { installed = true; deferredPrompt = null; update(); });

function update() {
  installed = installed || installedMode();
  fsBtn.hidden = !fsEnabled || installed;
  installBtn.hidden = installed;
  bar.hidden = fsBtn.hidden && installBtn.hidden;
  document.documentElement.classList.toggle('pwa-bar-on', !bar.hidden);
  document.documentElement.classList.toggle('is-standalone', installed);
}
['(display-mode: standalone)', '(display-mode: minimal-ui)', '(display-mode: fullscreen)'].forEach((q) => {
  const mq = window.matchMedia && matchMedia(q);
  if (mq && mq.addEventListener) mq.addEventListener('change', () => { installed = installedMode(); update(); });
});

renderFs();
bar.append(fsBtn, installBtn);
document.body.prepend(bar);
update();

// ---------- service worker ----------
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => { /* site still works without it */ });
  });
}
