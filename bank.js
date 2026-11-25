// Question bank for the "אימון" and "מבחן" areas.
//
// Readable source (not minified). Everything here is deterministic: the same
// seed always yields the same questions and ids, so progress saved on the
// device keeps pointing at the same items.
//
// Item shape:
//   { id, type: 'calc'|'word'|'series'|'reading', kind: 'num'|'mc',
//     q, answer, options?, hints?, why, skill, level: 1|2|3,
//     passage?: {id,title,lines}, src: 'orig'|'gen'|'new', flag? }
// `answer` is the number for kind 'num', and the option index for kind 'mc'.
// `hints[i]` (optional) explains a specific wrong option.
// `flag` marks an item a parent should double-check (ambiguous wording etc).
//
// Answers of generated items are computed, then re-checked independently by
// tools/verify-bank.mjs (run: node tools/verify-bank.mjs).

import * as D from './data-BLFTfogW.js';

// ---------- small helpers ----------
function rng(seed) {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(20261125);
const int = (lo, hi) => lo + Math.floor(R() * (hi - lo + 1));
const pick = (arr) => arr[Math.floor(R() * arr.length)];
const pad = (n) => String(n).padStart(3, '0');
const MINUS = '−';
const BLANK = '___';

// Hebrew prefix "וְ" / "וּ" before a word (וּ before ב,ו,מ,פ).
const bare = (w) => w.replace(/[֑-ׇ]/g, '');
const vav = (w) => (/^[במפ]/.test(bare(w)) ? 'וּ' : 'וְ') + w;

// Multiple-choice options: answer + distractors (each {v, hint}), unique,
// positive, sorted ascending like the original sets.
function mcNumeric(answer, distractors) {
  const seen = new Set([answer]);
  const opts = [{ v: answer, hint: null }];
  for (const d of distractors) {
    if (opts.length === 4) break;
    if (d.v > 0 && Number.isInteger(d.v) && !seen.has(d.v)) {
      seen.add(d.v);
      opts.push(d);
    }
  }
  // pad with near values if we still need options
  let k = 1;
  while (opts.length < 4) {
    for (const v of [answer + k, answer - k]) {
      if (opts.length < 4 && v > 0 && !seen.has(v)) {
        seen.add(v);
        opts.push({ v, hint: HINT.calc });
      }
    }
    k++;
  }
  opts.sort((a, b) => a.v - b.v);
  return {
    options: opts.map((o) => String(o.v)),
    answer: opts.findIndex((o) => o.v === answer),
    hints: opts.map((o) => o.hint),
  };
}

// Generic, gender-neutral hints for wrong options ("we" form, like the
// original explanations: "הוֹרַדְנוּ קְצָת יוֹתֵר מִדַּי").
const HINT = {
  onestep: 'זֶה רַק הַשָּׁלָב הָרִאשׁוֹן. צָרִיךְ לַעֲשׂוֹת עוֹד שָׁלָב.',
  wrongop: 'כְּדַאי לִקְרֹא שׁוּב: צָרִיךְ לְהוֹסִיף אוֹ לְהוֹרִיד?',
  tens: 'כִּמְעַט! כְּדַאי לִבְדֹּק שׁוּב אֶת הָעֲשָׂרוֹת.',
  calc: 'קָרוֹב מְאֹד! כְּדַאי לִבְדֹּק שׁוּב אֶת הַחֶשְׁבּוֹן.',
  sumall: 'חִבַּרְנוּ אֶת כָּל הַמִּסְפָּרִים, אֲבָל לֹא בְּכָל מָקוֹם צָרִיךְ לְחַבֵּר.',
  groups: 'כָּאן יֵשׁ קְבוּצוֹת שָׁווֹת, אָז כְּדַאי לְהַכְפִּיל.',
  count: 'כִּמְעַט! כְּדַאי לִסְפֹּר שׁוּב כַּמָּה קְבוּצוֹת יֵשׁ.',
};

// ---------- explanations for arithmetic ----------
function whyAdd(a, b) {
  const t = b - (b % 10), o = b % 10;
  if (t === 0 || o === 0) return `${a} + ${b} = ${a + b}.`;
  return `${a} + ${t} = ${a + t}, וְעוֹד ${o} זֶה ${a + b}.`;
}
function whySub(a, b) {
  const t = b - (b % 10), o = b % 10;
  if (t === 0 || o === 0) return `${a} ${MINUS} ${b} = ${a - b}.`;
  return `קֹדֶם מוֹרִידִים ${t}: ${a} ${MINUS} ${t} = ${a - t}. אַחַר כָּךְ מוֹרִידִים עוֹד ${o}: ${a - t} ${MINUS} ${o} = ${a - b}.`;
}
function whyGap(lo, hi) {
  // how much from lo up to hi, bridging through the next ten
  const up = Math.ceil(lo / 10) * 10;
  if (lo % 10 === 0 || up >= hi) return `מִ-${lo} עַד ${hi} יֵשׁ ${hi - lo}.`;
  return `מִ-${lo} עַד ${up} זֶה ${up - lo}, וּמִ-${up} עַד ${hi} זֶה ${hi - up}. בְּסַךְ הַכֹּל ${hi - lo}.`;
}
function jumps(step, times) {
  const list = Array.from({ length: times }, (_, i) => step * (i + 1));
  return `סוֹפְרִים בִּקְפִיצוֹת שֶׁל ${step}: ${list.join(', ')}.`;
}

// ---------- generated: calc (missing number) ----------
function genCalc() {
  const out = [];
  const seen = new Set();
  const add = (skill, level, q, answer, why) => {
    if (seen.has(q)) return false;
    seen.add(q);
    out.push({ id: `g-calc-${pad(out.length + 1)}`, type: 'calc', kind: 'num', q, answer, why, skill, level, src: 'gen' });
    return true;
  };
  const N = (fn, n) => { let made = 0, guard = 0; while (made < n && guard++ < 2000) if (fn()) made++; };

  // a + b = ___ (no carry → level 1, with carry → level 2)
  N(() => { const a = int(11, 68), b = int(11, 30); if ((a % 10) + (b % 10) >= 10 || a + b > 99) return false;
    return add('add', 1, `${a} + ${b} = ${BLANK}`, a + b, whyAdd(a, b)); }, 12);
  N(() => { const a = int(15, 69), b = int(12, 39); if ((a % 10) + (b % 10) < 10 || a + b > 99) return false;
    return add('add', 2, `${a} + ${b} = ${BLANK}`, a + b, whyAdd(a, b)); }, 16);
  // a − b = ___
  N(() => { const a = int(35, 99), b = int(11, a - 10); if ((a % 10) < (b % 10)) return false;
    return add('sub', 1, `${a} ${MINUS} ${b} = ${BLANK}`, a - b, whySub(a, b)); }, 12);
  N(() => { const a = int(41, 99), b = int(12, a - 10); if ((a % 10) >= (b % 10)) return false;
    return add('sub', 2, `${a} ${MINUS} ${b} = ${BLANK}`, a - b, whySub(a, b)); }, 16);
  // a + ___ = c  and ___ + b = c
  N(() => { const a = int(12, 70), c = int(a + 8, 99);
    const first = R() < 0.5;
    const q = first ? `${BLANK} + ${a} = ${c}` : `${a} + ${BLANK} = ${c}`;
    return add('missing', 2, q, c - a, `כַּמָּה חָסֵר מִ-${a} עַד ${c}? ${whyGap(a, c)}`); }, 16);
  // a − ___ = c
  N(() => { const a = int(40, 100), c = int(10, a - 8);
    return add('missing', 2, `${a} ${MINUS} ${BLANK} = ${c}`, a - c,
      `כַּמָּה צָרִיךְ לְהוֹרִיד מִ-${a} כְּדֵי לְהַגִּיעַ לְ-${c}? ${whyGap(c, a)}`); }, 14);
  // ___ − b = c  (level 3: the unknown is the starting number)
  N(() => { const b = int(11, 45), c = int(10, 99 - b);
    return add('missing', 3, `${BLANK} ${MINUS} ${b} = ${c}`, b + c,
      `אִם מוֹרִידִים ${b} וּמְקַבְּלִים ${c}, אָז הַמִּסְפָּר הוּא ${c} + ${b} = ${b + c}.`); }, 12);
  // multiplication
  N(() => { const a = pick([2, 5, 10]), b = int(2, 10);
    return add('mul', 1, `${a} × ${b} = ${BLANK}`, a * b, `${jumps(a, b)} זֶה ${a * b}.`); }, 10);
  N(() => { const a = int(3, 9), b = int(3, 9);
    return add('mul', 2, `${a} × ${BLANK} = ${a * b}`, b, `${jumps(a, b)} זֶה ${b} קְפִיצוֹת.`); }, 16);
  N(() => { const a = int(3, 9), b = int(3, 9);
    return add('mul', 3, `${BLANK} × ${a} = ${a * b}`, b, `${jumps(a, b)} זֶה ${b} קְפִיצוֹת, לָכֵן ${b} × ${a} = ${a * b}.`); }, 8);
  // division
  N(() => { const a = int(2, 9), q = int(2, 9);
    return add('div', 3, `${a * q} ÷ ${a} = ${BLANK}`, q,
      `מְחַלְּקִים ${a * q} לְ-${a} קְבוּצוֹת שָׁווֹת. ${a} × ${q} = ${a * q}, לָכֵן בְּכָל קְבוּצָה ${q}.`); }, 12);
  // three terms
  N(() => { const a = int(12, 45), b = int(8, 30), c = int(5, Math.min(40, a + b - 5)); const r = a + b - c;
    return add('three', 3, `${a} + ${b} ${MINUS} ${c} = ${BLANK}`, r,
      `קֹדֶם ${a} + ${b} = ${a + b}. אַחַר כָּךְ ${a + b} ${MINUS} ${c} = ${r}.`); }, 12);
  return out;
}

// ---------- generated: series ----------
// Each family returns the full sequence; one position is blanked.
function seriesWhy(fam, seq, blankIdx) {
  const prev = seq[blankIdx - 1], val = seq[blankIdx];
  const d = seq[1] - seq[0];
  if (fam === 'arith') return d > 0
    ? `כָּל פַּעַם מוֹסִיפִים ${d}. אַחֲרֵי ${prev} בָּא ${val}.`
    : `כָּל פַּעַם מוֹרִידִים ${-d}. אַחֲרֵי ${prev} בָּא ${val}.`;
  if (fam === 'alt') {
    const d1 = seq[1] - seq[0], d2 = seq[2] - seq[1];
    const w = (x) => (x > 0 ? `מוֹסִיפִים ${x}` : `מוֹרִידִים ${-x}`);
    const step = val - prev;
    return `קֹדֶם ${w(d1)}, אַחַר כָּךְ ${w(d2)}, וְכָךְ חוֹזֵר חֲלִילָה. אַחֲרֵי ${prev} ${w(step)} וּמְקַבְּלִים ${val}.`;
  }
  if (fam === 'grow') {
    const ds = seq.slice(1).map((x, i) => x - seq[i]);
    return `מוֹסִיפִים ${ds.slice(0, -1).join(', ')}... כָּל פַּעַם מוֹסִיפִים 1 יוֹתֵר. אַחֲרֵי ${prev} מוֹסִיפִים ${val - prev} וּמְקַבְּלִים ${val}.`;
  }
  if (fam === 'double') return `כָּל מִסְפָּר הוּא פִּי 2 מֵהַמִּסְפָּר שֶׁלְּפָנָיו. אַחֲרֵי ${prev} בָּא ${val}.`;
  return '';
}
function genSeries() {
  const out = [];
  const seen = new Set();
  const make = (fam, level, seq, blankIdx) => {
    if (seq.some((x) => x < 0 || x > 200)) return false;
    const q = seq.map((x, i) => (i === blankIdx ? BLANK : String(x))).join(', ');
    if (seen.has(q)) return false;
    seen.add(q);
    out.push({ id: `g-ser-${pad(out.length + 1)}`, type: 'series', kind: 'num', q, answer: seq[blankIdx],
      why: seriesWhy(fam, seq, blankIdx), skill: 'ser-' + fam, level, src: 'gen' });
    return true;
  };
  const N = (fn, n) => { let made = 0, guard = 0; while (made < n && guard++ < 3000) if (fn()) made++; };
  // + k, blank at the end (5 shown) or in the middle (like "50, 45, 40, ___, 30")
  N(() => { const d = int(2, 10), s = int(1, 30); const seq = [0, 1, 2, 3, 4].map((i) => s + i * d);
    return make('arith', d <= 5 ? 1 : 2, seq, R() < 0.6 ? 4 : 3); }, 16);
  N(() => { const d = int(2, 10), s = int(4 * d + 5, 100); const seq = [0, 1, 2, 3, 4].map((i) => s - i * d);
    return make('arith', d <= 5 ? 1 : 2, seq, R() < 0.5 ? 4 : 3); }, 14);
  N(() => { const d = pick([11, 12, 15, 20, 25]), s = int(0, 20); const seq = [0, 1, 2, 3, 4].map((i) => s + i * d);
    return make('arith', 3, seq, 4); }, 6);
  // alternating steps: +a −b, or +a +b (6 terms, blank last)
  N(() => { const a = int(2, 5), b = int(1, a - 1), s = int(1, 20); const seq = [s];
    for (let i = 1; i < 6; i++) seq.push(seq[i - 1] + (i % 2 ? a : -b));
    return make('alt', 2, seq, 5); }, 12);
  N(() => { const a = int(1, 4), b = int(a + 1, 6), s = int(1, 15); const seq = [s];
    for (let i = 1; i < 6; i++) seq.push(seq[i - 1] + (i % 2 ? a : b));
    return make('alt', 2, seq, 5); }, 10);
  // growing differences: +d0, +d0+1, ... (5 terms, blank last)
  N(() => { const d0 = int(1, 4), s = int(1, 12); const seq = [s];
    for (let i = 1; i < 5; i++) seq.push(seq[i - 1] + d0 + i - 1);
    // skip sequences that also read as "add the two previous numbers" (2, 3, 5, 8 → 12 or 13?)
    if (seq[2] === seq[0] + seq[1] && seq[3] === seq[1] + seq[2]) return false;
    return make('grow', 3, seq, 4); }, 8);
  // doubling (5 terms, blank last)
  N(() => { const s = int(1, 6); const seq = [0, 1, 2, 3, 4].map((i) => s * 2 ** i);
    return make('double', 3, seq, 4); }, 5);
  return out;
}

// ---------- generated: word problems ----------
const BOYS = [
  { n: 'אֵיתָן', g: 'm' }, { n: 'עוֹמֶר', g: 'm' }, { n: 'יוֹנָתָן', g: 'm' },
  { n: 'אָרִי', g: 'm' }, { n: 'רוֹעִי', g: 'm' }, { n: 'אוֹרִי', g: 'm' },
];
const GIRLS = [
  { n: 'מִיכַל', g: 'f' }, { n: 'שִׁירָה', g: 'f' }, { n: 'נוֹגָה', g: 'f' },
  { n: 'יָעֵל', g: 'f' }, { n: 'הִלָּה', g: 'f' }, { n: 'מַאיָה', g: 'f' },
];
const KID = () => pick(R() < 0.5 ? BOYS : GIRLS);
const G = (k, m, f) => (k.g === 'm' ? m : f);
// countable things (plural, with grammatical gender for מֵהֶם/מֵהֶן)
const THINGS = [
  { p: 'מַדְבֵּקוֹת', g: 'f' }, { p: 'גֻּלּוֹת', g: 'f' }, { p: 'קְלָפִים', g: 'm' },
  { p: 'עֶפְרוֹנוֹת', g: 'm' }, { p: 'סֻכָּרִיּוֹת', g: 'f' }, { p: 'צְדָפִים', g: 'm' },
  { p: 'בַּלּוֹנִים', g: 'm' }, { p: 'אֲבָנִים', g: 'f' },
];
const BOXES = [
  { s: 'קֻפְסָה', p: 'קֻפְסָאוֹת' }, { s: 'שַׂקִּית', p: 'שַׂקִּיּוֹת' }, { s: 'סַל', p: 'סַלִּים' },
];

const WORD_TEMPLATES = [
  // T1: two steps, get then give
  () => { const k = KID(), t = pick(THINGS), a = int(12, 45), b = int(5, 25), c = int(5, a - 2); const r = a + b - c;
    return { skill: 'twostep', level: 2, answer: r,
      q: `לְ${k.n} הָיוּ ${a} ${t.p}. ${k.n} ${G(k, 'קִבֵּל', 'קִבְּלָה')} עוֹד ${b} ${G(k, 'וְנָתַן', 'וְנָתְנָה')} ${c} לְחָבֵר. כַּמָּה ${t.p} יֵשׁ לְ${k.n} עַכְשָׁו?`,
      why: `קֹדֶם ${a} + ${b} = ${a + b}. אַחַר כָּךְ ${a + b} ${MINUS} ${c} = ${r}.`,
      d: [{ v: a + b, hint: HINT.onestep }, { v: a + b + c, hint: HINT.sumall }, { v: a - b + c, hint: HINT.wrongop }, { v: r + 10, hint: HINT.tens }] }; },
  // T2: equal groups
  () => { const t = pick(THINGS), bx = pick(BOXES), a = int(3, 9), b = int(3, 9);
    return { skill: 'groups', level: 2, answer: a * b,
      q: `בְּכָל ${bx.s} יֵשׁ ${a} ${t.p}. יֵשׁ ${b} ${bx.p}. כַּמָּה ${t.p} יֵשׁ בְּסַךְ הַכֹּל?`,
      why: `יֵשׁ ${b} קְבוּצוֹת שֶׁל ${a}. ${b} × ${a} = ${a * b}.`,
      d: [{ v: a + b, hint: HINT.groups }, { v: a * b - a, hint: HINT.count }, { v: a * b + a, hint: HINT.count }, { v: a * b + 10, hint: HINT.tens }] }; },
  // T3: fair sharing
  () => { const t = pick(THINGS), a = int(2, 6), q = int(3, 9), c = a * q;
    return { skill: 'share', level: 2, answer: q,
      q: `מְחַלְּקִים ${c} ${t.p} שָׁוֶה בְּשָׁוֶה בֵּין ${a} יְלָדִים. כַּמָּה ${t.p} יְקַבֵּל כָּל יֶלֶד?`,
      why: `מְחַלְּקִים ${c} לְ-${a} קְבוּצוֹת. ${a} × ${q} = ${c}, לָכֵן כָּל יֶלֶד מְקַבֵּל ${q}.`,
      d: [{ v: c - a, hint: HINT.wrongop }, { v: q + 1, hint: HINT.calc }, { v: q - 1, hint: HINT.calc }, { v: c + a, hint: HINT.wrongop }] }; },
  // T4: how many boxes
  () => { const t = pick(THINGS), bx = pick(BOXES), a = int(3, 9), q = int(3, 9), c = a * q;
    return { skill: 'share', level: 2, answer: q,
      q: `יֵשׁ ${c} ${t.p}. שָׂמִים ${a} ${t.p} בְּכָל ${bx.s}. כַּמָּה ${bx.p} צָרִיךְ?`,
      why: `מְחַלְּקִים ${c} לִקְבוּצוֹת שֶׁל ${a}. ${a} × ${q} = ${c}, לָכֵן צָרִיךְ ${q} ${bx.p}.`,
      d: [{ v: c - a, hint: HINT.wrongop }, { v: q + 1, hint: HINT.calc }, { v: q - 1, hint: HINT.calc }, { v: a + q, hint: HINT.calc }] }; },
  // T5: compare
  () => { const k1 = pick(BOYS), k2 = pick(GIRLS), [x, y] = R() < 0.5 ? [k1, k2] : [k2, k1], t = pick(THINGS);
    const a = int(25, 70), b = int(11, a - 6), r = a - b;
    return { skill: 'compare', level: 2, answer: r,
      q: `${x.n} ${G(x, 'אָסַף', 'אָסְפָה')} ${a} ${t.p}, ${vav(y.n)} ${G(y, 'אָסַף', 'אָסְפָה')} ${b} ${t.p}. כַּמָּה ${t.p} יוֹתֵר ${G(x, 'אָסַף', 'אָסְפָה')} ${x.n}?`,
      why: `מְחַשְּׁבִים אֶת הַהֶפְרֵשׁ: ${a} ${MINUS} ${b} = ${r}. ${whyGap(b, a)}`,
      d: [{ v: a + b, hint: HINT.wrongop }, { v: r + 10, hint: HINT.tens }, { v: r - 10, hint: HINT.tens }, { v: r + 1, hint: HINT.calc }] }; },
  // T6: money, two purchases
  () => { const k = KID(); const items = [['סֵפֶר', 'וְסֵפֶר'], ['מַחְבֶּרֶת', 'וּמַחְבֶּרֶת'], ['עִפָּרוֹן', 'וְעִפָּרוֹן']];
    const [i1, i2] = R() < 0.5 ? [items[0], R() < 0.5 ? items[1] : items[2]] : [items[1], R() < 0.5 ? items[0] : items[2]];
    const m = pick([30, 40, 50, 60, 70, 80, 100]), p1 = int(8, Math.floor(m / 2)), p2 = int(3, Math.min(20, m - p1 - 2)); const r = m - p1 - p2;
    return { skill: 'money', level: 3, answer: r,
      q: `לְ${k.n} הָיוּ ${m} שְׁקָלִים. ${k.n} ${G(k, 'קָנָה', 'קָנְתָה')} ${i1[0]} בְּ-${p1} שְׁקָלִים ${i2[1]} בְּ-${p2} שְׁקָלִים. כַּמָּה כֶּסֶף נִשְׁאַר לְ${k.n}?`,
      why: `${k.n} ${G(k, 'הוֹצִיא', 'הוֹצִיאָה')} ${p1} + ${p2} = ${p1 + p2}. אָז ${m} ${MINUS} ${p1 + p2} = ${r}.`,
      d: [{ v: p1 + p2, hint: HINT.onestep }, { v: m - p1, hint: HINT.onestep }, { v: m - p1 + p2, hint: HINT.wrongop }, { v: r + 10, hint: HINT.tens }] }; },
  // T7: bus
  () => { const a = int(12, 40), b = int(3, a - 4), c = int(3, 20); const r = a - b + c;
    return { skill: 'twostep', level: 2, answer: r,
      q: `בָּאוֹטוֹבּוּס הָיוּ ${a} נוֹסְעִים. בַּתַּחֲנָה יָרְדוּ ${b} וְעָלוּ ${c}. כַּמָּה נוֹסְעִים יֵשׁ עַכְשָׁו?`,
      why: `קֹדֶם ${a} ${MINUS} ${b} = ${a - b}. אַחַר כָּךְ ${a - b} + ${c} = ${r}.`,
      d: [{ v: a - b, hint: HINT.onestep }, { v: a + b + c, hint: HINT.sumall }, { v: a + b - c, hint: HINT.wrongop }, { v: r + 10, hint: HINT.tens }] }; },
  // T8: legs (gifted-style)
  () => { const a = int(2, 7), b = int(2, 6); const r = 2 * a + 4 * b;
    return { skill: 'logic', level: 3, answer: r,
      q: `בֶּחָצֵר יֵשׁ ${a} תַּרְנְגוֹלוֹת וְ-${b} כְּלָבִים. כַּמָּה רַגְלַיִם יֵשׁ לְכֻלָּם בְּיַחַד?`,
      why: `לְכָל תַּרְנְגֹלֶת 2 רַגְלַיִם: ${a} × 2 = ${2 * a}. לְכָל כֶּלֶב 4 רַגְלַיִם: ${b} × 4 = ${4 * b}. בְּיַחַד ${2 * a} + ${4 * b} = ${r}.`,
      d: [{ v: a + b, hint: 'סָפַרְנוּ אֶת הַחַיּוֹת, אֲבָל הַשְּׁאֵלָה הִיא עַל רַגְלַיִם.' },
        { v: 4 * (a + b), hint: 'לְתַרְנְגֹלֶת יֵשׁ רַק 2 רַגְלַיִם.' },
        { v: 2 * (a + b), hint: 'לְכֶלֶב יֵשׁ 4 רַגְלַיִם.' }] }; },
  // T9: ages
  () => { const k = KID(), a = int(6, 9), b = int(2, 6), c = int(2, 5); const r = a + b + c;
    return { skill: 'logic', level: 3, answer: r,
      q: `${k.n} ${G(k, 'בֶּן', 'בַּת')} ${a}. הָאָח שֶׁל ${k.n} גָּדוֹל ${G(k, 'מִמֶּנּוּ', 'מִמֶּנָּה')} בְּ-${b} שָׁנִים. בֶּן כַּמָּה יִהְיֶה הָאָח בְּעוֹד ${c} שָׁנִים?`,
      why: `עַכְשָׁו הָאָח בֶּן ${a} + ${b} = ${a + b}. בְּעוֹד ${c} שָׁנִים הוּא יִהְיֶה בֶּן ${a + b} + ${c} = ${r}.`,
      d: [{ v: a + b, hint: 'זֶה הַגִּיל שֶׁל הָאָח עַכְשָׁו. מָה יִהְיֶה בְּעוֹד כַּמָּה שָׁנִים?' },
        { v: a + c, hint: `זֶה הַגִּיל שֶׁל ${k.n}, לֹא שֶׁל הָאָח.` }, { v: a + b - c, hint: HINT.wrongop }] }; },
  // T10: seats
  () => { const r0 = int(3, 6), s = int(4, 9), t = int(5, r0 * s - 3); const r = r0 * s - t;
    return { skill: 'twostep', level: 3, answer: r,
      q: `בָּאוּלָם יֵשׁ ${r0} שׁוּרוֹת, וּבְכָל שׁוּרָה ${s} כִּסְאוֹת. ${t} כִּסְאוֹת תְּפוּסִים. כַּמָּה כִּסְאוֹת פְּנוּיִים?`,
      why: `קֹדֶם ${r0} × ${s} = ${r0 * s} כִּסְאוֹת. אַחַר כָּךְ ${r0 * s} ${MINUS} ${t} = ${r}.`,
      d: [{ v: r0 * s, hint: HINT.onestep }, { v: r0 + s, hint: HINT.groups }, { v: r + 10, hint: HINT.tens }, { v: r + s, hint: HINT.count }] }; },
  // T11: half
  () => { const k = KID(), t = pick(THINGS), a = int(4, 30); const c = 2 * a;
    return { skill: 'share', level: 2, answer: a,
      q: `לְ${k.n} הָיוּ ${c} ${t.p}. ${k.n} ${G(k, 'נָתַן', 'נָתְנָה')} חֲצִי ${t.g === 'm' ? 'מֵהֶם' : 'מֵהֶן'} לְחָבֵר. כַּמָּה ${t.p} נִשְׁאֲרוּ לְ${k.n}?`,
      why: `חֲצִי מִ-${c} זֶה ${a}, כִּי ${a} + ${a} = ${c}.`,
      d: [{ v: c - 2, hint: 'חֲצִי זֶה לְחַלֵּק לִשְׁנֵי חֲלָקִים שָׁוִים.' }, { v: c + a, hint: HINT.wrongop }, { v: a + 2, hint: HINT.calc }, { v: a - 2, hint: HINT.calc }] }; },
  // T12: part of a class
  () => { const tot = int(20, 34), g = int(8, tot - 8); const r = tot - g;
    return { skill: 'compare', level: 1, answer: r,
      q: `בַּכִּתָּה יֵשׁ ${tot} יְלָדִים. ${g} מֵהֶם בָּנוֹת. כַּמָּה בָּנִים יֵשׁ בַּכִּתָּה?`,
      why: `${tot} ${MINUS} ${g} = ${r}. ${whyGap(g, tot)}`,
      d: [{ v: tot + g, hint: HINT.wrongop }, { v: r + 10, hint: HINT.tens }, { v: r + 1, hint: HINT.calc }, { v: r - 1, hint: HINT.calc }] }; },
  // T13: groups plus extra
  () => { const t = pick(THINGS), bx = pick(BOXES), a = int(3, 9), b = int(3, 8), c = int(2, 9); const r = a * b + c;
    return { skill: 'groups', level: 3, answer: r,
      q: `בְּכָל ${bx.s} יֵשׁ ${a} ${t.p}. יֵשׁ ${b} ${bx.p} וְעוֹד ${c} ${t.p} בְּנִפְרָד. כַּמָּה ${t.p} יֵשׁ בְּסַךְ הַכֹּל?`,
      why: `${b} ${bx.p} × ${a} = ${a * b}. מוֹסִיפִים עוֹד ${c}: ${a * b} + ${c} = ${r}.`,
      d: [{ v: a * b, hint: HINT.onestep }, { v: a + b + c, hint: HINT.groups }, { v: r + 10, hint: HINT.tens }, { v: r - c - c, hint: HINT.calc }] }; },
  // T14: "more than" then total (gifted-style)
  () => { const k1 = KID(); let k2 = KID(); while (k2.n === k1.n) k2 = KID(); const t = pick(THINGS);
    const a = int(8, 30), b = int(3, 15); const r = 2 * a + b;
    return { skill: 'logic', level: 3, answer: r,
      q: `לְ${k1.n} יֵשׁ ${a} ${t.p}. לְ${k2.n} יֵשׁ ${b} ${t.p} יוֹתֵר מִמָּה שֶׁיֵּשׁ לְ${k1.n}. כַּמָּה ${t.p} יֵשׁ ${k1.g === 'f' && k2.g === 'f' ? 'לִשְׁתֵּיהֶן' : 'לִשְׁנֵיהֶם'} בְּיַחַד?`,
      why: `לְ${k2.n} יֵשׁ ${a} + ${b} = ${a + b}. בְּיַחַד: ${a} + ${a + b} = ${r}.`,
      d: [{ v: a + b, hint: `זֶה רַק כַּמָּה יֵשׁ לְ${k2.n}. צָרִיךְ גַּם לְהוֹסִיף אֶת מָה שֶׁיֵּשׁ לְ${k1.n}.` },
        { v: a + b + b, hint: HINT.calc }, { v: r + 10, hint: HINT.tens }] }; },
];

function genWords() {
  const out = [];
  const seen = new Set();
  WORD_TEMPLATES.forEach((tpl, ti) => {
    let made = 0, guard = 0;
    while (made < 9 && guard++ < 500) {
      const w = tpl();
      if (seen.has(w.q) || !(w.answer > 0)) continue;
      seen.add(w.q);
      const mc = mcNumeric(w.answer, w.d);
      out.push({ id: `g-word-${pad(out.length + 1)}`, type: 'word', kind: 'mc', q: w.q, ...mc,
        why: w.why, skill: w.skill, level: w.level, src: 'gen', tpl: ti + 1 });
      made++;
    }
  });
  return out;
}

// ---------- new reading passages (hand-written) ----------
// skill: detail (פרט מהטקסט), vocab (אוצר מילים), infer (הסקה), main (רעיון מרכזי), order (סדר)
const NEW_PASSAGES = [
  { id: 'p-dolphin', title: 'הַדּוֹלְפִין', lines: [
    'הַדּוֹלְפִין חַי בַּיָּם, אֲבָל הוּא לֹא דָּג.',
    'הוּא יוֹנֵק, וְהוּא צָרִיךְ לַעֲלוֹת אֶל פְּנֵי הַמַּיִם כְּדֵי לִנְשֹׁם.',
    'דּוֹלְפִינִים חַיִּים בִּקְבוּצוֹת, וְהֵם "מְדַבְּרִים" זֶה עִם זֶה בִּשְׁרִיקוֹת.',
    'כְּדֵי לִמְצֹא אוֹכֶל בַּמַּיִם הַחֲשׁוּכִים, הַדּוֹלְפִין שׁוֹלֵחַ קוֹלוֹת.',
    'הַקּוֹלוֹת פּוֹגְעִים בַּדָּגִים וְחוֹזְרִים אֵלָיו, וְכָךְ הוּא יוֹדֵעַ אֵיפֹה הֵם.',
    'כְּשֶׁהַדּוֹלְפִין יָשֵׁן, חֵצִי מֵהַמֹּחַ שֶׁלּוֹ נָח, וְהַחֵצִי הַשֵּׁנִי עֵר.',
  ], qs: [
    { skill: 'detail', q: 'לָמָּה הַדּוֹלְפִין עוֹלֶה אֶל פְּנֵי הַמַּיִם?', options: ['כְּדֵי לִנְשֹׁם', 'כְּדֵי לִמְצֹא דָּגִים', 'כְּדֵי לִשְׁרֹק', 'כְּדֵי לִישֹׁן'], answer: 0,
      why: 'בְּשׁוּרָה 2 כָּתוּב שֶׁהוּא צָרִיךְ לַעֲלוֹת אֶל פְּנֵי הַמַּיִם כְּדֵי לִנְשֹׁם.' },
    { skill: 'detail', q: 'אֵיךְ דּוֹלְפִינִים "מְדַבְּרִים" זֶה עִם זֶה?', options: ['בִּתְנוּעוֹת יָדַיִם', 'בִּשְׁרִיקוֹת', 'בִּכְתִיבָה', 'הֵם לֹא מְדַבְּרִים'], answer: 1,
      why: 'בְּשׁוּרָה 3 כָּתוּב שֶׁהֵם "מְדַבְּרִים" זֶה עִם זֶה בִּשְׁרִיקוֹת.' },
    { skill: 'infer', q: 'מָה עוֹזֵר לַדּוֹלְפִין לִמְצֹא דָּגִים בַּחֹשֶׁךְ?', options: ['הָעֵינַיִם הַגְּדוֹלוֹת שֶׁלּוֹ', 'הָאוֹר שֶׁל הַשֶּׁמֶשׁ', 'הַקּוֹלוֹת שֶׁהוּא שׁוֹלֵחַ', 'הַדָּגִים קוֹרְאִים לוֹ'], answer: 2,
      why: 'בְּשׁוּרוֹת 4 וְ-5 כָּתוּב שֶׁהַקּוֹלוֹת חוֹזְרִים אֵלָיו מֵהַדָּגִים, וְכָךְ הוּא יוֹדֵעַ אֵיפֹה הֵם.' },
    { skill: 'detail', q: 'לְפִי הַקֶּטַע, מָה נָכוֹן?', options: ['הַדּוֹלְפִין הוּא דָּג', 'הַדּוֹלְפִין חַי לְבַד', 'הַדּוֹלְפִין לֹא יָשֵׁן אַף פַּעַם', 'כְּשֶׁהַדּוֹלְפִין יָשֵׁן, חֵצִי מֵהַמֹּחַ שֶׁלּוֹ עֵר'], answer: 3,
      why: 'בְּשׁוּרָה 6 כָּתוּב שֶׁכְּשֶׁהוּא יָשֵׁן, חֵצִי מֵהַמֹּחַ נָח וְהַחֵצִי הַשֵּׁנִי עֵר. בְּשׁוּרָה 1 כָּתוּב שֶׁהוּא לֹא דָּג, וּבְשׁוּרָה 3 שֶׁהוּא חַי בִּקְבוּצָה.' },
  ] },
  { id: 'p-cactus', title: 'הַקַּקְטוּס', lines: [
    'הַקַּקְטוּס הוּא צֶמַח שֶׁגָּדֵל בַּמִּדְבָּר.',
    'בַּמִּדְבָּר יוֹרֵד מְעַט מְאֹד גֶּשֶׁם.',
    'כְּשֶׁיּוֹרֵד גֶּשֶׁם, הַקַּקְטוּס אוֹסֵף הַרְבֵּה מַיִם וְשׁוֹמֵר אוֹתָם בְּתוֹךְ הַגִּבְעוֹל הֶעָבֶה שֶׁלּוֹ.',
    'לְרֹב הַקַּקְטוּסִים אֵין עָלִים רְחָבִים, אֶלָּא קוֹצִים.',
    'הַקּוֹצִים שׁוֹמְרִים עַל הַקַּקְטוּס מִפְּנֵי חַיּוֹת שֶׁרוֹצוֹת לֶאֱכֹל אוֹתוֹ.',
    'כָּךְ הַקַּקְטוּס יָכוֹל לִחְיוֹת זְמַן רַב גַּם בְּלִי גֶּשֶׁם.',
  ], qs: [
    { skill: 'detail', q: 'אֵיפֹה גָּדֵל הַקַּקְטוּס?', options: ['בַּיָּם', 'בַּמִּדְבָּר', 'בַּיַּעַר', 'בַּשֶּׁלֶג'], answer: 1,
      why: 'בְּשׁוּרָה 1 כָּתוּב שֶׁהַקַּקְטוּס גָּדֵל בַּמִּדְבָּר.' },
    { skill: 'detail', q: 'אֵיפֹה הַקַּקְטוּס שׁוֹמֵר אֶת הַמַּיִם?', options: ['בַּקּוֹצִים', 'בָּעָלִים הָרְחָבִים', 'בְּתוֹךְ הַגִּבְעוֹל', 'בַּחוֹל'], answer: 2,
      why: 'בְּשׁוּרָה 3 כָּתוּב שֶׁהוּא שׁוֹמֵר אֶת הַמַּיִם בְּתוֹךְ הַגִּבְעוֹל הֶעָבֶה שֶׁלּוֹ.' },
    { skill: 'infer', q: 'מָה הַתַּפְקִיד שֶׁל הַקּוֹצִים?', options: ['לִשְׁמֹר עַל הַקַּקְטוּס מֵחַיּוֹת', 'לֶאֱסֹף מַיִם', 'לְהַרְאוֹת אֶת הַדֶּרֶךְ', 'לְגַדֵּל פְּרָחִים'], answer: 0,
      why: 'בְּשׁוּרָה 5 כָּתוּב שֶׁהַקּוֹצִים שׁוֹמְרִים עַל הַקַּקְטוּס מִפְּנֵי חַיּוֹת שֶׁרוֹצוֹת לֶאֱכֹל אוֹתוֹ.' },
    { skill: 'vocab', q: 'מָה פֵּרוּשׁ הַמִּלָּה "עָבֶה" (שׁוּרָה 3)?', options: ['דַּק מְאֹד', 'יָבֵשׁ מְאֹד', 'יָרֹק וְקָטָן', 'הַהֵפֶךְ שֶׁל דַּק'], answer: 3,
      why: 'עָבֶה הוּא הַהֵפֶךְ שֶׁל דַּק. בְּגִבְעוֹל עָבֶה יֵשׁ מָקוֹם לְהַרְבֵּה מַיִם.' },
  ] },
  { id: 'p-butterfly', title: 'מִזַּחַל לְפַרְפַּר', lines: [
    'הַפַּרְפַּר מַתְחִיל אֶת הַחַיִּים שֶׁלּוֹ כְּבֵיצָה קְטַנָּה עַל עָלֶה.',
    'מִן הַבֵּיצָה יוֹצֵא זַחַל, וְהוּא אוֹכֵל עָלִים כָּל הַיּוֹם.',
    'הַזַּחַל גָּדֵל מַהֵר מְאֹד.',
    'אַחַר כָּךְ הַזַּחַל בּוֹנֶה סְבִיבוֹ מַעֲטֶפֶת קָשָׁה, שֶׁנִּקְרֵאת גֹּלֶם.',
    'בְּתוֹךְ הַגֹּלֶם הַזַּחַל מִשְׁתַּנֶּה לְאַט לְאַט.',
    'בַּסּוֹף יוֹצֵא מִן הַגֹּלֶם פַּרְפַּר עִם כְּנָפַיִם צִבְעוֹנִיּוֹת.',
  ], qs: [
    { skill: 'detail', q: 'מָה יוֹצֵא מִן הַבֵּיצָה?', options: ['פַּרְפַּר', 'זַחַל', 'גֹּלֶם', 'עָלֶה'], answer: 1,
      why: 'בְּשׁוּרָה 2 כָּתוּב: מִן הַבֵּיצָה יוֹצֵא זַחַל.' },
    { skill: 'detail', q: 'מָה הַזַּחַל אוֹכֵל?', options: ['פְּרָחִים', 'זְרָעִים', 'עָלִים', 'דְּבַשׁ'], answer: 2,
      why: 'בְּשׁוּרָה 2 כָּתוּב שֶׁהַזַּחַל אוֹכֵל עָלִים כָּל הַיּוֹם.' },
    { skill: 'order', q: 'מָה הַסֵּדֶר הַנָּכוֹן?', options: ['בֵּיצָה ← זַחַל ← גֹּלֶם ← פַּרְפַּר', 'זַחַל ← בֵּיצָה ← גֹּלֶם ← פַּרְפַּר', 'בֵּיצָה ← גֹּלֶם ← זַחַל ← פַּרְפַּר', 'גֹּלֶם ← זַחַל ← בֵּיצָה ← פַּרְפַּר'], answer: 0,
      why: 'קֹדֶם יֵשׁ בֵּיצָה (שׁוּרָה 1), מִמֶּנָּה יוֹצֵא זַחַל (שׁוּרָה 2), הַזַּחַל בּוֹנֶה גֹּלֶם (שׁוּרָה 4), וּבַסּוֹף יוֹצֵא פַּרְפַּר (שׁוּרָה 6).' },
    { skill: 'vocab', q: 'מָה זֶה גֹּלֶם?', options: ['סוּג שֶׁל עָלֶה', 'כָּנָף שֶׁל פַּרְפַּר', 'בֵּיצָה גְּדוֹלָה', 'מַעֲטֶפֶת קָשָׁה שֶׁהַזַּחַל בּוֹנֶה'], answer: 3,
      why: 'בְּשׁוּרָה 4 כָּתוּב שֶׁהַזַּחַל בּוֹנֶה סְבִיבוֹ מַעֲטֶפֶת קָשָׁה, שֶׁנִּקְרֵאת גֹּלֶם.' },
  ] },
  { id: 'p-bat', title: 'הָעֲטַלֵּף', lines: [
    'הָעֲטַלֵּף הוּא יוֹנֵק שֶׁיָּכוֹל לָעוּף.',
    'בַּיּוֹם הוּא יָשֵׁן בִּמְעָרָה חֲשׁוּכָה, כְּשֶׁהוּא תָּלוּי הָפוּךְ, עִם הָרֹאשׁ לְמַטָּה.',
    'בַּלַּיְלָה הוּא יוֹצֵא לְחַפֵּשׂ אוֹכֶל.',
    'יֵשׁ עֲטַלֵּפִים שֶׁאוֹכְלִים חֲרָקִים, וְיֵשׁ עֲטַלֵּפִים שֶׁאוֹכְלִים פֵּרוֹת.',
    'עֲטַלֵּפִים שֶׁאוֹכְלִים חֲרָקִים עוֹזְרִים לָאָדָם, כִּי הֵם אוֹכְלִים הַרְבֵּה יַתּוּשִׁים.',
    'לָכֵן חָשׁוּב לִשְׁמֹר עַל הָעֲטַלֵּפִים וְלֹא לְהַפְרִיעַ לָהֶם לִישֹׁן.',
  ], qs: [
    { skill: 'detail', q: 'מָתַי הָעֲטַלֵּף יוֹצֵא לְחַפֵּשׂ אוֹכֶל?', options: ['בַּבֹּקֶר', 'בַּצָּהֳרַיִם', 'בַּלַּיְלָה', 'רַק בַּחֹרֶף'], answer: 2,
      why: 'בְּשׁוּרָה 3 כָּתוּב: בַּלַּיְלָה הוּא יוֹצֵא לְחַפֵּשׂ אוֹכֶל.' },
    { skill: 'detail', q: 'אֵיךְ הָעֲטַלֵּף יָשֵׁן?', options: ['שׁוֹכֵב עַל הַגַּב', 'תָּלוּי הָפוּךְ, עִם הָרֹאשׁ לְמַטָּה', 'עוֹמֵד עַל עֵץ', 'בְּתוֹךְ קֵן'], answer: 1,
      why: 'בְּשׁוּרָה 2 כָּתוּב שֶׁהוּא יָשֵׁן כְּשֶׁהוּא תָּלוּי הָפוּךְ, עִם הָרֹאשׁ לְמַטָּה.' },
    { skill: 'infer', q: 'לָמָּה עֲטַלֵּפִים שֶׁאוֹכְלִים חֲרָקִים עוֹזְרִים לָאָדָם?', options: ['כִּי הֵם אוֹכְלִים יַתּוּשִׁים', 'כִּי הֵם מְאִירִים בַּלַּיְלָה', 'כִּי הֵם שׁוֹמְרִים עַל הַפֵּרוֹת', 'כִּי הֵם יְשֵׁנִים בַּיּוֹם'], answer: 0,
      why: 'בְּשׁוּרָה 5 כָּתוּב שֶׁהֵם עוֹזְרִים לָאָדָם כִּי הֵם אוֹכְלִים הַרְבֵּה יַתּוּשִׁים.' },
    { skill: 'main', q: 'מָה הַקֶּטַע רוֹצֶה לְלַמֵּד אוֹתָנוּ?', options: ['שֶׁעֲטַלֵּפִים מְסֻכָּנִים', 'שֶׁעֲטַלֵּפִים הֵם צִפֳּרִים', 'שֶׁכָּל הָעֲטַלֵּפִים אוֹכְלִים פֵּרוֹת', 'שֶׁעֲטַלֵּפִים מוֹעִילִים, וּכְדַאי לִשְׁמֹר עֲלֵיהֶם'], answer: 3,
      why: 'הַקֶּטַע מַסְבִּיר אֵיךְ עֲטַלֵּפִים עוֹזְרִים לָאָדָם, וּבְשׁוּרָה 6 כָּתוּב שֶׁחָשׁוּב לִשְׁמֹר עֲלֵיהֶם. בְּשׁוּרָה 1 כָּתוּב שֶׁהָעֲטַלֵּף הוּא יוֹנֵק, לֹא צִפּוֹר.' },
  ] },
  { id: 'p-seed', title: 'הַמַּתָּנָה שֶׁל נוֹגָה', lines: [
    'לְנוֹגָה הָיָה יוֹם הֻלֶּדֶת, וְהִיא קִבְּלָה מִסַּבְתָּא עָצִיץ קָטָן.',
    'בֶּעָצִיץ הָיְתָה רַק אֲדָמָה, וְלֹא הָיָה בּוֹ שׁוּם צֶמַח.',
    'נוֹגָה הָיְתָה קְצָת מְאֻכְזֶבֶת, אֲבָל סַבְתָּא אָמְרָה לָהּ: "חַכִּי וְתִרְאִי."',
    'כָּל בֹּקֶר נוֹגָה הִשְׁקְתָה אֶת הָאֲדָמָה וְשָׂמָה אֶת הֶעָצִיץ לְיַד הַחַלּוֹן.',
    'אַחֲרֵי שָׁבוּעַ הוֹפִיעַ בֶּעָצִיץ נֶבֶט יָרֹק וְקָטָן.',
    'נוֹגָה הֵבִינָה שֶׁבְּתוֹךְ הָאֲדָמָה הָיָה זֶרַע, וְחִיְּכָה.',
  ], qs: [
    { skill: 'detail', q: 'מָה נוֹגָה קִבְּלָה מִסַּבְתָּא?', options: ['פֶּרַח גָּדוֹל', 'עָצִיץ עִם אֲדָמָה', 'שַׂקִּית זְרָעִים', 'סֵפֶר עַל צְמָחִים'], answer: 1,
      why: 'בְּשׁוּרוֹת 1 וְ-2 כָּתוּב שֶׁהִיא קִבְּלָה עָצִיץ קָטָן, וְהָיְתָה בּוֹ רַק אֲדָמָה.' },
    { skill: 'infer', q: 'אֵיךְ הִרְגִּישָׁה נוֹגָה כְּשֶׁרָאֲתָה אֶת הֶעָצִיץ?', options: ['שְׂמֵחָה מְאֹד', 'כּוֹעֶסֶת', 'קְצָת מְאֻכְזֶבֶת', 'מְפַחֶדֶת'], answer: 2,
      why: 'בְּשׁוּרָה 3 כָּתוּב שֶׁנּוֹגָה הָיְתָה קְצָת מְאֻכְזֶבֶת.' },
    { skill: 'infer', q: 'לְמָה הִתְכַּוְּנָה סַבְתָּא כְּשֶׁאָמְרָה "חַכִּי וְתִרְאִי"?', options: ['שֶׁבְּעוֹד זְמַן מָה יִקְרֶה מַשֶּׁהוּ', 'שֶׁנּוֹגָה צְרִיכָה לָלֶכֶת', 'שֶׁהֶעָצִיץ שָׁבוּר', 'שֶׁאֵין טַעַם לְהַשְׁקוֹת'], answer: 0,
      why: 'סַבְתָּא יָדְעָה שֶׁיֵּשׁ זֶרַע בָּאֲדָמָה. אַחֲרֵי שָׁבוּעַ שֶׁל הַשְׁקָיָה הוֹפִיעַ נֶבֶט (שׁוּרָה 5).' },
    { skill: 'detail', q: 'מָה הוֹפִיעַ בֶּעָצִיץ אַחֲרֵי שָׁבוּעַ?', options: ['פֶּרַח אָדֹם', 'עֵץ גָּדוֹל', 'חֶרֶק קָטָן', 'נֶבֶט יָרֹק וְקָטָן'], answer: 3,
      why: 'בְּשׁוּרָה 5 כָּתוּב: אַחֲרֵי שָׁבוּעַ הוֹפִיעַ בֶּעָצִיץ נֶבֶט יָרֹק וְקָטָן.' },
  ] },
  { id: 'p-elephant', title: 'הַפִּיל', lines: [
    'הַפִּיל הוּא הַיּוֹנֵק הַגָּדוֹל בְּיוֹתֵר שֶׁחַי עַל הַיַּבָּשָׁה.',
    'יֵשׁ לוֹ חֶדֶק אָרֹךְ, וְהוּא מִשְׁתַּמֵּשׁ בּוֹ כְּמוֹ בְּיָד.',
    'בְּעֶזְרַת הַחֶדֶק הוּא תּוֹלֵשׁ עָלִים מֵהָעֵצִים וּמַכְנִיס אוֹתָם לַפֶּה.',
    'הַפִּיל גַּם שׁוֹאֵב מַיִם בַּחֶדֶק, וְאָז מַתִּיז אוֹתָם לְתוֹךְ הַפֶּה אוֹ עַל הַגּוּף.',
    'הָאָזְנַיִם הַגְּדוֹלוֹת שֶׁל הַפִּיל עוֹזְרוֹת לוֹ לְהִתְקָרֵר בַּיָּמִים הַחַמִּים.',
    'פִּילִים חַיִּים בְּעֵדֶר, וְהַפִּילָה הַזְּקֵנָה מוֹבִילָה אֶת כֻּלָּם.',
  ], qs: [
    { skill: 'detail', q: 'בְּמָה הַפִּיל מִשְׁתַּמֵּשׁ כְּמוֹ בְּיָד?', options: ['בָּאָזְנַיִם', 'בַּחֶדֶק', 'בָּרַגְלַיִם', 'בַּזָּנָב'], answer: 1,
      why: 'בְּשׁוּרָה 2 כָּתוּב שֶׁיֵּשׁ לוֹ חֶדֶק אָרֹךְ, וְהוּא מִשְׁתַּמֵּשׁ בּוֹ כְּמוֹ בְּיָד.' },
    { skill: 'detail', q: 'לְפִי הַקֶּטַע, לְמָה עוֹזְרוֹת לַפִּיל הָאָזְנַיִם הַגְּדוֹלוֹת?', options: ['לְהָרִים עֵצִים', 'לִשְׁאֹב מַיִם', 'לְהִתְקָרֵר בַּיָּמִים הַחַמִּים', 'לְהַפְחִיד אֲרָיוֹת'], answer: 2,
      why: 'בְּשׁוּרָה 5 כָּתוּב שֶׁהָאָזְנַיִם הַגְּדוֹלוֹת עוֹזְרוֹת לוֹ לְהִתְקָרֵר בַּיָּמִים הַחַמִּים.' },
    { skill: 'detail', q: 'מִי מוֹבִילָה אֶת עֵדֶר הַפִּילִים?', options: ['הַפִּילָה הַזְּקֵנָה', 'הַפִּיל הַצָּעִיר', 'הַפִּיל הַגָּדוֹל בְּיוֹתֵר', 'אַף אֶחָד'], answer: 0,
      why: 'בְּשׁוּרָה 6 כָּתוּב שֶׁהַפִּילָה הַזְּקֵנָה מוֹבִילָה אֶת כֻּלָּם.' },
    { skill: 'vocab', q: 'מָה פֵּרוּשׁ הַמִּלָּה "מַתִּיז" (שׁוּרָה 4)?', options: ['אוֹכֵל לְאַט', 'שׁוֹמֵר בְּתוֹךְ הַבֶּטֶן', 'מְחַפֵּשׂ', 'מְפַזֵּר טִפּוֹת מַיִם'], answer: 3,
      why: 'הַפִּיל שׁוֹאֵב מַיִם בַּחֶדֶק וְאָז מַתִּיז אוֹתָם, כְּלוֹמַר מְפַזֵּר אוֹתָם בְּטִפּוֹת עַל הַגּוּף אוֹ לַפֶּה.' },
  ] },
];

// ---------- the original 7 sets ----------
const ORIG_SETS = [
  { key: 'a', name: 'סֵט 1', title: D.l, passage: D.c, reading: D.u, exercises: D.s, words: D.f, series: D.d },
  { key: 'b', name: 'סֵט 2', ...D.a },
  { key: 'c', name: 'סֵט 3', ...D.o },
  { key: 'd', name: 'סֵט 4', ...D.i },
  { key: 'e', name: 'סֵט 5', ...D.r },
  { key: 'f', name: 'סֵט 6', ...D.n },
  { key: 'g', name: 'סֵט 7', ...D.t },
];
// reading-skill tags for the original reading questions (by position in the set)
const ORIG_READ_SKILL = { r1: 'detail', r2: 'vocab', r3: 'infer', r4: 'main', 'b-r2': 'vocab' };
function origCalcSkill(q) {
  if (q.includes('×')) return 'mul';
  if (/^\d+ \+ \d+ = ___$/.test(q)) return 'add';
  if (/^\d+ − \d+ = ___$/.test(q)) return 'sub';
  return 'missing';
}
function origSeriesSkill(q, why) {
  if (why.includes('חֲלִילָה')) return 'ser-alt';
  if (why.includes('אַחַר כָּךְ 3')) return 'ser-grow';
  return 'ser-arith';
}

// Items a parent should double-check. Shown in the parent report.
export const FLAGS = {
  'd-r2': 'מה יש בדבשת? התשובה "שומן" כתובה בקטע, אבל ילד חושב עשוי לבחור "אוכל" (שומן הוא מאגר מזון). כדאי לדבר על זה.',
};

function origItems() {
  const out = [];
  for (const s of ORIG_SETS) {
    const passage = { id: 'orig-' + s.key, title: s.title || s.passageTitle, lines: s.passage };
    s.reading.forEach((it, i) => out.push({ ...it, type: 'reading', skill: ORIG_READ_SKILL[it.id] || 'detail', level: 1, passage, src: 'orig', origSet: s.name }));
    s.exercises.forEach((it) => out.push({ ...it, type: 'calc', skill: origCalcSkill(it.q), level: 2, src: 'orig', origSet: s.name }));
    s.words.forEach((it) => out.push({ ...it, type: 'word', skill: 'orig-word', level: 2, src: 'orig', origSet: s.name }));
    s.series.forEach((it) => out.push({ ...it, type: 'series', skill: origSeriesSkill(it.q, it.why), level: 2, src: 'orig', origSet: s.name }));
  }
  out.forEach((x) => { if (FLAGS[x.id]) x.flag = FLAGS[x.id]; });
  return out;
}

function newReadingItems() {
  const out = [];
  for (const p of NEW_PASSAGES) {
    const passage = { id: p.id, title: p.title, lines: p.lines };
    p.qs.forEach((q, i) => out.push({ id: `${p.id}-q${i + 1}`, type: 'reading', kind: 'mc', ...q, level: q.skill === 'detail' ? 1 : 2, passage, src: 'new' }));
  }
  return out;
}

export const BANK = [...origItems(), ...newReadingItems(), ...genCalc(), ...genWords(), ...genSeries()];
export const BY_ID = Object.fromEntries(BANK.map((x) => [x.id, x]));

export const TYPES = [
  { id: 'calc', name: 'חֶשְׁבּוֹן', icon: '🔢', cls: 'calc' },
  { id: 'word', name: 'בְּעָיוֹת מִלּוּלִיּוֹת', icon: '🍎', cls: 'word' },
  { id: 'series', name: 'סִדְרוֹת', icon: '🔁', cls: 'ser' },
  { id: 'reading', name: 'הֲבָנַת הַנִּקְרָא', icon: '📖', cls: 'read' },
];
// Parent-facing skill names (no niqqud, like the other parent texts)
export const SKILLS = {
  add: 'חיבור', sub: 'חיסור', missing: 'מספר חסר', mul: 'כפל', div: 'חילוק', three: 'תרגיל בשלושה שלבים',
  twostep: 'בעיה דו-שלבית', groups: 'קבוצות שוות (כפל)', share: 'חלוקה וחצי', compare: 'השוואה והפרש', money: 'כסף ועודף',
  logic: 'בעיות חשיבה', 'orig-word': 'בעיות מילוליות (סטים)',
  'ser-arith': 'סדרה בקפיצות קבועות', 'ser-alt': 'סדרה מתחלפת', 'ser-grow': 'סדרה עם קפיצות גדלות', 'ser-double': 'סדרת הכפלה',
  detail: 'הבנת הנקרא: מידע מהקטע', vocab: 'הבנת הנקרא: אוצר מילים', infer: 'הבנת הנקרא: הסקה', main: 'הבנת הנקרא: רעיון מרכזי', order: 'הבנת הנקרא: סדר אירועים',
};
export const PASSAGES = (() => {
  const m = new Map();
  BANK.forEach((x) => { if (x.passage && !m.has(x.passage.id)) m.set(x.passage.id, x.passage); });
  return [...m.values()];
})();
export const ORIG_SET_ITEMS = ORIG_SETS.map((s) => [...s.reading, ...s.exercises, ...s.words, ...s.series].map((x) => x.id));
