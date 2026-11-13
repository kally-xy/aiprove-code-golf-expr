// Test suite for eval.js — public cases + edge cases + invalid inputs
// + seeded fuzz cross-checked against an independent reference parser.
// Run: node test.js   (exit 0 = all pass)
const { evalExpr } = require('./eval.js');

function eq(a, b) {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9 || Object.is(a, b);
  return a === b;
}

let pass = 0, fail = 0;
function check(input, expected, label) {
  let got, threw = null;
  try { got = evalExpr(input); } catch (e) { threw = e.constructor.name; }
  const ok = expected === 'THROW' ? threw !== null : (threw === null && eq(got, expected));
  if (ok) pass++;
  else { fail++; console.log(`FAIL [${label}] ${JSON.stringify(input)} -> ${threw ? 'THREW ' + threw : got} (expected ${expected})`); }
  return ok;
}

// 1. Public cases (AIProve cases.json) — 9/9 required
const pub = [
  ['1+2*3', 7], ['(1+2)*3', 9], ['10/4', 2.5], ['2*2*2*2', 16],
  ['7-3-2', 2], ['(8-2)/(1+2)', 2], ['3.5+1.5', 5], ['100', 100], ['2*(3+(4-1))', 12],
];
for (const [i, e] of pub) check(i, e, 'public');
console.log(`public: ${pass}/9`);

// 2. Edge suite — strict-arithmetic truth (40 cases)
const edge = [
  ['-5+3', -2], ['2*-3', -6], ['2--3', 5], ['--5', 5], ['---5', -5],
  ['2---3', -1], ['2----3', 5], ['1++2', 3], ['++5', 5], ['+++5', 5],
  ['1+-2', -1], ['2-+3', -1], ['2-+-3', 5], ['2*- -3', 6], ['-(2+3)', -5],
  ['2*-(3+1)', -8], ['1 + 2', 3], ['  2 * ( 3 + 4 )  ', 14], ['1\t+\n2', 3],
  ['.5', 0.5], ['5.', 5], ['.5+.5', 1], ['0.1+0.2', 0.30000000000000004],
  ['((2))', 2], ['((((1+2))))', 3], ['10/3', 10 / 3], ['1/0', Infinity],
  ['0/0', NaN], ['+5', 5], ['9/3/3', 1], ['2-3-4', -5],
  ['1000000*1000000', 1e12], ['0.5*0.5', 0.25], ['3*-2*-2', 12],
  ['((1+2)*(3+4))/((5-2))', 7], ['123.456+0.544', 124],
  ['1/3+1/3+1/3', 1], ['-0', 0], ['5--5', 10], ['5++5', 10],
];
const before = pass; fail = 0;
for (const [i, e] of edge) check(i, e, 'edge');
console.log(`edge: ${pass - before}/40 (fail: ${fail})`);

// 3. Invalid inputs — must throw (same as any strict parser)
const invalid = ['2(3)', '2+', '(1+2', '2*', '*', 'abc', '1/2/'];
const before3 = pass; fail = 0;
for (const i of invalid) check(i, 'THROW', 'invalid');
console.log(`invalid (must throw): ${pass - before3}/${invalid.length} (fail: ${fail})`);

// 4. Seeded fuzz vs independent reference parser (spec language only)
function ref(s) {
  let i = 0;
  const skip = () => { while (/\s/.test(s[i])) i++; };
  function E() { let v = T(); for (;;) { skip(); if (s[i] === '+') { i++; v += T(); } else if (s[i] === '-') { i++; v -= T(); } else return v; } }
  function T() { let v = U(); for (;;) { skip(); if (s[i] === '*') { i++; v *= U(); } else if (s[i] === '/') { i++; v /= U(); } else return v; } }
  function U() { skip(); if (s[i] === '-') { i++; return -U(); } if (s[i] === '+') { i++; return U(); } return P(); }
  function P() {
    skip();
    if (s[i] === '(') { i++; const v = E(); skip(); if (s[i] !== ')') throw new Error('unclosed'); i++; return v; }
    let j = i; while (/[0-9.]/.test(s[i])) i++;
    if (j === i) throw new Error('num');
    return parseFloat(s.slice(j, i));
  }
  const v = E(); skip();
  if (i < s.length) throw new Error('trailing');
  return v;
}
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
function num() {
  const k = Math.floor(rnd() * 4);
  if (k === 0) return String(Math.floor(rnd() * 100));
  if (k === 1) return (rnd() * 20).toFixed(1 + Math.floor(rnd() * 2));
  if (k === 2) return '.' + Math.floor(rnd() * 10);
  return Math.floor(rnd() * 10) + '.';
}
function expr(d) {
  if (d <= 0 || rnd() < 0.3) { let n = num(); if (rnd() < 0.15) n = '-' + n; else if (rnd() < 0.05) n = '+' + n; return n; }
  const op = ['+', '-', '*', '/'][Math.floor(rnd() * 4)];
  let e = expr(d - 1) + op + expr(d - 1);
  if (rnd() < 0.4) e = '(' + e + ')';
  if (rnd() < 0.15) e = '-' + e;
  return e;
}
let fPass = 0, fFail = 0;
for (let k = 0; k < 200; k++) {
  const e = expr(3);
  let r, g;
  try { r = ref(e); } catch { continue; }
  try { g = evalExpr(e); } catch { fFail++; console.log(`FUZZ THREW ${JSON.stringify(e)} (ref=${r})`); continue; }
  if (eq(r, g)) fPass++;
  else { fFail++; if (fFail <= 5) console.log(`FUZZ MISMATCH ${JSON.stringify(e)} ref=${r} golf=${g}`); }
}
console.log(`fuzz (seeded, 200 random): ${fPass} match / ${fFail} mismatch`);
console.log(`\nTOTAL: ${pass} passed, ${fail} failed (edge/invalid sections); fuzz ${fPass}/${fPass + fFail}`);
if (fail > 0 || fFail > 0) process.exit(1);
console.log('ALL GREEN');
