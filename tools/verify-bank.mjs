// Independent check of every question in bank.js.
// Run from the repo root:  node tools/verify-bank.mjs
//
// It does NOT trust the generator. For each item it re-solves the question
// from the text the child actually sees, and checks:
//  - number questions: the equation / series has exactly one answer, and it is the key
//  - series: every simple rule family that fits the shown numbers gives the same answer
//  - word problems: recomputed from the numbers in the question text per template
//  - every "a op b = c" written in an explanation is arithmetically true
//  - multiple choice: 4 unique options, valid answer index
//  - reading: explanations only cite lines that exist
// Exit code 1 if anything fails. Items with `flag` are listed for a parent to review.

import { BANK } from '../bank.js';

const strip = (s) => s.replace(/[֑-ׇ]/g, '');
const fails = [];
const warn = [];
const fail = (it, msg) => fails.push(`${it.id}: ${msg}\n    ${strip(it.q)}`);

function evalSide(s) {
  const e = s.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  if (!/^[\d\s+\-*/]+$/.test(e)) throw new Error('bad expr ' + s);
  return Function(`return (${e})`)();
}

// --- equations with one blank ---
function solveEquation(q) {
  const [l, r] = q.split('=');
  const sols = [];
  for (let x = 0; x <= 300; x++) {
    const L = evalSide(l.replace('___', String(x)));
    const Rv = evalSide(r.replace('___', String(x)));
    if (Math.abs(L - Rv) < 1e-9) sols.push(x);
  }
  return sols;
}

// --- series: rule families ---
function fits(seq) {
  // seq: numbers (all known). returns list of family names that fit
  const d = seq.slice(1).map((x, i) => x - seq[i]);
  const out = [];
  if (d.every((x) => x === d[0])) out.push('arith');
  if (d.length >= 3 && d.every((x, i) => x === d[i % 2])) out.push('period2');
  const dd = d.slice(1).map((x, i) => x - d[i]);
  if (dd.length >= 2 && dd.every((x) => x === dd[0])) out.push('second');
  if (seq.every((x) => x > 0)) {
    const r = seq[1] / seq[0];
    if (Number.isInteger(r) && r > 1 && seq.every((x, i) => i === 0 || x === seq[i - 1] * r)) out.push('geom');
  }
  // repeating 3-step pattern: only counts when the repeat is seen at least twice
  if (d.length >= 5 && d.every((x, i) => x === d[i % 3])) out.push('period3');
  // each number is the sum of the two before it (2, 3, 5, 8, 13 ...)
  if (seq.length >= 4 && seq.every((x, i) => i < 2 || x === seq[i - 1] + seq[i - 2])) out.push('fib');
  return out;
}
function solveSeries(q) {
  const parts = q.split(',').map((s) => s.trim());
  const answers = new Map(); // value -> families
  for (let x = 0; x <= 400; x++) {
    const seq = parts.map((p) => (p === '___' ? x : Number(p)));
    for (const f of fits(seq)) {
      if (!answers.has(x)) answers.set(x, []);
      answers.get(x).push(f);
    }
  }
  return answers;
}

// --- word problems by template, from the numbers in the question text ---
const WORD = {
  1: ([a, b, c]) => a + b - c,
  2: ([a, b]) => a * b,
  3: ([c, a]) => c / a,
  4: ([c, a]) => c / a,
  5: ([a, b]) => a - b,
  6: ([m, p1, p2]) => m - p1 - p2,
  7: ([a, b, c]) => a - b + c,
  8: ([a, b]) => 2 * a + 4 * b,
  9: ([a, b, c]) => a + b + c,
  10: ([r, s, t]) => r * s - t,
  11: ([c]) => c / 2,
  12: ([t, g]) => t - g,
  13: ([a, b, c]) => a * b + c,
  14: ([a, b]) => 2 * a + b,
};

function checkWhyMath(it) {
  const re = /(\d+)\s*([+−×÷])\s*(\d+)\s*=\s*(\d+)/g;
  let m;
  while ((m = re.exec(it.why))) {
    const [, a, op, b, c] = m;
    const v = evalSide(`${a} ${op} ${b}`);
    if (v !== Number(c)) fail(it, `explanation math wrong: ${a} ${op} ${b} = ${c}`);
  }
}

const counts = {};
for (const it of BANK) {
  counts[it.type] = (counts[it.type] || 0) + 1;
  if (!it.why) fail(it, 'missing explanation');
  checkWhyMath(it);
  if (it.kind === 'num') {
    if (it.type === 'series') {
      const ans = solveSeries(it.q);
      const vals = [...ans.keys()];
      if (!ans.has(it.answer)) fail(it, `key ${it.answer} fits no simple rule (fits: ${vals.join(',')})`);
      else if (vals.length > 1) {
        const msg = `more than one rule fits: ${vals.map((v) => v + '[' + ans.get(v).join('/') + ']').join(' ')}`;
        if (it.flag) warn.push(`${it.id}: ${msg}`); else fail(it, msg);
      }
    } else {
      const sols = solveEquation(it.q);
      if (sols.length !== 1 || sols[0] !== it.answer) fail(it, `equation solutions ${sols.join(',')} ≠ key ${it.answer}`);
    }
  } else {
    if (!Array.isArray(it.options) || it.options.length !== 4) fail(it, 'needs 4 options');
    else if (new Set(it.options).size !== 4) fail(it, 'duplicate options');
    if (!(it.answer >= 0 && it.answer < (it.options || []).length)) fail(it, 'answer index out of range');
    if (it.type === 'word' && it.src === 'gen') {
      const nums = (strip(it.q).match(/\d+/g) || []).map(Number);
      const expect = WORD[it.tpl](nums);
      if (Number(it.options[it.answer]) !== expect) fail(it, `recomputed ${expect} ≠ key ${it.options[it.answer]}`);
      if (!Number.isInteger(expect) || expect <= 0) fail(it, 'answer not a positive whole number');
    }
    if (it.type === 'word' && it.src === 'orig') {
      // the last "= N" in the explanation must be the keyed option
      const last = [...it.why.matchAll(/=\s*(\d+)/g)].pop();
      const tail = (strip(it.why).match(/(\d+)\D*$/) || [])[1];
      const keyed = it.options[it.answer];
      if (!(last && last[1] === keyed) && tail !== keyed) warn.push(`${it.id}: check explanation ends at the keyed answer ${keyed}`);
    }
    if (it.type === 'reading') {
      const n = it.passage.lines.length;
      for (const m of strip(it.why).matchAll(/בשור(?:ה|ות) (\d+)(?: ו-(\d+))?/g)) {
        for (const g of [m[1], m[2]]) if (g && (Number(g) < 1 || Number(g) > n)) fail(it, `cites line ${g}, passage has ${n}`);
      }
    }
  }
  if (it.flag) warn.push(`${it.id}: FLAGGED – ${it.flag}`);
}

const ids = BANK.map((x) => x.id);
if (new Set(ids).size !== ids.length) fails.push('duplicate ids');

console.log(`checked ${BANK.length} items`, counts);
if (warn.length) console.log(`\nfor review (${warn.length}):\n` + warn.join('\n'));
if (fails.length) {
  console.log(`\nFAILED (${fails.length}):\n` + fails.join('\n'));
  process.exit(1);
}
console.log('\nall answer keys verified ✓');
