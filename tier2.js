// Tier 2: profiles per child, practice by type, timed / untimed mock tests,
// answer review and a parent report. Readable source, no build step.
// It shares React with the original bundle (vendor file) and wraps the
// original "sets" page, which keeps working exactly as before.

import { r as reactFactory } from './vendor-DctBZRDK.js';
import { BANK, BY_ID, TYPES, SKILLS, PASSAGES, ORIG_SET_ITEMS, FLAGS } from './bank.js';

const React = reactFactory();
const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;
const h = React.createElement;

// ------------------------------------------------------------------ storage
const KEY = 'stage1-family.v1';
const empty = () => ({ v: 1, profiles: [], current: null, kids: {} });
let state = empty();
let saveOk = true;
try {
  const raw = localStorage.getItem(KEY);
  if (raw) state = { ...empty(), ...JSON.parse(raw) };
} catch { saveOk = false; }
const subs = new Set();
function commit(next) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); saveOk = true; } catch { saveOk = false; }
  subs.forEach((f) => f(state));
}
function useStore() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((x) => x + 1); subs.add(f); return () => subs.delete(f); }, []);
  return state;
}
const kidData = (s, id) => s.kids[id] || { att: {}, sessions: [], active: null };
function updateKid(id, fn) {
  const cur = kidData(state, id);
  commit({ ...state, kids: { ...state.kids, [id]: fn(cur) } });
}
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

// ------------------------------------------------------------------ helpers
const AVATARS = ['🦊', '🐼', '🦁', '🐸', '🐙', '🦄', '🐢', '🚀', '🐬', '🦉'];
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const fmtTime = (sec) => { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const fmtDate = (ts) => new Date(ts).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Same bidi handling as the original sets page: numbers and equations stay
// left-to-right, and a Hebrew prefix like "מִ-" stays glued to its number.
const NUM_RE = /(\d+(?:[ ,]+[\d+\-−×=÷_]+|[ ]*[+\-−×=÷][ ]*[\d_]+)*|_{3}(?:[ ,=+\-−×÷]+\d+)*)/g;
const PRE = /[֐-׿]+-$/;
function Bidi({ children }) {
  const t = String(children).split(NUM_RE);
  return h(Fragment, null, t.map((s, n) => {
    if (n % 2) {
      const p = (t[n - 1].match(PRE) || [''])[0];
      const b = h('bdi', { dir: 'ltr', key: p ? undefined : n }, '⁦' + s + '⁩');
      return p ? h('span', { className: 'nw', key: n }, p, b) : b;
    }
    const m = n + 1 < t.length && s.match(PRE);
    return m ? s.slice(0, -m[0].length) : s;
  }));
}

// ------------------------------------------------------------------ routing
function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  const tab = ['train', 'test', 'parent'].includes(path) ? path : 'sets';
  return { tab, params };
}
function go(tab, params) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  location.hash = tab === 'sets' ? '' : `#/${tab}${qs}`;
  if (tab === 'sets' && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  window.dispatchEvent(new Event('hashchange'));
}

// ------------------------------------------------------------------ item picking
function itemScore(att, id) {
  const a = att[id];
  if (!a) return 0; // never seen → first
  if (!a.lastOk) return 1; // got it wrong last time
  return 2;
}
function prioritized(pool, att) {
  return shuffle(pool).sort((x, y) => itemScore(att, x.id) - itemScore(att, y.id));
}
function pickPassages(att, n, exclude = new Set()) {
  const byP = PASSAGES.filter((p) => !exclude.has(p.id)).map((p) => {
    const qs = BANK.filter((x) => x.passage && x.passage.id === p.id);
    const fresh = qs.filter((x) => !att[x.id]).length;
    const wrong = qs.filter((x) => att[x.id] && !att[x.id].lastOk).length;
    return { p, qs, rank: fresh ? 0 : wrong ? 1 : 2 };
  });
  return shuffle(byP).sort((a, b) => a.rank - b.rank).slice(0, n);
}
const LEVEL_OK = (lv) => (x) => !lv || lv === 'all' || x.level === Number(lv);

export function buildPractice({ type, level, len, skill, mistakes, ids }, att) {
  if (ids) return ids.filter((id) => BY_ID[id]);
  if (mistakes) {
    const wrong = BANK.filter((x) => att[x.id] && !att[x.id].lastOk);
    // keep reading questions of the same passage together
    return shuffle(wrong).sort((a, b) => (a.passage ? a.passage.id : '~').localeCompare(b.passage ? b.passage.id : '~')).slice(0, len).map((x) => x.id);
  }
  if (skill) return prioritized(BANK.filter((x) => x.skill === skill), att).slice(0, len).map((x) => x.id);
  if (type === 'reading') {
    return pickPassages(att, Math.max(1, Math.round(len / 4))).flatMap((g) => g.qs.map((x) => x.id));
  }
  if (type && type !== 'mix') {
    let pool = BANK.filter((x) => x.type === type).filter(LEVEL_OK(level));
    if (pool.length < len) pool = BANK.filter((x) => x.type === type);
    return prioritized(pool, att).slice(0, len).map((x) => x.id);
  }
  // mixed: a reading passage (if long enough) + an even share of the rest
  const out = [];
  let rest = len;
  if (len >= 10) { const g = pickPassages(att, 1)[0]; out.push(...g.qs.map((x) => x.id)); rest -= g.qs.length; }
  const kinds = ['calc', 'word', 'series'];
  kinds.forEach((t, i) => {
    const n = Math.round(rest / (kinds.length - i));
    rest -= n;
    let pool = BANK.filter((x) => x.type === t).filter(LEVEL_OK(level));
    out.push(...prioritized(pool, att).slice(0, n).map((x) => x.id));
  });
  return out;
}
export const TEST_PLANS = {
  short: { n: 12, minutes: 15, reading: 1, calc: 3, word: 3, series: 2 },
  full: { n: 24, minutes: 30, reading: 2, calc: 6, word: 6, series: 4 },
};
export function buildTest(plan, att) {
  const P = TEST_PLANS[plan];
  const out = pickPassages(att, P.reading).flatMap((g) => g.qs.map((x) => x.id));
  for (const t of ['calc', 'word', 'series']) {
    // a real test mixes easy and hard: take some from each level
    const pool = BANK.filter((x) => x.type === t);
    const lv = shuffle(pool).sort((a, b) => itemScore(att, a.id) - itemScore(att, b.id));
    const chosen = [];
    for (const want of [1, 2, 3, 2, 3, 1, 2, 3]) {
      if (chosen.length >= P[t]) break;
      const x = lv.find((y) => y.level === want && !chosen.includes(y)) || lv.find((y) => !chosen.includes(y));
      if (x) chosen.push(x);
    }
    out.push(...chosen.sort((a, b) => a.level - b.level).map((x) => x.id));
  }
  return out;
}

// ------------------------------------------------------------------ recording
function isCorrect(item, given) {
  if (given === undefined || given === null || given === '') return false;
  return item.kind === 'mc' ? Number(given) === item.answer : Number(given) === item.answer;
}
function recordAttempts(kidId, results) {
  updateKid(kidId, (k) => {
    const att = { ...k.att };
    for (const r of results) {
      const prev = att[r.id] || { n: 0, ok: 0 };
      // lastOk = right on the first try this time. A question that needed a
      // second try stays on the "תיקון טעויות" list until it is solved first time.
      att[r.id] = { n: prev.n + 1, ok: prev.ok + (r.firstOk ? 1 : 0), first: prev.first ?? !!r.firstOk, lastOk: !!(r.ok && r.firstOk), last: Date.now() };
    }
    return { ...k, att };
  });
}
// Answers already given in a practice that was not finished (closed tab, "start over", new session).
function activeItems(active) {
  if (!active || active.mode !== 'practice') return [];
  return active.qids.map((id) => {
    const r = (active.answers || {})[id];
    return r && r.done ? { id, given: r.given, ok: r.ok, firstOk: r.firstOk, ms: r.ms || 0, wrong: r.wrong || [] } : null;
  }).filter(Boolean);
}
// Keep an unfinished practice in the history (as a partial session) instead of dropping it.
function flushActive(kidId) {
  const k = kidData(state, kidId);
  const items = activeItems(k.active);
  if (items.length) saveSession(kidId, k.active, items);
  else if (k.active) updateKid(kidId, (x) => ({ ...x, active: null }));
}
function saveSession(kidId, sess, items) {
  const rec = {
    id: sess.id, mode: sess.mode, timed: !!sess.timed, qids: sess.qids, plan: sess.plan, title: sess.title,
    started: sess.started, limitSec: sess.limitSec || null,
    // a timed test can't take longer than its limit (the time-up check runs once a second)
    ended: sess.limitSec ? Math.min(Date.now(), sess.started + sess.limitSec * 1000) : Date.now(),
    items, score: items.filter((x) => x.firstOk).length, total: sess.qids.length,
    partial: items.length < sess.qids.length && sess.mode === 'practice',
  };
  updateKid(kidId, (k) => ({ ...k, sessions: [...k.sessions, rec].slice(-200), active: null }));
  return rec;
}

// ------------------------------------------------------------------ small UI pieces
function Btn({ className = '', ...p }) { return h('button', { type: 'button', className: 't2-btn ' + className, ...p }); }

function Keypad({ value, onChange, onSubmit, submitLabel, disabled }) {
  const press = (k) => {
    if (disabled) return;
    if (k === 'del') onChange(value.slice(0, -1));
    else if (value.length < 3) onChange((value === '0' ? '' : value) + k);
  };
  useEffect(() => {
    const f = (e) => {
      if (disabled || e.target.tagName === 'INPUT') return;
      if (/^\d$/.test(e.key)) { press(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { press('del'); e.preventDefault(); }
      else if (e.key === 'Enter' && value) { onSubmit(); e.preventDefault(); }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  });
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  return h('div', { className: 'kp' },
    h('div', { className: 'kp-show', 'aria-live': 'polite', 'aria-label': 'הַתְּשׁוּבָה שֶׁלִּי' }, value || h('span', { className: 'kp-ph' }, '?')),
    h('div', { className: 'kp-grid', dir: 'ltr' }, keys.map((k) => k === 'ok'
      ? h('button', { key: k, type: 'button', className: 'kp-k kp-ok', disabled: disabled || !value, onClick: onSubmit }, submitLabel)
      : h('button', { key: k, type: 'button', className: 'kp-k' + (k === 'del' ? ' kp-del' : ''), disabled, onClick: () => press(k), 'aria-label': k === 'del' ? 'מְחִיקָה' : k }, k === 'del' ? '⌫' : k))));
}

function Passage({ p, open, onToggle }) {
  return h('div', { className: 't2-passage' + (open ? '' : ' closed') },
    h('button', { type: 'button', className: 't2-passage-h', onClick: onToggle, 'aria-expanded': open },
      h('span', null, '📖 ', p.title), h('span', { className: 't2-passage-t' }, open ? 'לְהַסְתִּיר ▲' : 'לְהַצִּיג ▼')),
    open && h('ol', null, p.lines.map((l, i) => h('li', { key: i }, h('span', { className: 'ln' }, i + 1), h(Bidi, null, l)))));
}

function ProfileBar({ s, kid }) {
  return h('div', { className: 't2-pbar' },
    h('span', { className: 't2-av', 'aria-hidden': 'true' }, kid.avatar),
    h('span', { className: 't2-pname' }, kid.name),
    s.profiles.length > 1 && h('label', { className: 't2-switch' },
      h('span', { className: 'sr' }, 'הַחְלָפַת יֶלֶד'),
      h('select', { value: kid.id, onChange: (e) => commit({ ...state, current: e.target.value }) },
        s.profiles.map((p) => h('option', { key: p.id, value: p.id }, p.avatar + ' ' + p.name)))),
    h('button', { type: 'button', className: 't2-link', onClick: () => commit({ ...state, current: '__new' }) }, '+ יֶלֶד/ה'));
}

function ProfileSetup({ onDone, existing }) {
  const [name, setName] = useState(existing ? existing.name : '');
  const [g, setG] = useState(existing ? existing.g : 'm');
  const [av, setAv] = useState(existing ? existing.avatar : AVATARS[0]);
  const save = () => {
    const nm = name.trim() || (g === 'f' ? 'אֲנִי' : 'אֲנִי');
    if (existing) {
      commit({ ...state, profiles: state.profiles.map((p) => (p.id === existing.id ? { ...p, name: nm, g, avatar: av } : p)) });
      onDone && onDone(existing.id);
      return;
    }
    const id = uid();
    commit({ ...state, profiles: [...state.profiles, { id, name: nm, g, avatar: av, created: Date.now() }], current: id });
    onDone && onDone(id);
  };
  return h('div', { className: 't2-card t2-setup-kid' },
    !existing && h('h2', null, 'מִי מְתַרְגֵּל הַיּוֹם?'),
    !existing && h('p', { className: 't2-sub' }, 'כָּל יֶלֶד מְקַבֵּל הִתְקַדְּמוּת מִשֶּׁלּוֹ. הַכֹּל נִשְׁמָר רַק בַּמַּכְשִׁיר הַזֶּה.'),
    h('label', { className: 't2-field' }, h('span', null, 'הַשֵּׁם'),
      h('input', { value: name, maxLength: 20, onChange: (e) => setName(e.target.value), placeholder: 'שֵׁם', autoComplete: 'off' })),
    h('div', { className: 't2-field' }, h('span', null, 'פּוֹנִים אֵלַי כְּ:'),
      h('div', { className: 't2-chips', role: 'group' },
        h(Btn, { className: 'chipb' + (g === 'm' ? ' on' : ''), 'aria-pressed': g === 'm', onClick: () => setG('m') }, 'בֵּן'),
        h(Btn, { className: 'chipb' + (g === 'f' ? ' on' : ''), 'aria-pressed': g === 'f', onClick: () => setG('f') }, 'בַּת'))),
    h('div', { className: 't2-field' }, h('span', null, 'בּוֹחֲרִים דְּמוּת'),
      h('div', { className: 't2-avs', role: 'group' }, AVATARS.map((a) => h('button', { key: a, type: 'button', className: 't2-avb' + (a === av ? ' on' : ''), 'aria-pressed': a === av, onClick: () => setAv(a) }, a)))),
    h(Btn, { className: 'primary big', onClick: save }, existing ? 'שמירה' : 'מַתְחִילִים!'),
    !existing && state.profiles.length > 0 && h(Btn, { className: 'ghost', onClick: () => commit({ ...state, current: state.profiles[0].id }) }, 'בִּטּוּל'));
}

function useKid() {
  const s = useStore();
  const kid = s.profiles.find((p) => p.id === s.current) || (s.current !== '__new' && s.profiles[0]) || null;
  return { s, kid };
}
const G = (kid, m, f) => (kid && kid.g === 'f' ? f : m);

// ------------------------------------------------------------------ the runner
function Runner({ kid, sess, sfx, onExit, onFinish }) {
  const items = sess.qids.map((id) => BY_ID[id]).filter(Boolean);
  const [idx, setIdx] = useState(Math.min(sess.idx || 0, items.length - 1));
  const [ans, setAns] = useState(sess.answers || {}); // id -> {given, tries, ok, firstOk, done, ms, wrong:[...]}
  const [num, setNum] = useState('');
  const [openP, setOpenP] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [confirmEnd, setConfirmEnd] = useState(false);
  const shownAt = useRef(Date.now());
  const topRef = useRef(null);
  const it = items[idx];
  const a = ans[it.id] || {};
  const isTest = sess.mode === 'test';

  // persist progress so a reload can resume
  useEffect(() => { updateKid(kid.id, (k) => ({ ...k, active: { ...sess, idx, answers: ans } })); }, [idx, ans]);
  useEffect(() => {
    shownAt.current = Date.now();
    setNum(isTest && ans[it.id] && it.kind === 'num' ? String(ans[it.id].given) : '');
    if (topRef.current) window.scrollTo(0, topRef.current.getBoundingClientRect().top + window.scrollY);
    // the question map scrolls sideways on small phones: keep the current question in view
    const cur = document.querySelector('.t2-map .t2-dot.cur');
    if (cur && cur.parentElement.scrollWidth > cur.parentElement.clientWidth) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [idx]);
  // clock
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // focus mode: hide the bottom tab bar while answering (the ✕ button exits)
  useEffect(() => { document.body.classList.add('t2-running'); return () => document.body.classList.remove('t2-running'); }, []);
  // after an answer, bring the feedback into view
  useEffect(() => {
    if (isTest) return;
    requestAnimationFrame(() => { const fb = document.querySelector('.t2-q .fb'); fb && fb.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
  }, [ans]);
  const elapsed = (now - sess.started) / 1000;
  const remaining = sess.limitSec ? sess.limitSec - elapsed : null;

  const finish = useCallback((timeUp) => {
    const res = items.map((x) => {
      const r = ans[x.id];
      if (!r) return null;
      if (isTest) { const ok = isCorrect(x, r.given); return { id: x.id, given: r.given, ok, firstOk: ok, ms: r.ms || 0 }; }
      if (!r.done) return null;
      return { id: x.id, given: r.given, ok: r.ok, firstOk: r.firstOk, ms: r.ms || 0, wrong: r.wrong || [] };
    }).filter(Boolean);
    if (isTest) recordAttempts(kid.id, res);
    const rec = saveSession(kid.id, sess, res);
    onFinish(rec, !!timeUp);
  }, [ans, items]);

  useEffect(() => { if (remaining !== null && remaining <= 0) finish(true); }, [remaining !== null && remaining <= 0]);

  const answerPractice = (given) => {
    if (a.done) return;
    const ok = isCorrect(it, given);
    const tries = (a.tries || 0) + 1;
    const ms = Date.now() - shownAt.current;
    let next;
    if (ok) {
      next = { given, tries, ok: true, firstOk: tries === 1, done: true, ms, wrong: a.wrong || [] };
      sfx && sfx('correct_' + (1 + (Object.keys(ans).length % 3)));
    } else if (tries === 1) {
      next = { given, tries, ok: false, firstOk: false, done: false, ms, wrong: [given] };
      sfx && sfx('wrong_1');
    } else {
      next = { given, tries, ok: false, firstOk: false, done: true, ms, wrong: [...(a.wrong || []), given] };
      sfx && sfx('wrong_2');
    }
    if (next.done) recordAttempts(kid.id, [{ id: it.id, ok: next.ok, firstOk: next.firstOk }]);
    setAns({ ...ans, [it.id]: next });
    setNum('');
  };
  const answerTest = (given) => {
    const ms = (a.ms || 0) + (Date.now() - shownAt.current);
    shownAt.current = Date.now();
    setAns({ ...ans, [it.id]: { given, ms } });
  };
  const answer = isTest ? answerTest : answerPractice;

  const answeredCount = items.filter((x) => (isTest ? ans[x.id] : ans[x.id] && ans[x.id].done)).length;
  const last = idx === items.length - 1;
  const canNext = isTest || a.done;
  const showPassage = it.passage;
  const prevSamePassage = idx > 0 && items[idx - 1].passage && it.passage && items[idx - 1].passage.id === it.passage.id;

  // MC option state
  const optClass = (i) => {
    if (isTest) return Number(a.given) === i ? ' is-picked' : '';
    if (a.done) return i === it.answer ? ' is-right' : (a.wrong || []).map(Number).includes(i) ? ' is-wrong' : '';
    return (a.wrong || []).map(Number).includes(i) ? ' is-wrong' : '';
  };
  const optDisabled = (i) => !isTest && (a.done || (a.wrong || []).map(Number).includes(i));
  const hint = !isTest && a.tries === 1 && !a.done
    ? (it.hints && it.hints[Number(a.given)]) || (it.type === 'reading' ? 'כְּדַאי לַחֲזֹר לַקֶּטַע וְלִקְרֹא שׁוּב אֶת הַשּׁוּרָה הַמַּתְאִימָה.' : 'כְּדַאי לִבְדֹּק שׁוּב אֶת הַחֶשְׁבּוֹן.')
    : null;

  const typeInfo = TYPES.find((t) => t.id === it.type);
  return h('div', { className: 't2-run ' + (typeInfo ? typeInfo.cls : ''), ref: topRef },
    h('div', { className: 't2-runbar' },
      h('button', { type: 'button', className: 't2-x', onClick: onExit, 'aria-label': 'יְצִיאָה' }, '✕'),
      h('div', { className: 't2-runmid' },
        h('div', { className: 't2-runtitle' }, `שְׁאֵלָה ${idx + 1} מִתּוֹךְ ${items.length}`),
        h('div', { className: 't2-bar', 'aria-hidden': 'true' }, h('i', { style: { width: pct(answeredCount, items.length) + '%' } }))),
      isTest && h('div', { className: 't2-clock' + (remaining !== null && remaining < 60 ? ' warn' : ''), role: 'timer', 'aria-label': remaining !== null ? 'זְמַן שֶׁנִּשְׁאַר' : 'זְמַן' },
        remaining !== null ? '⏱️ ' + fmtTime(remaining) : '🐢 ' + fmtTime(elapsed))),
    isTest && h('div', { className: 't2-map', role: 'group', 'aria-label': 'מַפַּת שְׁאֵלוֹת' }, items.map((x, i) =>
      h('button', { key: x.id, type: 'button', className: 't2-dot' + (ans[x.id] ? ' done' : '') + (i === idx ? ' cur' : ''), onClick: () => setIdx(i), 'aria-label': `שְׁאֵלָה ${i + 1}` + (ans[x.id] ? ' (נַעֲנְתָה)' : '') }, i + 1))),
    showPassage && h(Passage, { p: it.passage, open: openP || !prevSamePassage, onToggle: () => setOpenP(!openP) }),
    h('div', { className: 't2-q' },
      h('div', { className: 't2-qtype' }, typeInfo ? typeInfo.icon + ' ' + typeInfo.name : ''),
      h('p', { className: 't2-qtext' + (it.kind === 'num' ? ' eqn' : '') }, it.kind === 'num' ? h('bdi', { dir: 'ltr' }, it.q) : h(Bidi, null, it.q)),
      it.kind === 'mc'
        ? h('div', { className: 'opts' }, it.options.map((o, i) => h('button', {
            key: i, type: 'button', className: 'opt' + optClass(i), disabled: optDisabled(i),
            'aria-pressed': isTest ? Number(a.given) === i : undefined,
            onClick: () => answer(String(i)),
          }, h('span', { className: 'opt-l' }, 'אבגד'[i]), h('span', null, h(Bidi, null, o)))))
        : (!isTest && a.done)
          ? h('div', { className: 'kp-show done' + (a.ok ? ' ok' : ' no') }, a.given)
          : h(Keypad, { value: num, onChange: setNum, onSubmit: () => num && answer(num), submitLabel: isTest ? 'שְׁמִירָה' : 'בְּדִיקָה' }),
      isTest && it.kind === 'num' && a.given !== undefined && h('p', { className: 't2-saved' }, '✓ נִשְׁמַר: ', h('bdi', { dir: 'ltr' }, a.given)),
      hint && h('div', { className: 'fb is-no', role: 'status' },
        h('strong', null, 'לֹא בְּדִיּוּק. ' + G(kid, 'נַסֵּה', 'נַסִּי') + ' שׁוּב!'), h('span', null, h(Bidi, null, hint))),
      !isTest && a.done && h('div', { className: 'fb ' + (a.ok ? 'is-ok' : 'is-no'), role: 'status' },
        h('strong', null, a.ok ? (a.firstOk ? 'נָכוֹן, כָּל הַכָּבוֹד!' : 'נָכוֹן! הִצְלַחְתָּ בַּנִּסָּיוֹן הַשֵּׁנִי.'.replace('הִצְלַחְתָּ', G(kid, 'הִצְלַחְתָּ', 'הִצְלַחְתְּ'))) : 'כִּמְעַט. ' + G(kid, 'בּוֹא', 'בּוֹאִי') + ' נָבִין יַחַד.'),
        !a.ok && h('span', { className: 'ans' }, 'הַתְּשׁוּבָה: ', h(Bidi, null, it.kind === 'mc' ? it.options[it.answer] : String(it.answer))),
        h('span', null, h(Bidi, null, it.why)))),
    h('div', { className: 't2-nav' },
      isTest && idx > 0 && h(Btn, { className: 'ghost', onClick: () => setIdx(idx - 1) }, '→ הַקּוֹדֶמֶת'),
      canNext && !last && h(Btn, { className: 'primary', onClick: () => setIdx(idx + 1) }, isTest && !a.given ? 'דִּלּוּג ←' : 'לַשְּׁאֵלָה הַבָּאָה ←'),
      canNext && last && !isTest && h(Btn, { className: 'primary', onClick: () => finish(false) }, 'סִיּוּם 🎉'),
      isTest && h(Btn, { className: last ? 'primary' : 'ghost', onClick: () => (answeredCount < items.length ? setConfirmEnd(true) : finish(false)) }, 'סִיּוּם הַמִּבְחָן')),
    confirmEnd && h('div', { className: 't2-confirm', role: 'alertdialog', 'aria-label': 'סִיּוּם' },
      h('p', null, `יֵשׁ עוֹד ${items.length - answeredCount} ${items.length - answeredCount === 1 ? 'שְׁאֵלָה' : 'שְׁאֵלוֹת'} בְּלִי תְּשׁוּבָה. לְסַיֵּם בְּכָל זֹאת?`),
      h('div', { className: 't2-row' },
        h(Btn, { className: 'primary', onClick: () => finish(false) }, 'כֵּן, לְסַיֵּם'),
        h(Btn, { className: 'ghost', onClick: () => { setConfirmEnd(false); const j = items.findIndex((x) => !ans[x.id]); if (j >= 0) setIdx(j); } }, 'לַחֲזֹר לַשְּׁאֵלוֹת'))));
}

// ------------------------------------------------------------------ results
function praise(p) {
  if (p >= 90) return '🏆 מְצֻיָּן!';
  if (p >= 70) return '🌟 יָפֶה מְאֹד!';
  if (p >= 50) return '👍 עֲבוֹדָה טוֹבָה!';
  return '💪 מַמְשִׁיכִים לְהִתְאַמֵּן!';
}
function Review({ rec, kid }) {
  const got = Object.fromEntries(rec.items.map((r) => [r.id, r]));
  // tests list every question (also the unanswered ones), practice lists what was answered
  const order = rec.mode === 'test' && rec.qids ? rec.qids : rec.items.map((r) => r.id);
  const rows = order.map((id) => ({ r: got[id] || { id, ok: false, firstOk: false }, it: BY_ID[id] })).filter((x) => x.it);
  const unanswered = rec.mode === 'test' ? rec.total - rec.items.length : 0;
  const [open, setOpen] = useState(() => new Set(rows.filter((x) => !x.r.firstOk).map((x) => x.r.id)));
  const toggle = (id) => { const n = new Set(open); n.has(id) ? n.delete(id) : n.add(id); setOpen(n); };
  const show = (it, v) => (v === undefined || v === null || v === '' ? 'לֹא עָנִיתִי' : it.kind === 'mc' ? `${'אבגד'[Number(v)]}. ${it.options[Number(v)]}` : String(v));
  return h('div', { className: 't2-review' },
    h('h2', { className: 't2-h3' }, 'בְּדִיקַת הַתְּשׁוּבוֹת'),
    unanswered > 0 && h('p', { className: 't2-sub' }, `${unanswered} ${unanswered === 1 ? 'שְׁאֵלָה נִשְׁאֲרָה' : 'שְׁאֵלוֹת נִשְׁאֲרוּ'} בְּלִי תְּשׁוּבָה.`),
    rows.map(({ r, it }, i) => h('div', { key: r.id, className: 't2-rv ' + (r.firstOk ? 'ok' : r.ok ? 'mid' : 'no') },
      h('button', { type: 'button', className: 't2-rv-h', 'aria-expanded': open.has(r.id), onClick: () => toggle(r.id) },
        h('span', { className: 't2-rv-mark', 'aria-hidden': 'true' }, r.firstOk ? '✓' : r.ok ? '↻' : '✗'),
        h('span', { className: 't2-rv-q' }, it.kind === 'num' ? h('bdi', { dir: 'ltr' }, it.q) : h(Bidi, null, it.q)),
        h('span', { className: 'sr' }, r.firstOk ? 'נָכוֹן' : 'לֹא נָכוֹן')),
      open.has(r.id) && h('div', { className: 't2-rv-b' },
        it.passage && h('p', { className: 't2-sub' }, '📖 ', it.passage.title),
        h('p', null, h('b', null, 'הַתְּשׁוּבָה שֶׁלִּי: '), h(Bidi, null, show(it, rec.mode === 'test' ? r.given : (r.wrong && r.wrong[0] !== undefined ? r.wrong[0] : r.given)))),
        !r.firstOk && h('p', null, h('b', null, 'הַתְּשׁוּבָה הַנְּכוֹנָה: '), h(Bidi, null, show(it, it.kind === 'mc' ? it.answer : it.answer))),
        h('p', { className: 't2-why' }, '💡 ', h(Bidi, null, it.why))))));
}
function Results({ rec, kid, timeUp, onAgain, onMenu, onFixMistakes, sfx }) {
  const p = pct(rec.score, rec.total);
  useEffect(() => { sfx && sfx(p >= 80 ? 'all_done' : 'sticker'); }, []);
  const ids = rec.mode === 'test' && rec.qids ? rec.qids : rec.items.map((r) => r.id);
  const okSet = new Set(rec.items.filter((r) => r.firstOk).map((r) => r.id));
  const byType = TYPES.map((t) => {
    const its = ids.filter((id) => BY_ID[id] && BY_ID[id].type === t.id);
    return { t, ok: its.filter((id) => okSet.has(id)).length, n: its.length };
  }).filter((x) => x.n);
  const wrongIds = ids.filter((id) => !okSet.has(id));
  const missing = rec.mode === 'test' ? rec.total - rec.items.length : 0;
  const used = (rec.ended - rec.started) / 1000;
  return h('div', { className: 't2-results' },
    timeUp && h('div', { className: 't2-timeup', role: 'status' }, '⏰ הַזְּמַן נִגְמַר!'),
    h('div', { className: 't2-card t2-score' },
      h('div', { className: 't2-praise' }, praise(p)),
      h('div', { className: 't2-big' }, h('bdi', { dir: 'ltr' }, `${rec.score}/${rec.total}`)),
      h('div', { className: 't2-sub' }, rec.mode === 'test' ? 'נְכוֹנוֹת בַּמִּבְחָן' : 'נְכוֹנוֹת בַּנִּסָּיוֹן הָרִאשׁוֹן'),
      h('div', { className: 't2-facts' },
        h('span', null, '⏱️ ', fmtTime(used)),
        rec.limitSec && h('span', null, 'מִתּוֹךְ ', fmtTime(rec.limitSec)),
        missing > 0 && h('span', null, `${missing} בְּלִי תְּשׁוּבָה`)),
      byType.length > 1 && h('div', { className: 't2-bytype' }, byType.map(({ t, ok, n }) =>
        h('div', { key: t.id, className: 't2-bt ' + t.cls }, h('span', null, t.icon, ' ', t.name), h('b', null, h('bdi', { dir: 'ltr' }, `${ok}/${n}`)))))),
    h('div', { className: 't2-row wrap' },
      wrongIds.length > 0 && h(Btn, { className: 'primary', onClick: () => onFixMistakes(wrongIds) }, '🔁 לְתַרְגֵּל אֶת הַטָּעֻיּוֹת'),
      h(Btn, { className: wrongIds.length ? 'ghost' : 'primary', onClick: onAgain }, rec.mode === 'test' ? 'עוֹד מִבְחָן' : 'עוֹד אִמּוּן'),
      h(Btn, { className: 'ghost', onClick: onMenu }, 'חֲזָרָה לַתַּפְרִיט')),
    h(Review, { rec, kid }));
}

// ------------------------------------------------------------------ practice + test screens
function typeStats(att, type) {
  const ids = BANK.filter((x) => x.type === type).map((x) => x.id);
  let seen = 0, ok = 0;
  for (const id of ids) if (att[id]) { seen++; if (att[id].lastOk) ok++; }
  return { total: ids.length, seen, ok };
}

function Session({ kid, mode, params, sfx }) {
  const s = useStore();
  const kd = kidData(s, kid.id);
  const [view, setView] = useState('menu'); // menu | run | results
  const [sess, setSess] = useState(null);
  const [result, setResult] = useState(null);
  const [opts, setOpts] = useState({ type: 'mix', level: 'all', len: 10, plan: 'short', timed: true });
  const skill = params.skill && SKILLS[params.skill] ? params.skill : null;
  const active = kd.active && kd.active.mode === mode ? kd.active : null;

  useEffect(() => { setView('menu'); setSess(null); setResult(null); }, [kid.id, mode]);

  const start = (o) => {
    flushActive(kid.id);
    let qids, title, extra = {};
    if (mode === 'test') {
      qids = buildTest(o.plan, kd.att);
      const P = TEST_PLANS[o.plan];
      title = o.plan === 'full' ? 'מִבְחָן מָלֵא' : 'מִבְחָן קָצָר';
      extra = { plan: o.plan, timed: o.timed, limitSec: o.timed ? P.minutes * 60 : null };
    } else {
      qids = buildPractice({ ...o, skill: o.skill, mistakes: o.mistakes, ids: o.ids }, kd.att);
      title = o.ids ? 'תִּקּוּן טָעֻיּוֹת' : o.mistakes ? 'תִּקּוּן טָעֻיּוֹת' : o.skill ? SKILLS[o.skill] : (TYPES.find((t) => t.id === o.type) || { name: 'מְעֹרָב' }).name;
    }
    if (!qids.length) return;
    const ns = { id: uid(), mode: o.ids ? 'practice' : mode, qids, started: Date.now(), idx: 0, answers: {}, title, ...extra };
    updateKid(kid.id, (k) => ({ ...k, active: ns }));
    setSess(ns);
    setView('run');
    window.scrollTo(0, 0);
  };
  const resume = () => { setSess(active); setView('run'); };
  const discard = () => flushActive(kid.id);

  if (view === 'run' && sess) {
    return h(Runner, { kid, sess, sfx,
      onExit: () => { setView('menu'); setSess(null); window.scrollTo(0, 0); },
      onFinish: (rec, timeUp) => { setResult({ rec, timeUp }); setView('results'); window.scrollTo(0, 0); } });
  }
  if (view === 'results' && result) {
    return h(Results, { rec: result.rec, kid, timeUp: result.timeUp, sfx,
      onAgain: () => start(opts),
      onMenu: () => { setView('menu'); window.scrollTo(0, 0); },
      onFixMistakes: (ids) => start({ ids, len: ids.length }) });
  }

  const resumeCard = active && h('div', { className: 't2-card t2-resume', role: 'status' },
    h('p', null, h('b', null, mode === 'test' ? 'יֵשׁ מִבְחָן שֶׁלֹּא נִגְמַר' : 'יֵשׁ אִמּוּן שֶׁלֹּא נִגְמַר'), ` (${active.title}, ${Object.keys(active.answers || {}).length}/${active.qids.length})`),
    active.limitSec && h('p', { className: 't2-sub' }, 'הַשָּׁעוֹן מַמְשִׁיךְ לָרוּץ גַּם כְּשֶׁיּוֹצְאִים מֵהַמִּבְחָן.'),
    h('div', { className: 't2-row' }, h(Btn, { className: 'primary', onClick: resume }, 'לְהַמְשִׁיךְ'), h(Btn, { className: 'ghost', onClick: discard }, 'לְהַתְחִיל מֵחָדָשׁ')));

  if (mode === 'test') {
    const P = TEST_PLANS[opts.plan];
    return h('div', { className: 't2-menu' },
      h('h2', { className: 't2-h' }, '⏱️ מִבְחַן תִּרְגּוּל'),
      h('p', { className: 't2-sub' }, 'כְּמוֹ בְּמִבְחָן אֲמִתִּי: עוֹנִים עַל כָּל הַשְּׁאֵלוֹת, וְרַק בַּסּוֹף רוֹאִים מָה נָכוֹן וְקוֹרְאִים הֶסְבֵּר.'),
      resumeCard,
      h('div', { className: 't2-card' },
        h('div', { className: 't2-field' }, h('span', null, 'אֹרֶךְ'),
          h('div', { className: 't2-chips', role: 'group' }, Object.entries(TEST_PLANS).map(([k, v]) =>
            h(Btn, { key: k, className: 'chipb' + (opts.plan === k ? ' on' : ''), 'aria-pressed': opts.plan === k, onClick: () => setOpts({ ...opts, plan: k }) },
              k === 'full' ? 'מָלֵא' : 'קָצָר', h('small', null, `${v.n} שְׁאֵלוֹת`))))),
        h('div', { className: 't2-field' }, h('span', null, 'שָׁעוֹן'),
          h('div', { className: 't2-chips', role: 'group' },
            h(Btn, { className: 'chipb' + (opts.timed ? ' on' : ''), 'aria-pressed': opts.timed, onClick: () => setOpts({ ...opts, timed: true }) }, '⏱️ עִם שָׁעוֹן', h('small', null, `${P.minutes} דַּקּוֹת`)),
            h(Btn, { className: 'chipb' + (!opts.timed ? ' on' : ''), 'aria-pressed': !opts.timed, onClick: () => setOpts({ ...opts, timed: false }) }, '🐢 בְּלִי שָׁעוֹן', h('small', null, 'בְּקֶצֶב שֶׁלִּי')))),
        h('p', { className: 't2-sub' }, `בַּמִּבְחָן: ${P.reading === 1 ? 'קֶטַע קְרִיאָה אֶחָד' : P.reading + ' קִטְעֵי קְרִיאָה'}, חֶשְׁבּוֹן, בְּעָיוֹת מִלּוּלִיּוֹת וְסִדְרוֹת.`),
        h(Btn, { className: 'primary big', onClick: () => start(opts) }, 'מַתְחִילִים אֶת הַמִּבְחָן')),
      h('p', { className: 'note' }, 'להורה: הזמן כאן נועד לאימון בלבד ואינו הזמן הרשמי של המבחן. השאלות נכתבו בסגנון הדוגמאות הרשמיות, ואינן שאלות המבחן עצמו.'));
  }

  // practice menu
  const mistakesN = BANK.filter((x) => kd.att[x.id] && !kd.att[x.id].lastOk).length;
  const isReading = opts.type === 'reading';
  return h('div', { className: 't2-menu' },
    h('h2', { className: 't2-h' }, '💪 אִמּוּן'),
    resumeCard,
    skill && h('div', { className: 't2-card t2-skill' },
      h('p', null, 'נוֹשֵׂא מֻמְלָץ: ', h('b', null, SKILLS[skill])),
      h('div', { className: 't2-row' },
        h(Btn, { className: 'primary', onClick: () => start({ skill, len: 10 }) }, 'מַתְחִילִים'),
        h(Btn, { className: 'ghost', onClick: () => go('train') }, 'נוֹשֵׂא אַחֵר'))),
    h('div', { className: 't2-types', role: 'group', 'aria-label': 'מָה מְתַרְגְּלִים?' },
      [...TYPES, { id: 'mix', name: 'מְעֹרָב', icon: '🎲', cls: 'mix' }].map((t) => {
        const st = t.id === 'mix' ? null : typeStats(kd.att, t.id);
        return h('button', { key: t.id, type: 'button', className: 't2-type ' + t.cls + (opts.type === t.id ? ' on' : ''), 'aria-pressed': opts.type === t.id,
          onClick: () => setOpts({ ...opts, type: t.id, len: t.id === 'reading' ? 8 : opts.len === 8 || opts.len === 4 || opts.len === 12 ? 10 : opts.len }) },
          h('span', { className: 't2-type-i', 'aria-hidden': 'true' }, t.icon),
          h('span', { className: 't2-type-n' }, t.name),
          h('small', null, st ? (st.seen ? `${st.ok}/${st.seen} נְכוֹנוֹת` : `${st.total} שְׁאֵלוֹת`) : 'מִכָּל הַסּוּגִים'));
      })),
    h('div', { className: 't2-card' },
      !isReading && h('div', { className: 't2-field' }, h('span', null, 'רָמָה'),
        h('div', { className: 't2-chips', role: 'group' }, [['all', 'הַכֹּל'], ['1', 'קַל'], ['2', 'בֵּינוֹנִי'], ['3', 'מְאַתְגֵּר']].map(([v, l]) =>
          h(Btn, { key: v, className: 'chipb' + (opts.level === v ? ' on' : ''), 'aria-pressed': opts.level === v, onClick: () => setOpts({ ...opts, level: v }) }, l)))),
      h('div', { className: 't2-field' }, h('span', null, isReading ? 'כַּמָּה קְטָעִים?' : 'כַּמָּה שְׁאֵלוֹת?'),
        h('div', { className: 't2-chips', role: 'group' }, (isReading ? [[4, 'קֶטַע 1'], [8, '2 קְטָעִים'], [12, '3 קְטָעִים']] : [[5, '5'], [10, '10'], [15, '15']]).map(([v, l]) =>
          h(Btn, { key: v, className: 'chipb' + (opts.len === v ? ' on' : ''), 'aria-pressed': opts.len === v, onClick: () => setOpts({ ...opts, len: v }) }, l)))),
      h(Btn, { className: 'primary big', onClick: () => start(opts) }, 'מַתְחִילִים ←')),
    h('button', { type: 'button', className: 't2-card t2-mistakes', disabled: !mistakesN, onClick: () => start({ mistakes: true, len: 10 }) },
      h('span', { className: 't2-type-i', 'aria-hidden': 'true' }, '🔁'),
      h('span', null, h('b', null, 'תִּקּוּן טָעֻיּוֹת'), h('small', null, mistakesN ? `${mistakesN} שְׁאֵלוֹת לַחֲזֹר עֲלֵיהֶן` : 'אֵין טָעֻיּוֹת לְתַקֵּן. יָפֶה!'))),
    h('p', { className: 'note' }, 'להורה: באימון יש ניסיון שני אחרי טעות, עם רמז שמתאים לטעות. אחרי הניסיון השני מוצגים התשובה וההסבר.'));
}

// ------------------------------------------------------------------ parent report
function computeStats(kd) {
  const items = [];
  kd.sessions.forEach((s) => s.items.forEach((r) => items.push({ ...r, ts: s.started, mode: s.mode })));
  // a practice still in progress counts too
  activeItems(kd.active).forEach((r) => items.push({ ...r, ts: kd.active.started, mode: 'practice' }));
  const byType = {}, bySkill = {}, days = {};
  for (const r of items) {
    const it = BY_ID[r.id];
    if (!it) continue;
    (byType[it.type] = byType[it.type] || { n: 0, ok: 0, ms: 0 });
    byType[it.type].n++; byType[it.type].ok += r.firstOk ? 1 : 0; byType[it.type].ms += r.ms || 0;
    (bySkill[it.skill] = bySkill[it.skill] || { n: 0, ok: 0 });
    bySkill[it.skill].n++; bySkill[it.skill].ok += r.firstOk ? 1 : 0;
    days[dayKey(r.ts)] = (days[dayKey(r.ts)] || 0) + 1;
  }
  const ok = items.filter((r) => r.firstOk).length;
  const tests = kd.sessions.filter((s) => s.mode === 'test');
  const mistakes = [];
  const seenM = new Set();
  [...items].reverse().forEach((r) => { if (!r.firstOk && !seenM.has(r.id) && BY_ID[r.id]) { seenM.add(r.id); mistakes.push(r); } });
  return { items, ok, byType, bySkill, days, tests, mistakes };
}
function origSetsProgress() {
  try {
    const stars = JSON.parse(localStorage.getItem('ilai-stars.v1') || '{}');
    return ORIG_SET_ITEMS.map((ids, i) => ({ name: `סט ${i + 1}`, answered: ids.filter((id) => id in stars).length, ok: ids.filter((id) => stars[id]).length, total: ids.length }));
  } catch { return null; }
}
function Bar({ value, total, label, cls }) {
  const p = pct(value, total);
  return h('div', { className: 't2-pbarrow ' + (cls || '') },
    h('span', { className: 't2-pbl' }, label),
    h('span', { className: 't2-pbt', 'aria-hidden': 'true' }, h('i', { style: { width: p + '%' }, className: p >= 80 ? 'hi' : p >= 60 ? 'md' : 'lo' })),
    h('span', { className: 't2-pbv' }, total ? `${p}% (${value}/${total})` : '—'));
}
function Activity({ days }) {
  const list = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); list.push({ k: dayKey(d), d }); }
  const max = Math.max(1, ...list.map((x) => days[x.k] || 0));
  return h('div', { className: 't2-act', role: 'img', 'aria-label': 'שאלות ביום, 14 הימים האחרונים' },
    list.map(({ k, d }) => h('div', { key: k, className: 't2-act-c', title: `${d.toLocaleDateString('he-IL')}: ${days[k] || 0}` },
      h('i', { style: { height: Math.round(((days[k] || 0) / max) * 100) + '%' }, className: days[k] ? '' : 'z' }),
      h('span', null, d.getDate()))));
}
function ParentView() {
  const s = useStore();
  const [sel, setSel] = useState(s.current && s.current !== '__new' ? s.current : s.profiles[0] && s.profiles[0].id);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState(null); // a parsed backup waiting for "replace?" confirmation
  const fileRef = useRef(null);
  const kid = s.profiles.find((p) => p.id === sel) || s.profiles[0];
  const sets = origSetsProgress();

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `practice-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg('הקובץ נשמר.');
  };
  const importData = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      const d = JSON.parse(t);
      if (!d || !Array.isArray(d.profiles) || typeof d.kids !== 'object') throw new Error('bad');
      // restoring replaces everything on this device: ask first when there is something to lose
      if (state.profiles.length) { setPending(d); setMsg(''); return; }
      applyBackup(d);
    }).catch(() => setMsg('לא הצלחנו לקרוא את הקובץ. צריך קובץ שנשמר מכאן.'));
    e.target.value = '';
  };

  const applyBackup = (d) => {
    commit({ ...empty(), ...d });
    setSel(d.profiles[0] && d.profiles[0].id);
    setPending(null);
    setMsg('הנתונים נטענו.');
  };
  const confirmReplace = pending && h('div', { className: 't2-confirm', role: 'alertdialog', 'aria-label': 'החלפת הנתונים' },
    h('p', null, h('b', null, 'טעינת הגיבוי תחליף את כל הנתונים במכשיר.')),
    h('p', null, `יימחקו: ${state.profiles.map((p) => p.name).join(', ')}. ייטענו מהגיבוי: ${pending.profiles.map((p) => p.name).join(', ') || 'אין פרופילים'}.`),
    h('div', { className: 't2-row wrap' },
      h(Btn, { className: 'danger sm', onClick: () => applyBackup(pending) }, 'להחליף'),
      h(Btn, { className: 'ghost sm', onClick: () => { setPending(null); setMsg('הטעינה בוטלה. לא שונה דבר.'); } }, 'ביטול')));
  const header = h('div', { className: 't2-parent-h' },
    h('h2', { className: 't2-h' }, '👪 אזור הורים'),
    h('p', { className: 't2-sub' }, 'סיכום ההתקדמות באימון ובמבחנים. הנתונים נשמרים רק בדפדפן הזה, במכשיר הזה.'));
  if (!kid) {
    return h('div', { className: 't2-parent' }, header,
      h('div', { className: 't2-card' }, h('p', null, 'עדיין אין פרופיל. אפשר ליצור פרופיל לכל ילד, וכל אחד יקבל מעקב משלו.'),
        h(Btn, { className: 'primary', onClick: () => { commit({ ...state, current: '__new' }); go('train'); } }, '+ הוספת ילד/ה')),
      h('section', { className: 't2-card t2-tools no-print' }, h('h3', null, 'יש גיבוי ממכשיר אחר?'),
        h('div', { className: 't2-row wrap' },
          h(Btn, { className: 'ghost sm', onClick: () => fileRef.current && fileRef.current.click() }, '⬆️ טעינת גיבוי'),
          h('input', { ref: fileRef, type: 'file', accept: 'application/json,.json', hidden: true, onChange: importData })),
        msg && h('p', { className: 't2-sub', role: 'status' }, msg)),
      sets && h(SetsCard, { sets }));
  }
  const kd = kidData(s, kid.id);
  const st = computeStats(kd);
  const skills = Object.entries(st.bySkill).filter(([, v]) => v.n >= 3).map(([k, v]) => ({ k, ...v, p: pct(v.ok, v.n) })).sort((a, b) => a.p - b.p);
  const weak = skills.filter((x) => x.p < 70).slice(0, 3);
  const strong = [...skills].reverse().filter((x) => x.p >= 85).slice(0, 3);
  const lastTests = st.tests.slice(-8);
  const flagged = Object.keys(FLAGS);

  return h('div', { className: 't2-parent' }, header,
    s.profiles.length > 1 && h('div', { className: 't2-chips', role: 'group', 'aria-label': 'בחירת ילד' }, s.profiles.map((p) =>
      h(Btn, { key: p.id, className: 'chipb' + (p.id === kid.id ? ' on' : ''), 'aria-pressed': p.id === kid.id, onClick: () => { setSel(p.id); setEditing(false); } }, p.avatar + ' ' + p.name))),
    editing ? h(ProfileSetup, { existing: kid, onDone: () => setEditing(false) }) :
    h('div', { className: 't2-card t2-kidhead' },
      h('span', { className: 't2-av big', 'aria-hidden': 'true' }, kid.avatar),
      h('div', null, h('b', null, kid.name), h('div', { className: 't2-sub' }, 'מתרגל/ת מאז ', new Date(kid.created).toLocaleDateString('he-IL'))),
      h(Btn, { className: 'ghost sm', onClick: () => setEditing(true) }, 'עריכה')),
    h('div', { className: 't2-kpis' },
      h('div', { className: 't2-kpi' }, h('b', null, st.items.length), h('span', null, 'תשובות')),
      h('div', { className: 't2-kpi' }, h('b', null, st.items.length ? pct(st.ok, st.items.length) + '%' : '—'), h('span', null, 'נכון בניסיון הראשון')),
      h('div', { className: 't2-kpi' }, h('b', null, Object.keys(st.days).length), h('span', null, 'ימי תרגול')),
      h('div', { className: 't2-kpi' }, h('b', null, st.tests.length), h('span', null, 'מבחנים'))),
    !st.items.length && h('div', { className: 't2-card t2-empty' }, h('p', null, 'עוד אין נתונים. אחרי האימון או המבחן הראשון יופיע כאן סיכום.'),
      h('div', { className: 't2-row' }, h(Btn, { className: 'primary', onClick: () => { commit({ ...state, current: kid.id }); go('train'); } }, 'לאימון'), h(Btn, { className: 'ghost', onClick: () => { commit({ ...state, current: kid.id }); go('test'); } }, 'למבחן'))),
    st.items.length > 0 && h(Fragment, null,
      h('section', { className: 't2-card' }, h('h3', null, 'פעילות ב-14 הימים האחרונים'), h(Activity, { days: st.days })),
      h('section', { className: 't2-card' }, h('h3', null, 'לפי סוג שאלה'),
        TYPES.map((t) => { const v = st.byType[t.id] || { n: 0, ok: 0, ms: 0 };
          return h(Fragment, { key: t.id }, h(Bar, { value: v.ok, total: v.n, label: t.icon + ' ' + t.name.replace(/[֑-ׇ]/g, '') }),
            v.n > 0 && h('div', { className: 't2-sub t2-ms' }, (() => { const sec = Math.round(v.ms / v.n / 1000); return sec < 1 ? 'זמן ממוצע לשאלה: פחות משנייה' : `זמן ממוצע לשאלה: ${sec} שניות`; })())); })),
      h('section', { className: 't2-card' }, h('h3', null, 'מה הולך טוב ומה כדאי לחזק'),
        weak.length ? h('div', null, h('p', null, h('b', null, 'כדאי לחזק:')),
          weak.map((w) => h('div', { key: w.k, className: 't2-rec' }, h(Bar, { value: w.ok, total: w.n, label: SKILLS[w.k] || w.k }),
            h(Btn, { className: 'ghost sm', onClick: () => { commit({ ...state, current: kid.id }); go('train', { skill: w.k }); } }, 'לאימון בנושא')))) :
          h('p', { className: 't2-sub' }, skills.length ? 'אין נושא מתחת ל-70%. יפה!' : 'צריך לפחות 3 תשובות בנושא כדי להמליץ.'),
        strong.length > 0 && h('p', null, h('b', null, 'חזק: '), strong.map((x) => SKILLS[x.k] || x.k).join(' · ')),
        skills.length > 0 && h('details', null, h('summary', null, 'כל הנושאים'), skills.map((x) => h(Bar, { key: x.k, value: x.ok, total: x.n, label: SKILLS[x.k] || x.k })))),
      h('section', { className: 't2-card' }, h('h3', null, 'מבחנים'),
        !st.tests.length ? h('p', { className: 't2-sub' }, 'עוד לא נעשה מבחן.') : h(Fragment, null,
          h('div', { className: 't2-spark', role: 'img', 'aria-label': 'ציונים במבחנים האחרונים' }, lastTests.map((t) =>
            h('div', { key: t.id, className: 't2-spark-c' }, h('i', { style: { height: Math.max(4, pct(t.score, t.total)) + '%' } }), h('span', null, pct(t.score, t.total))))),
          h('table', { className: 't2-tbl' }, h('thead', null, h('tr', null, ['תאריך', 'סוג', 'ציון', 'זמן'].map((c) => h('th', { key: c }, c)))),
            h('tbody', null, [...st.tests].reverse().slice(0, 12).map((t) => h('tr', { key: t.id },
              h('td', null, fmtDate(t.started)),
              h('td', null, (t.plan === 'full' ? 'מלא' : 'קצר') + (t.timed ? ' · עם שעון' : ' · בלי שעון')),
              h('td', null, h('bdi', { dir: 'ltr' }, `${t.score}/${t.total}`), ` (${pct(t.score, t.total)}%)`),
              h('td', null, h('bdi', { dir: 'ltr' }, fmtTime((t.ended - t.started) / 1000)), t.limitSec ? h('span', { className: 't2-sub' }, ' / ' + fmtTime(t.limitSec)) : null))))))),
      h('section', { className: 't2-card' }, h('h3', null, 'טעויות אחרונות'),
        !st.mistakes.length ? h('p', { className: 't2-sub' }, 'אין טעויות. מצוין!') :
          st.mistakes.slice(0, 10).map((r) => { const it = BY_ID[r.id];
            const given = r.wrong && r.wrong.length ? r.wrong[0] : r.given;
            const show = (v) => (v === undefined || v === null || v === '' ? 'לא ענה/תה' : it.kind === 'mc' ? it.options[Number(v)] : String(v));
            return h('details', { key: r.id, className: 't2-mis' },
              h('summary', null, it.kind === 'num' ? h('bdi', { dir: 'ltr' }, it.q) : h(Bidi, null, it.q)),
              it.passage && h('p', { className: 't2-sub' }, 'מתוך הקטע: ', it.passage.title),
              h('p', null, 'ענה/תה: ', h('b', null, h(Bidi, null, show(given))), ' · נכון: ', h('b', null, h(Bidi, null, it.kind === 'mc' ? it.options[it.answer] : String(it.answer)))),
              h('p', { className: 't2-why' }, h(Bidi, null, it.why)));
          }))),
    sets && h(SetsCard, { sets }),
    h('section', { className: 't2-card' }, h('h3', null, 'על השאלות'),
      h('p', { className: 't2-sub' }, `במאגר ${BANK.length} שאלות: 98 מהסטים המקוריים, ${BANK.filter((x) => x.src === 'new').length} שאלות קריאה חדשות, ו-${BANK.filter((x) => x.src === 'gen').length} תרגילים, בעיות וסדרות שנוצרו לפי תבניות. כל מפתח תשובות נבדק בבדיקה אוטומטית נפרדת.`),
      flagged.length > 0 && h('div', null, h('p', null, h('b', null, 'שאלות שכדאי לעבור עליהן יחד:')),
        flagged.map((id) => BY_ID[id] && h('p', { key: id, className: 't2-flag' }, '⚠️ ', FLAGS[id])))),
    h('section', { className: 't2-card t2-tools no-print' }, h('h3', null, 'גיבוי וניהול'),
      h('div', { className: 't2-row wrap' },
        h(Btn, { className: 'ghost sm', onClick: () => window.print() }, '🖨️ הדפסת הדוח'),
        h(Btn, { className: 'ghost sm', onClick: exportData }, '⬇️ שמירת גיבוי'),
        h(Btn, { className: 'ghost sm', onClick: () => fileRef.current && fileRef.current.click() }, '⬆️ טעינת גיבוי'),
        h('input', { ref: fileRef, type: 'file', accept: 'application/json,.json', hidden: true, onChange: importData })),
      confirmReplace,
      h('div', { className: 't2-row wrap' },
        confirm === 'reset' ? h(Btn, { className: 'danger sm', onClick: () => { updateKid(kid.id, () => ({ att: {}, sessions: [], active: null })); setConfirm(null); setMsg('ההתקדמות אופסה.'); } }, `לאפס את ${kid.name}? לחצו שוב`)
          : h(Btn, { className: 'ghost sm', onClick: () => setConfirm('reset') }, 'איפוס ההתקדמות'),
        confirm === 'del' ? h(Btn, { className: 'danger sm', onClick: () => {
            const profiles = state.profiles.filter((p) => p.id !== kid.id); const kids = { ...state.kids }; delete kids[kid.id];
            commit({ ...state, profiles, kids, current: profiles[0] ? profiles[0].id : null }); setSel(profiles[0] && profiles[0].id); setConfirm(null); } }, `למחוק את ${kid.name}? לחצו שוב`)
          : h(Btn, { className: 'ghost sm', onClick: () => setConfirm('del') }, 'מחיקת הפרופיל')),
      msg && h('p', { className: 't2-sub', role: 'status' }, msg),
      !saveOk && h('p', { className: 't2-warn', role: 'alert' }, 'שמירה במכשיר אינה זמינה כרגע (אולי גלישה פרטית). ההתקדמות תישמר רק כל עוד הדף פתוח.')));
}
function SetsCard({ sets }) {
  return h('section', { className: 't2-card' }, h('h3', null, 'הסטים המקוריים'),
    h('p', { className: 't2-sub' }, 'כוכבים מהסטים נשמרים פעם אחת לכל המכשיר (לא לפי ילד).'),
    sets.map((x) => h(Bar, { key: x.name, value: x.ok, total: x.answered, label: `${x.name} · ענה ${x.answered}/${x.total}` })));
}

// ------------------------------------------------------------------ shell
const NAV = [
  { id: 'sets', label: 'סֵטִים', icon: '🎒' },
  { id: 'train', label: 'אִמּוּן', icon: '💪' },
  { id: 'test', label: 'מִבְחָן', icon: '⏱️' },
  { id: 'parent', label: 'הוֹרִים', icon: '👪' },
];
export function Shell({ Sets, sfx }) {
  const [route, setRoute] = useState(parseHash);
  const scrolls = useRef({});
  const prevTab = useRef(route.tab);
  useEffect(() => {
    const f = () => setRoute(parseHash());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  useEffect(() => {
    if (prevTab.current !== route.tab) {
      const y = scrolls.current[route.tab] || 0;
      prevTab.current = route.tab;
      requestAnimationFrame(() => window.scrollTo(0, route.tab === 'sets' ? y : 0));
    }
  }, [route.tab]);
  const nav = (id) => { scrolls.current[route.tab] = window.scrollY; go(id); };
  const { s, kid } = useKid();
  const needKid = (route.tab === 'train' || route.tab === 'test') && (!kid || s.current === '__new');

  return h(Fragment, null,
    h('div', { hidden: route.tab !== 'sets' }, h(Sets)),
    route.tab !== 'sets' && h('main', { className: 'practice-page t2', dir: 'rtl', lang: 'he' },
      h('h1', { className: 'sr' }, (NAV.find((n) => n.id === route.tab) || NAV[0]).label),
      needKid ? h(ProfileSetup, null)
      : route.tab === 'parent' ? h(ParentView)
      : h(Fragment, null, h(ProfileBar, { s, kid }), h(Session, { key: route.tab + kid.id, kid, mode: route.tab === 'test' ? 'test' : 'practice', params: route.params, sfx }))),
    h('nav', { className: 't2-tabbar no-print', 'aria-label': 'נִיוּוּט' }, NAV.map((n) =>
      h('button', { key: n.id, type: 'button', className: 't2-tab' + (route.tab === n.id ? ' on' : ''), 'aria-current': route.tab === n.id ? 'page' : undefined, onClick: () => nav(n.id) },
        h('span', { className: 't2-tab-i', 'aria-hidden': 'true' }, n.icon), h('span', null, n.label)))));
}
